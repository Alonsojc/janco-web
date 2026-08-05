const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");

const handler = require("./leads");

const ORIGINAL_ENV = { ...process.env };

function createRequest({ body = "", headers = {}, method = "POST" } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method;
  request.headers = {
    "content-type": "application/json",
    host: "janco.tech",
    origin: "https://janco.tech",
    "sec-fetch-site": "same-origin",
    ...headers,
  };
  return request;
}

function createResponse() {
  return {
    body: "",
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body = "") {
      this.body = body;
    },
  };
}

async function invoke(options) {
  const request = createRequest(options);
  const response = createResponse();
  await handler(request, response);
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

function validPayload(overrides = {}) {
  return {
    nombre: "Prueba Janco",
    privacidad: "acepto",
    sistema: "Arrendamiento puro",
    telefono: "+52 442 000 0000",
    ...overrides,
  };
}

test.beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.RESEND_API_KEY;
  delete process.env.LEADS_WEBHOOK_URL;
  delete process.env.LEADS_WEBHOOK_SECRET;
});

test.after(() => {
  process.env = ORIGINAL_ENV;
});

test("rechaza métodos distintos de POST", async () => {
  const response = await invoke({ method: "GET" });
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, "POST, OPTIONS");
});

test("rechaza contenido que no sea JSON", async () => {
  const response = await invoke({ headers: { "content-type": "text/plain" } });
  assert.equal(response.statusCode, 415);
});

test("rechaza un origen ajeno", async () => {
  const response = await invoke({ headers: { origin: "https://example.com" } });
  assert.equal(response.statusCode, 403);
});

test("rechaza JSON malformado como 400", async () => {
  const response = await invoke({ body: "{" });
  assert.equal(response.statusCode, 400);
});

test("rechaza cuerpos mayores a 64 KB como 413", async () => {
  const response = await invoke({ body: JSON.stringify({ mensaje: "x".repeat(65_000) }) });
  assert.equal(response.statusCode, 413);
});

test("valida sistema y al menos un dato de contacto", async () => {
  const missingContact = await invoke({
    body: JSON.stringify(validPayload({ telefono: "" })),
  });
  assert.equal(missingContact.statusCode, 400);
  assert.match(missingContact.json.message, /correo o teléfono/);

  const invalidSystem = await invoke({
    body: JSON.stringify(validPayload({ sistema: "Otro sistema" })),
  });
  assert.equal(invalidSystem.statusCode, 400);
});

test("acepta el honeypot sin intentar una entrega", async () => {
  let fetchCalled = false;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true, status: 200 };
  };
  try {
    const response = await invoke({ body: JSON.stringify({ website: "bot" }) });
    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalled, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("entrega un lead válido por webhook", async () => {
  process.env.LEADS_WEBHOOK_URL = "https://example.com/webhook";
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200 });
  try {
    const response = await invoke({ body: JSON.stringify(validPayload()) });
    assert.equal(response.statusCode, 200);
    assert.match(response.json.message, /Recibimos tu solicitud/);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.ok(response.headers["x-request-id"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("clasifica fallas de entrega sin registrar datos personales", async () => {
  process.env.LEADS_WEBHOOK_URL = "https://example.com/webhook";
  const originalFetch = global.fetch;
  const originalInfo = console.info;
  const logs = [];
  global.fetch = async () => ({ ok: false, status: 503 });
  console.info = (line) => logs.push(String(line));
  try {
    const response = await invoke({
      body: JSON.stringify(validPayload({ nombre: "NOMBRE_SENSIBLE", telefono: "555_SENSIBLE" })),
    });
    assert.equal(response.statusCode, 502);
    const combined = logs.join("\n");
    assert.doesNotMatch(combined, /NOMBRE_SENSIBLE|555_SENSIBLE/);
    assert.match(combined, /lead\.delivery/);
  } finally {
    global.fetch = originalFetch;
    console.info = originalInfo;
  }
});
