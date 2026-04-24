const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const ENV_PATH = path.join(ROOT, ".env");

loadEnvFile(ENV_PATH);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const AI_ENABLED = hasConfiguredApiKey(OPENAI_API_KEY);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/config") {
      return sendJson(res, 200, {
        aiEnabled: AI_ENABLED,
        model: AI_ENABLED ? OPENAI_MODEL : null,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/analyze-meal") {
      return handleAnalyzeMeal(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/generate-recipes") {
      return handleGenerateRecipes(req, res);
    }

    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`LineaChiara disponibile su http://localhost:${PORT}`);
});

async function handleAnalyzeMeal(req, res) {
  if (!AI_ENABLED) {
    return sendJson(res, 503, {
      error: "OPENAI_API_KEY non configurata. Aggiungila nel file .env per attivare l'analisi AI.",
    });
  }

  const body = await readJsonBody(req);
  const imageDataUrl = body.imageDataUrl;
  const mealType = body.mealType || "pasto";
  const note = body.note || "";
  const profile = body.profile || null;

  if (!isSupportedImageDataUrl(imageDataUrl)) {
    return sendJson(res, 400, {
      error: "Invia un'immagine PNG, JPEG, WEBP o GIF valida come data URL.",
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Sei un nutrizionista virtuale per tracking alimentare. Analizza la foto del pasto e restituisci solo una stima nutrizionale realistica in JSON. Se l'immagine e poco chiara, dichiara assunzioni prudenti. Non dare consigli medici.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildUserPrompt({ mealType, note, profile }),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meal_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              meal_name: { type: "string" },
              confidence: { type: "string", enum: ["bassa", "media", "alta"] },
              ingredients: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    estimated_grams: { type: "number" },
                  },
                  required: ["name", "estimated_grams"],
                },
              },
              totals: {
                type: "object",
                additionalProperties: false,
                properties: {
                  calories: { type: "number" },
                  protein: { type: "number" },
                  carbs: { type: "number" },
                  fat: { type: "number" },
                },
                required: ["calories", "protein", "carbs", "fat"],
              },
              assumptions: {
                type: "array",
                items: { type: "string" },
              },
              summary: { type: "string" },
            },
            required: ["meal_name", "confidence", "ingredients", "totals", "assumptions", "summary"],
          },
        },
      },
      max_output_tokens: 900,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return sendJson(res, response.status, {
      error: "Errore OpenAI durante l'analisi del pasto.",
      details: errorText,
    });
  }

  const payload = await response.json();
  const outputText = payload.output_text || extractOutputText(payload);

  if (!outputText) {
    return sendJson(res, 502, {
      error: "La risposta AI non contiene un output testuale utilizzabile.",
      details: payload,
    });
  }

  let analysis;
  try {
    analysis = JSON.parse(outputText);
  } catch (error) {
    return sendJson(res, 502, {
      error: "La risposta AI non e un JSON valido.",
      details: outputText,
    });
  }

  sendJson(res, 200, {
    model: OPENAI_MODEL,
    analyzedAt: new Date().toISOString(),
    analysis,
  });
}

async function handleGenerateRecipes(req, res) {
  if (!AI_ENABLED) {
    return sendJson(res, 503, {
      error: "OPENAI_API_KEY non configurata. Aggiungila nel file .env per attivare le ricette AI.",
    });
  }

  const body = await readJsonBody(req);
  const ingredients = Array.isArray(body.ingredients) ? body.ingredients.slice(0, 12) : [];
  const goal = body.goal || "balanced";

  if (ingredients.length < 2) {
    return sendJson(res, 400, {
      error: "Invia almeno due ingredienti per generare ricette sensate.",
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Sei uno chef nutrizionale. Genera 3 ricette semplici usando prevalentemente gli ingredienti forniti. Restituisci solo JSON valido con nome, stile, summary, ingredients, steps, calories, protein, carbs e fat per ogni ricetta.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Ingredienti disponibili: ${ingredients.join(", ")}. Focus richiesto: ${goal}.`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recipe_generation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              recipes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    style: { type: "string" },
                    summary: { type: "string" },
                    ingredients: { type: "array", items: { type: "string" } },
                    steps: { type: "array", items: { type: "string" } },
                    calories: { type: "number" },
                    protein: { type: "number" },
                    carbs: { type: "number" },
                    fat: { type: "number" },
                  },
                  required: ["name", "style", "summary", "ingredients", "steps", "calories", "protein", "carbs", "fat"],
                },
              },
            },
            required: ["recipes"],
          },
        },
      },
      max_output_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return sendJson(res, response.status, {
      error: "Errore OpenAI durante la generazione delle ricette.",
      details: errorText,
    });
  }

  const payload = await response.json();
  const outputText = payload.output_text || extractOutputText(payload);

  if (!outputText) {
    return sendJson(res, 502, { error: "La risposta AI non contiene ricette utilizzabili." });
  }

  try {
    const parsed = JSON.parse(outputText);
    return sendJson(res, 200, {
      model: OPENAI_MODEL,
      recipes: parsed.recipes || [],
    });
  } catch (error) {
    return sendJson(res, 502, {
      error: "La risposta AI per le ricette non e un JSON valido.",
      details: outputText,
    });
  }
}

function serveStatic(requestPath, res) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(ROOT, path.normalize(normalizedPath));

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { error: "File not found" });
        return;
      }
      sendJson(res, 500, { error: "Unable to read file" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream" });
    res.end(file);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function isSupportedImageDataUrl(value) {
  return typeof value === "string" && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value);
}

function buildUserPrompt({ mealType, note, profile }) {
  const target = profile?.targetCalories ? `Target calorico giornaliero stimato: ${profile.targetCalories} kcal.` : "";
  const noteLine = note ? `Osservazioni utente: ${note}.` : "Nessuna osservazione utente.";
  return [
    `Analizza questo ${mealType}.`,
    noteLine,
    target,
    "Riconosci le componenti principali del piatto, stima i grammi per ingrediente e restituisci calorie, proteine, carboidrati e grassi totali.",
    "Se non sei sicuro, usa assunzioni prudenti e dichiarale nel campo assumptions.",
  ]
    .filter(Boolean)
    .join(" ");
}

function extractOutputText(payload) {
  const outputs = payload.output || [];
  for (const item of outputs) {
    const content = item.content || [];
    for (const chunk of content) {
      if (chunk.type === "output_text" && typeof chunk.text === "string") {
        return chunk.text;
      }
    }
  }
  return "";
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const file = fs.readFileSync(filePath, "utf8");
  file.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function hasConfiguredApiKey(value) {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  if (!normalized || normalized === "sk-..." || normalized.includes("...")) {
    return false;
  }

  return true;
}
