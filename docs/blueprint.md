# Blueprint

Cross-cutting spec for the recruiting pipeline: field mappings, regex, and error-handling rules that every scenario builds against. This doc is the source of truth — each scenario's MVP implements a slice of it.

## Design principles (apply to all scenarios)

1. **Dedup-before-write** — always check for an existing record (matched on a stable key, e.g. candidate email) before writing. Match found → update in place. No match → insert new.
2. **Visible error logging** — never drop a record that fails to parse. Log it with enough context (timestamp, subject/source, what was missing) so a human can resolve it manually.

## Scenario 1 — Email sync

**Input:** raw recruiting-inbox email (From / Subject / body).

**Field mapping (regex extraction):**

| Field | Regex | Required? |
|---|---|---|
| Name | `/Candidate:\s*(.+)/i` | Yes |
| Email | `/Email:\s*([\w.+-]+@[\w-]+\.[\w.-]+)/i` | Yes |
| Role | `/Role:\s*(.+)/i` | No |
| Department | `/Department:\s*(.+)/i` | No |
| Stage | `/Stage:\s*(.+)/i` | No — defaults to `Applied` on new rows |
| Subject | `/Subject:\s*(.+)/i` | No (used for error log context) |
| From | `/From:\s*(.+)/i` | No (used for error log context) |

**Dedup key:** candidate email, matched against the tracking sheet.

- Match found → update existing row (name, role, department, stage refreshed; `updated` date stamped).
- No match → insert new row with defaults for any missing optional field (`—` or `Applied`).

**Error handling:** if `name` or `email` can't be extracted, nothing is written to the sheet. The failure is logged with timestamp, subject, sender, and the list of missing fields — flagged for manual entry rather than silently dropped.

**Status:** built and tested in [`scenario-1-email-sync/scenario1-email-parser-mvp.html`](../scenario-1-email-sync/scenario1-email-parser-mvp.html).

## Scenario 2 — Calendar sync

Not started. Spec TBD — will define the calendar event → pipeline record field mapping and dedup key once scoped.

## Scenario 3 — Referral intake

Not started. Spec TBD — will define the referral-form → pipeline record field mapping and dedup key once scoped.

## Scenario 4 — Morning digest

Not started. Spec TBD — will define the digest's data sources and summarization/error-reporting rules once scoped.
