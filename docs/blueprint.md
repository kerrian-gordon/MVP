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

**Error handling:** if `name` or `email` can't be extracted, nothing is written to the sheet. The failure is logged with timestamp, subject, sender, and the list of missing fields — flagged for manual entry rather than silently dropped. The error log includes an inline resolve flow: any missing fields are pre-filled as editable inputs (whatever *did* parse carries over), and saving writes the row the same way a clean parse would. This closes the loop — flagged records don't just sit logged forever, they can be completed and saved manually right where they're surfaced.

**Status:** built and tested in [`scenario-1-email-sync/scenario1-email-parser-mvp.html`](../scenario-1-email-sync/scenario1-email-parser-mvp.html).

## Scenario 2 — Calendar sync

**Input:** calendar event invite (Title / Date / Attendees / Interviewer / Round).

**Field mapping (regex extraction):**

| Field | Regex | Required? |
|---|---|---|
| Title | `/Title:\s*(.+)/i` | No (used for AI name fallback + error log context) |
| Date | `/Date:\s*(.+)/i` | No |
| Attendees | `/Attendees:\s*(.+)/i`, then split on `,` | No — but needed for the primary match path |
| Interviewer | `/Interviewer:\s*(.+)/i` | No |
| Round | `/Round:\s*(.+)/i` | No |

**Matching key:** two-tier candidate lookup — no naming convention on the invite required.

1. **Exact attendee-email match** — for each parsed attendee address, check it against the tracking sheet's candidate emails (case-insensitive). First hit wins. This is the confident, primary path.
2. **AI name fallback** — if no attendee email matches, check whether any known candidate's name appears in the event title. Used for invites sent from a personal address that doesn't match what's on file. Flagged in the UI as needing a quick human glance to confirm, since it's a weaker signal than an exact email match.
3. **No match** — neither path succeeds → treat as unmatched, do not guess.

**Dedup-before-write in practice:** a match (by either method) always updates the existing candidate row (interview date, interviewer, round, stage bumped from `Applied` → `Interview`) — it never inserts a new row. Calendar sync only enriches existing candidate records; new candidates enter the sheet via Scenario 1.

**Error handling:** if neither the email match nor the AI name fallback finds a candidate, nothing is written to the sheet. The failure is logged with timestamp, event title, date, and the parsed attendee list — flagged for manual review rather than silently dropped. The error log includes an inline resolve flow: pick the correct candidate from a dropdown and attach the invite's interview details to their row, which clears the flag. This closes the loop on error handling — flagged records don't just sit logged forever, they can be resolved manually right where they're surfaced.

**Status:** built and tested in [`scenario-2-calendar-sync/scenario2-calendar-sync-mvp.html`](../scenario-2-calendar-sync/scenario2-calendar-sync-mvp.html).

## Scenario 3 — Referral intake

Not started. Spec TBD — will define the referral-form → pipeline record field mapping and dedup key once scoped.

## Scenario 4 — Morning digest

Not started. Spec TBD — will define the digest's data sources and summarization/error-reporting rules once scoped.
