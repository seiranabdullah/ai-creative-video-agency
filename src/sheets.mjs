// Bridge 2: Google Sheets + Gmail.
// Sends data to a Google Apps Script web app (apps-script/Code.gs).
// The web app writes rows into the shared Google Sheet ledger and sends the email.

import { color } from "./env.mjs";

export async function postToBridge(payload) {
  const url = process.env.SHEET_WEBHOOK_URL;
  if (!url) {
    console.log(color.yellow("   ! SHEET_WEBHOOK_URL is empty in .env, so nothing was sent to Google Sheets."));
    return { ok: false, skipped: true };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // Apps Script reads the raw body
    body: JSON.stringify({ secret: process.env.SHEET_SECRET || "", ...payload }),
    redirect: "follow",
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { ok: false, error: text.slice(0, 200) }; }
  if (!data.ok) throw new Error("Google Apps Script said: " + (data.error || "unknown error"));
  return data;
}

export async function logRow({ timestamp, agent, task, status }) {
  return postToBridge({ action: "log", rows: [[timestamp, agent, task, status]] });
}

export async function sendEmail({ to, subject, html, text }) {
  return postToBridge({ action: "email", to, subject, html, text });
}
