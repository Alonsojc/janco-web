const { randomUUID } = require("node:crypto");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_EMAIL = "ventas@janco.tech";
const MAX_BODY_BYTES = 64_000;
const DELIVERY_TIMEOUT_MS = 8_000;
const ALLOWED_SYSTEMS = new Set(["Arrendamiento puro"]);
const FIELD_LIMITS = {
  email: 254,
  empresa: 120,
  mensaje: 2_000,
  nombre: 120,
  pagina: 500,
  privacidad: 20,
  sistema: 80,
  telefono: 40,
  utm_campaign: 100,
  utm_medium: 100,
  utm_source: 100,
};

class RequestError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "RequestError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

class DeliveryError extends Error {
  constructor(channel, statusCode = 0) {
    super(`${channel} delivery failed`);
    this.name = "DeliveryError";
    this.channel = channel;
    this.statusCode = statusCode;
  }
}

function logEvent(event, fields = {}) {
  console.info(JSON.stringify({ event, ...fields }));
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let byteLength = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.on("data", (chunk) => {
      if (settled) return;
      byteLength += Buffer.byteLength(chunk);
      if (byteLength > MAX_BODY_BYTES) {
        fail(new RequestError(413, "body_too_large", "La solicitud es demasiado grande."));
        return;
      }
      body += chunk;
    });

    req.on("end", () => {
      if (settled) return;
      try {
        const parsed = body ? JSON.parse(body) : {};
        settled = true;
        resolve(parsed);
      } catch {
        fail(new RequestError(400, "invalid_json", "El formulario no pudo procesarse."));
      }
    });

    req.on("error", () => {
      fail(new RequestError(400, "request_stream_error", "El formulario no pudo procesarse."));
    });
  });
}

function cleanField(payload, field) {
  const value = String(payload[field] || "").trim();
  if (value.length > FIELD_LIMITS[field]) {
    throw new RequestError(400, "field_too_long", "Uno de los campos excede el tamaño permitido.");
  }
  return value;
}

function getRequestHost(req) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function requireSameOrigin(req) {
  const host = getRequestHost(req);
  const origin = String(req.headers.origin || "");

  if (!host || !origin) {
    throw new RequestError(403, "origin_required", "No se pudo validar el origen de la solicitud.");
  }

  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new RequestError(403, "origin_invalid", "No se pudo validar el origen de la solicitud.");
  }

  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const validProtocol = originUrl.protocol === "https:" || (isLocal && originUrl.protocol === "http:");
  const fetchSite = String(req.headers["sec-fetch-site"] || "");

  if (!validProtocol || originUrl.host.toLowerCase() !== host || (fetchSite && fetchSite !== "same-origin")) {
    throw new RequestError(403, "origin_mismatch", "No se pudo validar el origen de la solicitud.");
  }
}

function sanitizePage(value, req) {
  const host = getRequestHost(req);
  const fallback = host ? `https://${host}/` : "https://janco.tech/";

  try {
    const page = new URL(value || fallback);
    if (page.host.toLowerCase() !== host || !["http:", "https:"].includes(page.protocol)) return fallback;
    return `${page.protocol}//${page.host}${page.pathname}`.slice(0, FIELD_LIMITS.pagina);
  } catch {
    return fallback;
  }
}

function buildLead(payload, req) {
  const pagina = sanitizePage(cleanField(payload, "pagina"), req);
  return {
    nombre: cleanField(payload, "nombre"),
    empresa: cleanField(payload, "empresa"),
    email: cleanField(payload, "email").toLowerCase(),
    telefono: cleanField(payload, "telefono"),
    sistema: cleanField(payload, "sistema"),
    mensaje: cleanField(payload, "mensaje"),
    pagina,
    utm_source: cleanField(payload, "utm_source"),
    utm_medium: cleanField(payload, "utm_medium"),
    utm_campaign: cleanField(payload, "utm_campaign"),
    privacidad: cleanField(payload, "privacidad"),
    origen: pagina,
    fecha: new Date().toISOString(),
  };
}

function validateLead(lead) {
  if (!lead.nombre) return { code: "missing_name", message: "Escribe tu nombre." };
  if (!lead.sistema) return { code: "missing_system", message: "No se pudo identificar la solución solicitada." };
  if (!ALLOWED_SYSTEMS.has(lead.sistema)) {
    return { code: "invalid_system", message: "La solución solicitada no está disponible." };
  }
  if (!lead.email && !lead.telefono) {
    return { code: "missing_contact", message: "Déjanos un correo o teléfono para contactarte." };
  }
  if (lead.email && !EMAIL_RE.test(lead.email)) {
    return { code: "invalid_email", message: "Revisa que el correo esté bien escrito." };
  }
  if (lead.privacidad !== "acepto") {
    return { code: "privacy_required", message: "Acepta el aviso de privacidad para enviar la solicitud." };
  }
  return null;
}

function leadText(lead) {
  return [
    "Nuevo lead desde janco.tech",
    "",
    `Nombre: ${lead.nombre}`,
    `Empresa: ${lead.empresa || "-"}`,
    `Correo: ${lead.email || "-"}`,
    `Telefono: ${lead.telefono || "-"}`,
    `Solución: ${lead.sistema}`,
    `Pagina: ${lead.pagina}`,
    `UTM source: ${lead.utm_source || "-"}`,
    `UTM medium: ${lead.utm_medium || "-"}`,
    `UTM campaign: ${lead.utm_campaign || "-"}`,
    `Fecha: ${lead.fecha}`,
    "",
    "Mensaje:",
    lead.mensaje || "-",
  ].join("\n");
}

