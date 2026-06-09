# Conectar leads de Janco a Google Sheets

El formulario de `janco.tech` ya puede mandar cada lead a un webhook usando la variable `LEADS_WEBHOOK_URL`.

## 1. Crear la hoja

Crea una hoja de Google Sheets con estas columnas en la primera fila:

```text
fecha,nombre,empresa,email,telefono,sistema,mensaje,pagina,utm_source,utm_medium,utm_campaign
```

## 2. Crear Apps Script

En la hoja, abre `Extensiones > Apps Script` y pega este código:

```js
const SHEET_NAME = "Leads";
const SECRET = "cambia-este-secreto";

function doPost(e) {
  const secret = e.parameter.secret || "";
  if (secret !== SECRET) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const lead = JSON.parse(e.postData.contents || "{}");
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);

  sheet.appendRow([
    lead.fecha || new Date().toISOString(),
    lead.nombre || "",
    lead.empresa || "",
    lead.email || "",
    lead.telefono || "",
    lead.sistema || "",
    lead.mensaje || "",
    lead.pagina || lead.origen || "",
    lead.utm_source || "",
    lead.utm_medium || "",
    lead.utm_campaign || "",
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 3. Publicar el webhook

En Apps Script:

1. `Implementar > Nueva implementación`
2. Tipo: `Aplicación web`
3. Ejecutar como: `Yo`
4. Acceso: `Cualquier usuario`
5. Copia la URL de la aplicación web.

## 4. Guardar la URL en Vercel

Usa la URL con el secreto como query string:

```bash
printf '%s' 'https://script.google.com/macros/s/TU_ID/exec?secret=cambia-este-secreto' | npx vercel env add LEADS_WEBHOOK_URL production
```

Después redeploy:

```bash
npx vercel deploy --prod --yes
```

El correo interno y la auto-respuesta seguirán funcionando aunque el webhook de Google Sheets falle temporalmente.
