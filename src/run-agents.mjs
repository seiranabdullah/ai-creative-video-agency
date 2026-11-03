// Runs the AI employees.
//   node src/run-agents.mjs            -> all 7 team agents, in order
//   node src/run-agents.mjs copywriter -> one agent
//   add --demo to run without calling Gemini
import fs from "node:fs";
import path from "node:path";
import { loadEnv, loadConfig, timestamp, color, ROOT } from "./env.mjs";
import { AGENTS, ORDER, demoText } from "./agents.mjs";
import { generate } from "./gemini.mjs";
import { logRow } from "./sheets.mjs";
import { appendRun, dayDir, readOutput } from "./runlog.mjs";

loadEnv();
const cfg = loadConfig();
const args = process.argv.slice(2);
const demo = args.includes("--demo");
const wanted = args.filter((a) => !a.startsWith("--"));
const ids = wanted.length ? wanted : ORDER;

for (const id of ids) {
  if (!AGENTS[id]) {
    console.error(color.red(`Unknown agent "${id}". Use one of: ${ORDER.join(", ")}`));
    process.exit(1);
  }
}

async function runAgent(id) {
  const meta = cfg.agents.find((a) => a.id === id);
  const agent = AGENTS[id];
  const started = Date.now();
  console.log("\n" + color.bold(color.blue(`▶ ${meta.name}`)) + color.dim(`  (employees/${id}, base kit: ${meta.kit})`));
  console.log(color.dim(`   Task: ${agent.task}`));

  const prev = {};
  for (const dep of agent.needs) prev[dep] = readOutput(AGENTS[dep].file);
  const missing = agent.needs.filter((d) => !prev[d]);
  if (missing.length) console.log(color.yellow(`   ! Input not ready yet from: ${missing.join(", ")} (working with what is available)`));

  let status = "Done";
  let model = demo ? "demo" : "";
  let text;
  try {
    if (demo) text = demoText(id, cfg);
    else {
      const r = await generate(agent.prompt(cfg, prev), { onModel: (m) => process.stdout.write(color.dim(`   Thinking with ${m}...\n`)) });
      text = r.text;
      model = r.model;
    }
  } catch (e) {
    status = "Failed: " + e.message.slice(0, 120);
    text = `# ${meta.name}\n\nThe run failed: ${e.message}\n`;
  }
  if (missing.length && status === "Done") status = "Done (partial input)";

  const outFile = path.join(dayDir(), agent.file);
  const header = `<!-- ${cfg.agency} | ${meta.name} | ${timestamp()} | model: ${model || "n/a"} -->\n`;
  fs.writeFileSync(outFile, header + text + "\n");
  const rel = path.relative(ROOT, outFile).replace(/\\/g, "/");
  console.log((status.startsWith("Done") ? color.green("   ✔ ") : color.red("   ✖ ")) + `${status} → created ${rel}`);

  const record = { timestamp: timestamp(), agent: meta.name, id, task: agent.task, status, file: rel, model, seconds: Math.round((Date.now() - started) / 1000) };
  appendRun(record);

  try {
    const r = await logRow(record);
    if (!r.skipped) console.log(color.green("   ✔ Logged to Google Sheet"));
  } catch (e) {
    console.log(color.red("   ✖ Google Sheet: " + e.message));
  }
  return record;
}

console.log(color.bold(`\n${cfg.agency}`) + color.dim(`  client: ${cfg.client.brand}${demo ? "  [DEMO MODE]" : ""}`));
for (const id of ids) await runAgent(id);
console.log(color.bold("\nTeam run finished. Next: npm run pm (Project Manager report)\n"));
