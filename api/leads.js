const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64_000) {
        reject(new Error("La solicitud es demasiado grande."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("El formulario no pudo procesarse."));
      }
    });
    req.on("error", reject);
  });
}

function clean(value) {
  return String(value || "").trim().slice(0, 800);
}

function buildLead(payload, req) {
  return {
    nombre: clean(payload.nombre),
    empresa: clean(payload.empresa),
    email: clean(payload.email).toLowerCase(),
    telefono: clean(payload.telefono),
    sistema: clean(payload.sistema),
    mensaje: clean(payload.mensaje),
    origen: req.headers.referer || "janco.tech",
    fecha: new Date().toISOString(),
  };
}

function validateLead(lead) {
  if (!lead.nombre) return "Escribe tu nombre.";
  if (!lead.sistema) return "Selecciona el sistema que te interesa.";
  if (!lead.email && !lead.telefono) return "Déjanos un correo o teléfono para contactarte.";
  if (lead.email && !EMAIL_RE.test(lead.email)) return "Revisa que el correo esté bien escrito.";
  return "";
}

function leadText(lead) {
  return [
    "Nuevo lead desde janco.tech",
    "",
    `Nombre: ${lead.nombre}`,
    `Empresa: ${lead.empresa || "-"}`,
    `Correo: ${lead.email || "-"}`,
    `Telefono: ${lead.telefono || "-"}`,
    `Sistema: ${lead.sistema}`,
    `Origen: ${lead.origen}`,
    `Fecha: ${lead.fecha}`,
    "",
    "Mensaje:",
    lead.mensaje || "-",
  ].join("\n");
}

async function sendEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true };

  const to = process.env.LEADS_TO_EMAIL || "alonsojaneiro@hotmail.com";
  const from = process.env.LEADS_FROM_EMAIL || "Janco <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from,
      reply_to: lead.email || undefined,
      subject: `Nuevo lead Janco: ${lead.sistema}`,
      text: leadText(lead),
      to: [to],
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend respondió ${response.status}: ${errorText.slice(0, 180)}`);
  }

  return { ok: true };
}

async function sendWebhook(lead) {
  const url = process.env.LEADS_WEBHOOK_URL;
  if (!url) return { skipped: true };

  const response = await fetch(url, {
    body: JSON.stringify(lead),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Webhook respondió ${response.status}`);
  }

  return { ok: true };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 204, {});
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { message: "Método no permitido." });
  }

  try {
    const payload = await readJson(req);
    if (payload.website) {
      return sendJson(res, 200, { message: "Gracias. Recibimos tu solicitud." });
    }

    const lead = buildLead(payload, req);
    const validationError = validateLead(lead);
    if (validationError) {
      return sendJson(res, 400, { message: validationError });
    }

    const hasEmail = Boolean(process.env.RESEND_API_KEY);
    const hasWebhook = Boolean(process.env.LEADS_WEBHOOK_URL);

    if (!hasEmail && !hasWebhook) {
      return sendJson(res, 503, {
        message: "Por ahora el formulario está en configuración. Escríbenos por WhatsApp y te respondemos directo.",
      });
    }

    const results = await Promise.allSettled([sendEmail(lead), sendWebhook(lead)]);
    const delivered = results.some((result) => result.status === "fulfilled" && result.value.ok);

    if (!delivered) {
      throw new Error("No hubo ningún canal de entrega configurado o exitoso.");
    }

    return sendJson(res, 200, {
      message: "Listo. Recibimos tu solicitud y te contactaremos pronto.",
    });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      message: "No se pudo enviar la solicitud en este momento.",
    });
  }
};
