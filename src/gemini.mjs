// Bridge 1: the AI brain. Calls the free Google Gemini API.
// Tries fast models first, waits and retries when a model is busy,
// and falls back to the next model if one is not available for the key.

const API = "https://generativelanguage.googleapis.com/v1beta/";
const PREFERRED = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"];
let modelList = null;
let workingModel = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listModels(key) {
  if (modelList) return modelList;
  let names = [];
  try {
    const res = await fetch(API + "models?pageSize=200", { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(20000) });
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error("Google rejected GEMINI_API_KEY. Check the key in your .env file.");
    }
    if (res.ok) {
      const j = await res.json();
      names = (j.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => String(m.name).replace(/^models\//, ""));
    }
  } catch (e) {
    if (/rejected/.test(e.message)) throw e;
  }
  const ordered = PREFERRED.filter((n) => names.includes(n));
  modelList = ordered.length ? ordered : PREFERRED.slice();
  return modelList;
}

async function callOnce(key, model, prompt, noThinkingConfig) {
  const body = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8 } };
  if (!noThinkingConfig && /^gemini-2\.5-flash/.test(model)) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetch(API + "models/" + model + ":generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) {
    let msg = "";
    try { msg = (await res.json()).error?.message || ""; } catch {}
    const err = new Error(msg || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const j = await res.json();
  const parts = j.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
  if (!text) throw Object.assign(new Error("empty reply"), { status: "empty" });
  return text;
}

export async function generate(prompt, { onModel } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is missing. Add it to the .env file.");
  const models = await listModels(key);
  const order = workingModel ? [workingModel, ...models.filter((m) => m !== workingModel)] : models;
  const tried = [];
  for (const model of order.slice(0, 4)) {
    let noThink = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      onModel && onModel(model);
      try {
        const text = await callOnce(key, model, prompt, noThink);
        workingModel = model;
        return { text, model };
      } catch (e) {
        const m = String(e.message).toLowerCase();
        tried.push(`${model}: ${e.message}`);
        if (e.status === 400 && /thinking/.test(m) && !noThink) { noThink = true; continue; }
        if (e.status === 401 || e.status === 403 || /api key not valid/.test(m)) throw new Error("Google rejected GEMINI_API_KEY. Check the key in your .env file.");
        if (e.status === 429 || e.status === 503 || e.status === 500 || /overloaded|unavailable/.test(m)) { await sleep(4000 * (attempt + 1)); continue; }
        break; // model missing, timeout or empty: try the next model
      }
    }
  }
  throw new Error("Gemini did not answer. Tried: " + tried.slice(-4).join(" | "));
}