function autoReplyText(lead) {
  const nombre = lead.nombre.split(" ")[0] || lead.nombre;

  return [
    `Hola ${nombre},`,
    "",
    "Gracias por contactar a Janco. Recibimos tu solicitud y vamos a revisarla para proponerte una demo aterrizada a tu operación.",
    "",
    `Solución: ${lead.sistema}`,
    "",
    "Normalmente el siguiente paso es entender tu flujo actual, revisar qué módulos necesitas y enseñarte una demo corta con un caso parecido al tuyo.",
    "",
    "Si prefieres avanzar por WhatsApp, también puedes escribirnos al +52 442 272 0445.",
    "",
    "Saludos,",
    "Janco",
    CONTACT_EMAIL,
  ].join("\n");
}

async function postResendEmail({ from, to, replyTo, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true };

  const body = {
    from,
    subject,
    text,
    to: Array.isArray(to) ? to : [to],
  };

  if (replyTo) body.reply_to = replyTo;

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });

  if (!response.ok) throw new DeliveryError("email", response.status);
  return { ok: true };
}

async function sendInternalEmail(lead) {
  if (!process.env.RESEND_API_KEY) return { skipped: true };

  const to = process.env.LEADS_TO_EMAIL || CONTACT_EMAIL;
  const from = process.env.LEADS_FROM_EMAIL || "Janco <onboarding@resend.dev>";

  return postResendEmail({
    from,
    replyTo: lead.email || undefined,
    subject: `Nuevo lead Janco: ${lead.sistema}`,
    text: leadText(lead),
    to,
  });
}

async function sendAutoReply(lead) {
  if (!lead.email) return { skipped: true };

  const from = process.env.AUTOREPLY_FROM_EMAIL || process.env.LEADS_FROM_EMAIL || "Janco <onboarding@resend.dev>";

  return postResendEmail({
    from,
    replyTo: CONTACT_EMAIL,
    subject: "Recibimos tu solicitud en Janco",
    text: autoReplyText(lead),
    to: lead.email,
  });
}

async function sendWebhook(lead) {
  const url = process.env.LEADS_WEBHOOK_URL;
  if (!url) return { skipped: true };

  const headers = { "Content-Type": "application/json" };
  if (process.env.LEADS_WEBHOOK_SECRET) {
    headers["X-Janco-Lead-Secret"] = process.env.LEADS_WEBHOOK_SECRET;
  }

  const response = await fetch(url, {
    body: JSON.stringify(lead),
    headers,
    method: "POST",
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });

  if (!response.ok) throw new DeliveryError("webhook", response.status);
  return { ok: true };
}

function summarizeResult(result) {
  if (result.status === "rejected") {
    return {
      outcome: "failed",
      status_code: result.reason instanceof DeliveryError ? result.reason.statusCode : 0,
    };
  }
  return { outcome: result.value?.ok ? "delivered" : "skipped", status_code: result.value?.ok ? 200 : 0 };
}

module.exports = async function handler(req, res) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  res.setHeader("X-Request-Id", requestId);

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 204, {});
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { message: "Método no permitido." });
  }

  try {
    requireSameOrigin(req);
    const contentType = String(req.headers["content-type"] || "").toLowerCase();
    if (!contentType.startsWith("application/json")) {
      throw new RequestError(415, "unsupported_media_type", "El formulario debe enviarse como JSON.");
    }

    const payload = await readJson(req);
    if (payload.website) {
      logEvent("lead.honeypot", { duration_ms: Date.now() - startedAt, request_id: requestId });
      return sendJson(res, 200, { message: "Gracias. Recibimos tu solicitud." });
    }

    const lead = buildLead(payload, req);
    const validationError = validateLead(lead);
    if (validationError) {
      logEvent("lead.rejected", {
        duration_ms: Date.now() - startedAt,
        reason: validationError.code,
        request_id: requestId,
        status_code: 400,
      });
      return sendJson(res, 400, { message: validationError.message });
    }

    const hasEmail = Boolean(process.env.RESEND_API_KEY);
    const hasWebhook = Boolean(process.env.LEADS_WEBHOOK_URL);

    if (!hasEmail && !hasWebhook) {
      throw new RequestError(
        503,
        "delivery_not_configured",
        "Por ahora el formulario está en configuración. Escríbenos por WhatsApp y te respondemos directo.",
      );
    }

    const [emailResult, webhookResult] = await Promise.allSettled([sendInternalEmail(lead), sendWebhook(lead)]);
    const email = summarizeResult(emailResult);
    const webhook = summarizeResult(webhookResult);
    const delivered = email.outcome === "delivered" || webhook.outcome === "delivered";

    logEvent("lead.delivery", {
      duration_ms: Date.now() - startedAt,
      email,
      request_id: requestId,
      webhook,
    });

    if (!delivered) {
      throw new RequestError(502, "delivery_failed", "No se pudo enviar la solicitud en este momento.");
    }

    const [autoReplyResult] = await Promise.allSettled([sendAutoReply(lead)]);
    logEvent("lead.autoreply", {
      ...summarizeResult(autoReplyResult),
      duration_ms: Date.now() - startedAt,
      request_id: requestId,
    });

    logEvent("lead.accepted", {
      duration_ms: Date.now() - startedAt,
      request_id: requestId,
      system: lead.sistema,
    });
    return sendJson(res, 200, {
      message: "Listo. Recibimos tu solicitud y te contactaremos pronto.",
    });
  } catch (error) {
    const isRequestError = error instanceof RequestError;
    const statusCode = isRequestError ? error.statusCode : 500;
    logEvent("lead.request_failed", {
      duration_ms: Date.now() - startedAt,
      error_code: isRequestError ? error.code : "unexpected_error",
      request_id: requestId,
      status_code: statusCode,
    });
    return sendJson(res, statusCode, {
      message: isRequestError ? error.message : "No se pudo enviar la solicitud en este momento.",
    });
  }
};
