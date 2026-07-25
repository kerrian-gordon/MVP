# Recruiting Pipeline

Automation MVPs for the recruiting pipeline. Each scenario is a self-contained build proving out one piece of the pipeline before it's wired into Make (or another automation tool). The full cross-cutting spec (field mappings, regex, error-handling) lives in [`docs/blueprint.md`](docs/blueprint.md).

## Status

| Scenario | Folder | Status |
|---|---|---|
| 1. Email sync | [`scenario-1-email-sync/`](scenario-1-email-sync/) | ✅ Built — tested MVP |
| 2. Calendar sync | [`scenario-2-calendar-sync/`](scenario-2-calendar-sync/) | ✅ Built — tested MVP |
| 3. Referral intake | [`scenario-3-referral-intake/`](scenario-3-referral-intake/) | ✅ Built — tested MVP |
| 4. Morning digest | [`scenario-4-morning-digest/`](scenario-4-morning-digest/) | 🟡 Visual mockup only — Apps Script implementation swapped out temporarily |

## Shared design principles

Every scenario in this pipeline follows the same two rules:

1. **Dedup-before-write** — before adding a new row/record, check whether one already exists for that candidate (matched by email or another stable key). If it exists, update it in place; never create a duplicate.
2. **Visible error logging** — if a scenario can't extract what it needs (missing field, unparseable input, etc.), it never fails silently and never drops the record. It flags the failure in a visible error log so it can be handled manually, instead of losing data.

## What's next

- Wire Scenario 1's parsing logic into the real Make module now that field mapping has been validated against sample emails.
- Wire Scenario 2's matching logic into the real Make module now that both match paths (email + AI name fallback) have been validated against sample invites.
- Wire Scenario 3's form-intake logic into the real Make module now that the dedup check has been validated against both new and existing candidates.
- Scenario 4 currently shows a static visual mockup of the Slack digest message rather than the working Apps Script — the real `postMorningDigest()` implementation was swapped out temporarily and will need to be restored (or rebuilt) before this scenario can actually be deployed. The mockup's own caption references an interactive tester (`scenario4-digest-mvp.html`) for exercising the digest-building logic across different day scenarios — that file doesn't exist yet either.

Scenarios 1–3 are built and tested. Scenario 4 is currently a visual-only placeholder. Remaining work is wiring Scenarios 1–3 into live Make modules, and deciding on/rebuilding Scenario 4's real implementation.
