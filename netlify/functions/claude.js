// netlify/functions/claude.js
// ─────────────────────────────────────────────────────────────
// Proxy seguro para la API de Anthropic.
// La API key NUNCA aparece en el frontend — vive solo aquí,
// cargada desde las variables de entorno de Netlify.
//
// Configuración en Netlify:
//   Site settings → Environment variables → Add variable
//   Nombre:  ANTHROPIC_API_KEY
//   Valor:   sk-ant-...  (tu key de console.anthropic.com)
// ─────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  // Solo aceptar POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método no permitido" }),
    };
  }

  // Verificar que la key existe en el entorno
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "API key no configurada. Agrégala en Netlify → Environment variables.",
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Body inválido — se esperaba JSON." }),
    };
  }

  // Validaciones mínimas para evitar abuso
  if (!body.messages || !Array.isArray(body.messages)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "El campo 'messages' es requerido." }),
    };
  }

  // Límite de seguridad: máximo 4000 caracteres en el prompt
  const totalChars = body.messages
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("").length;

  if (totalChars > 4000) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "El contenido excede el límite permitido (4000 caracteres).",
      }),
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-4-6",
        max_tokens: body.max_tokens || 1000,
        system:
          body.system ||
          "Eres un asistente que analiza listas de materiales y catálogos de productos. Responde siempre en JSON válido sin bloques de código ni explicaciones extra.",
        messages: body.messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data.error?.message || "Error en la API de Anthropic.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // Permite llamadas solo desde tu mismo dominio en producción.
        // Cambia "*" por "https://cotizarapido.mx" al tener dominio propio.
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error interno del servidor: " + err.message,
      }),
    };
  }
};
