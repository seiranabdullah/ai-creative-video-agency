// Checks that everything is ready before the first real run.
//   node setup/check-setup.mjs
import fs from "node:fs";
import path from "node:path";
import { loadEnv, loadConfig, color, ROOT } from "../src/env.mjs";

loadEnv();
const cfg = loadConfig();
let problems = 0;
const ok = (m) => console.log(color.green("  ✔ ") + m);
const bad = (m) => { problems++; console.log(color.red("  ✖ ") + m); };

console.log(color.bold("\nSetup check"));
const major = Number(process.versions.node.split(".")[0]);
major >= 18 ? ok(`Node.js ${process.versions.node}`) : bad(`Node.js ${process.versions.node}: version 18 or newer is needed`);

fs.existsSync(path.join(ROOT, ".env")) ? ok(".env file found") : bad(".env file missing: copy .env.example to .env");

const hired = cfg.agents.filter((a) => fs.existsSync(path.join(ROOT, "employees", a.id, ".installed.json")));
hired.length === 8 ? ok("8 employees hired (.installed.json found for each)") : bad(`${hired.length}/8 employees hired: run npm run hire`);

if (!process.env.GEMINI_API_KEY) bad("GEMINI_API_KEY is empty in .env");
else {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=5", { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY }, signal: AbortSignal.timeout(20000) });
    res.ok ? ok("Gemini API key works") : bad(`Gemini API key was rejected (HTTP ${res.status})`);
  } catch (e) { bad("Could not reach Gemini: " + e.message); }
}

if (!process.env.SHEET_WEBHOOK_URL) bad("SHEET_WEBHOOK_URL is empty in .env");
else {
  try {
    const res = await fetch(process.env.SHEET_WEBHOOK_URL, { redirect: "follow", signal: AbortSignal.timeout(30000) });
    const t = await res.text();
    /bridge is running/.test(t) ? ok("Google Apps Script bridge answers") : bad("The web app URL did not answer as expected. Check the deployment access is 'Anyone'.");
  } catch (e) { bad("Could not reach the Apps Script web app: " + e.message); }
}

console.log(problems ? color.red(`\n${problems} problem(s) to fix.\n`) : color.green("\nAll good. Run: npm run daily\n"));
process.exit(problems ? 1 : 0);
