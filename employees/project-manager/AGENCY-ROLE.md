# Project Manager: agency role

Agency: AI Creative & Video Marketing Agency
Client: NovaBrew Coffee
Base kit: chief-of-staff (ai-employees v1.9.0), installed with `npx ai-employees hire chief-of-staff`

## What this employee does
Audit all 7 agents every day, update the shared Google Sheet ledger (Timestamp | Agent Name | Task Performed | Output Status) and email a scannable daily status bulletin.

## How it runs
- Command: `npm run pm`
- Writes its output to `outputs/<date>/`
- Logs one row to the Google Sheet ledger and one line to `outputs/<date>/runlog.jsonl`

## Guardrails (from the base kit)
- Drafts only: nothing is posted, sent to customers or paid without a human click.
- Never creates accounts, enters passwords or accepts terms.
- No real people's names in drafts; placeholders only.
