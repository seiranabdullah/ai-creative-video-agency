// Agent 8: the Project Manager (Chief of Staff).
// Audits the other 7 agents' runs for today, writes the daily brief,
// logs itself in the Google Sheet and emails the brief.
//   node src/project-manager.mjs          (add --demo to skip Gemini, --no-email to skip the email)
import fs from "node:fs";
import path from "node:path";
import { loadEnv, loadConfig, timestamp, today, color, ROOT } from "./env.mjs";
import { ORDER, AGENTS } from "./agents.mjs";
import { readRuns, appendRun, dayDir } from "./runlog.mjs";
import { generate } from "./gemini.mjs";
import { logRow, sendEmail } from "./sheets.mjs";

loadEnv();
const cfg = loadConfig();
const demo = process.argv.includes("--demo");
const noEmail = process.argv.includes("--no-email");
const pm = cfg.agents.find((a) => a.id === "project-manager");

console.log(color.bold(color.blue(`\n▶ ${pm.name}`)) + color.dim(`  (employees/project-manager, base kit: ${pm.kit})`));
console.log(color.dim("   Task: Audit all 7 agents, update the Google Sheet ledger, email the daily brief"));

// 1. Audit: the latest run of each agent today.
const runs = readRuns();
const latest = {};
for (const r of runs) if (r.id !== "project-manager") latest[r.id] = r;
const rows = ORDER.map((id) => {
  const meta = cfg.agents.find((a) => a.id === id);
  const r = latest[id];
  return { id, agent: meta.name, task: r ? r.task : AGENTS[id].task, status: r ? r.status : "Not run today", time: r ? r.timestamp.slice(11, 16) : "-", file: r ? r.file : "-" };
});
const done = rows.filter((r) => r.status.startsWith("Done")).length;
const failed = rows.filter((r) => r.status.startsWith("Failed")).length;
const missing = rows.filter((r) => r.status === "Not run today").length;
console.log(`   Audit: ${color.green(done + " done")}, ${color.red(failed + " failed")}, ${color.yellow(missing + " not run")}`);

// 2. Next steps from the AI (short), based on the audit.
let nextSteps = ["Review today's drafts in the outputs folder.", "Approve Video 1 script before filming.", "Rerun any agent that failed."];
let model = "demo";
if (!demo) {
  try {
    const prompt = `You are the Project Manager of "${cfg.agency}" working for the client ${cfg.client.brand} (goal: ${cfg.client.goal}).\nToday's team status:\n${rows.map((r) => `- ${r.agent}: ${r.status} (${r.task})`).join("\n")}\n\nWrite exactly 3 short next steps for tomorrow, in simple English, one per line, no numbering, no extra text.`;
    const r = await generate(prompt, { onModel: (m) => process.stdout.write(color.dim(`   Thinking with ${m}...\n`)) });
    const lines = r.text.split("\n").map((l) => l.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean).slice(0, 3);
    if (lines.length) nextSteps = lines;
    model = r.model;
  } catch (e) {
    console.log(color.yellow("   ! Could not get next steps from Gemini, using default ones: " + e.message.slice(0, 80)));
  }
}

// 3. Write the brief (Markdown file + HTML email).
const date = today();
const md = [
  `# Daily Brief, ${date}`,
  `**${cfg.agency}** · Client: **${cfg.client.brand}**`,
  "",
  `Summary: ${done} of 7 agents done, ${failed} failed, ${missing} not run.`,
  "",
  "| Time | Agent | Task performed | Status | Output |",
  "|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.time} | ${r.agent} | ${r.task} | ${r.status} | ${r.file} |`),
  "",
  "## Next steps",
  ...nextSteps.map((s) => `- ${s}`),
  "",
].join("\n");
const briefFile = path.join(dayDir(), "00-daily-brief.md");
fs.writeFileSync(briefFile, md);
fs.writeFileSync(path.join(ROOT, "outputs", "brief-latest.md"), md);
console.log(color.green("   ✔ ") + "Created " + path.relative(ROOT, briefFile).replace(/\\/g, "/"));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const statusColor = (s) => (s.startsWith("Done") ? "#1D7A52" : s.startsWith("Failed") ? "#B0352D" : "#A8701A");
const html = `<div style="font-family:Arial,sans-serif;color:#1F2A44;max-width:720px">
<h2 style="margin:0 0 4px">Daily Status Bulletin · ${date}</h2>
<p style="margin:0 0 14px;color:#4B5670">${cfg.agency} · Client: <b>${cfg.client.brand}</b></p>
<p style="font-size:15px"><b style="color:#1D7A52">${done} done</b> · <b style="color:#B0352D">${failed} failed</b> · <b style="color:#A8701A">${missing} not run</b></p>
<table style="border-collapse:collapse;width:100%;font-size:13px">
<tr style="background:#EEF2FA"><th align="left" style="padding:6px">Time</th><th align="left" style="padding:6px">Agent</th><th align="left" style="padding:6px">Task performed</th><th align="left" style="padding:6px">Status</th></tr>
${rows.map((r) => `<tr><td style="padding:6px;border-top:1px solid #E1E6F3">${r.time}</td><td style="padding:6px;border-top:1px solid #E1E6F3"><b>${r.agent}</b></td><td style="padding:6px;border-top:1px solid #E1E6F3">${esc(r.task)}</td><td style="padding:6px;border-top:1px solid #E1E6F3;color:${statusColor(r.status)}"><b>${esc(r.status)}</b></td></tr>`).join("\n")}
</table>
<h3 style="margin:18px 0 6px">Next steps</h3>
<ul>${nextSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
<p style="color:#7A849C;font-size:12px">Sent automatically by the Project Manager agent.${process.env.SHEET_URL ? ` Ledger: <a href="${process.env.SHEET_URL}">Google Sheet</a>` : ""}</p>
</div>`;

// 4. Log the Project Manager's own row and send the email.
const pmStatus = failed ? "Done (team has failures)" : "Done";
const record = { timestamp: timestamp(), agent: pm.name, id: "project-manager", task: `Audited ${rows.length} agents, wrote and emailed the daily brief`, status: pmStatus, file: path.relative(ROOT, briefFile).replace(/\\/g, "/"), model };
appendRun(record);
try {
  const r = await logRow(record);
  if (!r.skipped) console.log(color.green("   ✔ Logged to Google Sheet"));
} catch (e) {
  console.log(color.red("   ✖ Google Sheet: " + e.message));
}

if (noEmail) console.log(color.dim("   Email skipped (--no-email)."));
else {
  const to = process.env.REPORT_EMAIL || cfg.report_email;
  try {
    const r = await sendEmail({ to, subject: `[${cfg.client.brand}] Daily Status Bulletin ${date}: ${done}/7 done`, html, text: md });
    if (!r.skipped) console.log(color.green("   ✔ Email sent") + color.dim(to ? ` to ${to}` : " to the Sheet owner"));
  } catch (e) {
    console.log(color.red("   ✖ Email: " + e.message));
  }
}
console.log(color.bold("\nProject Manager finished.\n"));
