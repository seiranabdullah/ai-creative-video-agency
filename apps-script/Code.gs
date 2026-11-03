/**
 * AI Creative & Video Marketing Agency: Google Sheets + Gmail bridge.
 *
 * Paste this file into Extensions > Apps Script of your Google Sheet, then:
 *   1. Run setup() once (it creates the "Ledger" tab and the daily email trigger).
 *   2. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 *   3. Copy the web app URL into SHEET_WEBHOOK_URL in the project's .env file.
 *
 * The Node scripts call this web app:
 *   { action: "log",   rows: [[timestamp, agent, task, status], ...] }  -> adds rows to the ledger
 *   { action: "email", to, subject, html, text }                       -> sends the Project Manager's brief
 * A time trigger also runs dailyReport() every evening, so a bulletin arrives every day.
 */

const SHEET_NAME = "Ledger";
const HEADERS = ["Timestamp", "Agent Name", "Task Performed", "Output Status"];
const SECRET = ""; // optional: put the same text in SHEET_SECRET in .env
const REPORT_HOUR = 20; // daily bulletin time (the Sheet's time zone)

function setup() {
  const sheet = getLedger_();
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "dailyReport")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("dailyReport").timeBased().everyDays(1).atHour(REPORT_HOUR).create();
  sheet.getRange("A1").setNote("Filled automatically by the AI agents.");
  return "Setup done: Ledger tab ready, daily trigger at " + REPORT_HOUR + ":00.";
}

function getLedger_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#DCE5FB");
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 1, 170);
    sheet.setColumnWidths(2, 1, 210);
    sheet.setColumnWidths(3, 1, 380);
    sheet.setColumnWidths(4, 1, 200);
  }
  return sheet;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET && data.secret !== SECRET) return json_({ ok: false, error: "wrong secret" });

    if (data.action === "log") {
      const sheet = getLedger_();
      const rows = (data.rows || []).map((r) => [r[0], r[1], r[2], r[3]]);
      if (!rows.length) return json_({ ok: false, error: "no rows" });
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
      colorStatus_(sheet);
      return json_({ ok: true, added: rows.length });
    }

    if (data.action === "email") {
      const to = data.to || Session.getEffectiveUser().getEmail();
      MailApp.sendEmail({ to: to, subject: data.subject || "Daily Status Bulletin", htmlBody: data.html || "", body: data.text || "" });
      PropertiesService.getScriptProperties().setProperty("lastEmailDate", todayKey_());
      return json_({ ok: true, sent: to });
    }

    return json_({ ok: false, error: "unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, message: "AI agency bridge is running." });
}

/** Runs every evening. Builds a bulletin from today's ledger rows, unless the Project Manager already emailed today. */
function dailyReport() {
  if (PropertiesService.getScriptProperties().getProperty("lastEmailDate") === todayKey_()) return;
  const sheet = getLedger_();
  const tz = Session.getScriptTimeZone();
  const today = todayKey_();
  const values = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues() : [];
  const rows = values.filter((r) => toKey_(r[0], tz) === today);
  const done = rows.filter((r) => String(r[3]).indexOf("Done") === 0).length;
  const failed = rows.filter((r) => String(r[3]).indexOf("Failed") === 0).length;
  const table = rows.length
    ? rows.map((r) => "<tr><td style='padding:5px'>" + esc_(r[0]) + "</td><td style='padding:5px'><b>" + esc_(r[1]) + "</b></td><td style='padding:5px'>" + esc_(r[2]) + "</td><td style='padding:5px'>" + esc_(r[3]) + "</td></tr>").join("")
    : "<tr><td colspan='4' style='padding:5px'>No agent runs were logged today.</td></tr>";
  const html = "<div style='font-family:Arial,sans-serif'><h2>Daily Status Bulletin · " + today + "</h2>" +
    "<p><b>" + rows.length + "</b> runs today · <b style='color:#1D7A52'>" + done + " done</b> · <b style='color:#B0352D'>" + failed + " failed</b></p>" +
    "<table style='border-collapse:collapse;font-size:13px'><tr style='background:#EEF2FA'><th align='left'>Timestamp</th><th align='left'>Agent</th><th align='left'>Task</th><th align='left'>Status</th></tr>" + table + "</table>" +
    "<p style='color:#7A849C;font-size:12px'>Automatic evening bulletin from the Project Manager. <a href='" + SpreadsheetApp.getActiveSpreadsheet().getUrl() + "'>Open the ledger</a></p></div>";
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: "Daily Status Bulletin " + today + ": " + done + " done, " + failed + " failed", htmlBody: html });
  PropertiesService.getScriptProperties().setProperty("lastEmailDate", today);
}

/** Run this by hand once to check that email works. */
function testEmail() {
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "AI agency bridge test", "The Apps Script bridge can send email.");
}

function colorStatus_(sheet) {
  const n = sheet.getLastRow() - 1;
  if (n < 1) return;
  const range = sheet.getRange(2, 4, n, 1);
  const colors = range.getValues().map((r) => [String(r[0]).indexOf("Done") === 0 ? "#1D7A52" : String(r[0]).indexOf("Failed") === 0 ? "#B0352D" : "#A8701A"]);
  range.setFontColors(colors).setFontWeight("bold");
}

function todayKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function toKey_(value, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, "yyyy-MM-dd");
  return String(value).slice(0, 10);
}

function esc_(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
