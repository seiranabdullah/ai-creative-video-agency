// Step 1 of the setup: "hire" the 8 AI employees with the ai-employees installer.
// For each agent it runs:  npx ai-employees hire <kit> --to employees/<agent-id>
// The installer copies the kit and writes employees/<agent-id>/.installed.json.
// Then we add AGENCY-ROLE.md, which turns the base kit into our agency role.
//   node setup/hire-team.mjs
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { loadEnv, loadConfig, color, ROOT, today } from "../src/env.mjs";
import { AGENTS } from "../src/agents.mjs";

loadEnv();
const cfg = loadConfig();
const VERSION = "1.9.0";
// Optional: set AI_EMPLOYEES_CLI to a local clone, e.g. "node C:/code/ai-employees/installer/cli.mjs"
const CLI = process.env.AI_EMPLOYEES_CLI || `npx -y ai-employees@${VERSION}`;

const roleText = (a) => {
  const t = a.id === "project-manager"
    ? "Audit all 7 agents every day, update the shared Google Sheet ledger (Timestamp | Agent Name | Task Performed | Output Status) and email a scannable daily status bulletin."
    : AGENTS[a.id].task + ".";
  return `# ${a.name}: agency role\n\nAgency: ${cfg.agency}\nClient: ${cfg.client.brand}\nBase kit: ${a.kit} (ai-employees v${VERSION}), installed with \`npx ai-employees hire ${a.kit}\`\n\n## What this employee does\n${t}\n\n## How it runs\n- Command: \`${a.id === "project-manager" ? "npm run pm" : `npm run agent -- ${a.id}`}\`\n- Writes its output to \`outputs/<date>/\`\n- Logs one row to the Google Sheet ledger and one line to \`outputs/<date>/runlog.jsonl\`\n\n## Guardrails (from the base kit)\n- Drafts only: nothing is posted, sent to customers or paid without a human click.\n- Never creates accounts, enters passwords or accepts terms.\n- No real people's names in drafts; placeholders only.\n`;
};

console.log(color.bold(`\nHiring the team for ${cfg.agency}`) + color.dim(`  (ai-employees v${VERSION})`));
const summary = [];
for (const a of cfg.agents) {
  const dest = path.join(ROOT, "employees", a.id);
  process.stdout.write(color.blue(`▶ ${a.name.padEnd(30)}`) + color.dim(` kit: ${a.kit.padEnd(32)}`));
  if (fs.existsSync(path.join(dest, ".installed.json"))) {
    console.log(color.yellow("already hired"));
  } else {
    try {
      execSync(`${CLI} hire ${a.kit} --to "${dest}"`, { stdio: "pipe", cwd: ROOT, shell: true });
      console.log(color.green("hired ✔"));
    } catch (e) {
      console.log(color.red("failed ✖"));
      console.log(String(e.stdout || "") + String(e.stderr || ""));
      process.exit(1);
    }
  }
  fs.writeFileSync(path.join(dest, "AGENCY-ROLE.md"), roleText(a));
  // The kit's own .gitignore hides .installed.json; the course submission needs it on GitHub.
  const gi = path.join(dest, ".gitignore");
  if (fs.existsSync(gi)) {
    const lines = fs.readFileSync(gi, "utf8").split(/\r?\n/);
    if (lines.includes("/.installed.json")) {
      fs.writeFileSync(gi, lines.map((l) => (l === "/.installed.json" ? "# /.installed.json  (kept in git: it is the install receipt for the course submission)" : l)).join("\n"));
    }
  }
  const receipt = JSON.parse(fs.readFileSync(path.join(dest, ".installed.json"), "utf8"));
  summary.push({ agent: a.name, id: a.id, kit: receipt.slug, version: receipt.version, installed_on: receipt.installed_on, files: Object.keys(receipt.files).length, receipt: `employees/${a.id}/.installed.json` });
}
fs.writeFileSync(path.join(ROOT, "employees", "team.installed.json"), JSON.stringify({ agency: cfg.agency, client: cfg.client.brand, created: today(), employees: summary }, null, 2) + "\n");
console.log(color.green(`\n✔ ${summary.length} employees hired. Receipts: employees/<agent>/.installed.json, summary: employees/team.installed.json\n`));
