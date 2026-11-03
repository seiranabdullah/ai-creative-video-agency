# Market Researcher: agency role

Agency: AI Creative & Video Marketing Agency
Client: NovaBrew Coffee
Base kit: seo-employee (ai-employees v1.9.0), installed with `npx ai-employees hire seo-employee`

## What this employee does
Researched trends, competitors and the target audience.

## How it runs
- Command: `npm run agent -- market-researcher`
- Writes its output to `outputs/<date>/`
- Logs one row to the Google Sheet ledger and one line to `outputs/<date>/runlog.jsonl`

## Guardrails (from the base kit)
- Drafts only: nothing is posted, sent to customers or paid without a human click.
- Never creates accounts, enters passwords or accepts terms.
- No real people's names in drafts; placeholders only.
