// Local run log: every agent run writes one JSON line here. The Project Manager reads it.
import fs from "node:fs";
import path from "node:path";
import { ROOT, today } from "./env.mjs";

export function dayDir(day = today()) {
  const dir = path.join(ROOT, "outputs", day);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function appendRun(record, day = today()) {
  fs.appendFileSync(path.join(dayDir(day), "runlog.jsonl"), JSON.stringify(record) + "\n");
}

export function readRuns(day = today()) {
  const file = path.join(dayDir(day), "runlog.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export function readOutput(fileName, day = today()) {
  const file = path.join(dayDir(day), fileName);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
