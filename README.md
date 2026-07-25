# Recruiting Pipeline

Automation MVPs for the recruiting pipeline. Each scenario is a self-contained build proving out one piece of the pipeline before it's wired into Make (or another automation tool). The full cross-cutting spec (field mappings, regex, error-handling) lives in [`docs/blueprint.md`](docs/blueprint.md).

## Status

| Scenario | Folder | Status |
|---|---|---|
| 1. Email sync | [`scenario-1-email-sync/`](scenario-1-email-sync/) | ✅ Built — tested MVP |
| 2. Calendar sync | [`scenario-2-calendar-sync/`](scenario-2-calendar-sync/) | ✅ Built — tested MVP |
| 3. Referral intake | [`scenario-3-referral-intake/`](scenario-3-referral-intake/) | ✅ Built — tested MVP |
| 4. Morning digest | [`scenario-4-morning-digest/`](scenario-4-morning-digest/) | ✅ Built — interactive tester + Slack mockup (real Apps Script implementation still swapped out) |

## Shared design principles

Every scenario in this pipeline follows the same two rules:

1. **Dedup-before-write** — before adding a new row/record, check whether one already exists for that candidate (matched by email or another stable key). If it exists, update it in place; never create a duplicate.
2. **Visible error logging** — if a scenario can't extract what it needs (missing field, unparseable input, etc.), it never fails silently and never drops the record. It flags the failure in a visible error log so it can be handled manually, instead of losing data.

## What's next

- Wire Scenario 1's parsing logic into the real Make module now that field mapping has been validated against sample emails.
- Wire Scenario 2's matching logic into the real Make module now that both match paths (email + AI name fallback) have been validated against sample invites.
- Wire Scenario 3's form-intake logic into the real Make module now that the dedup check has been validated against both new and existing candidates.
- Scenario 4 now has an interactive tester (`scenario4-digest-mvp.html`, sample-data toggle for "Typical day" / "Quiet day") that exercises the same digest-building logic client-side, plus a static Slack mockup for visual context. The real Apps Script implementation (`postMorningDigest()`) that would run this against a live `Tracker` tab and post to a real Slack webhook is still swapped out — it exists in git history (see `docs/blueprint.md`) but needs to be restored or rebuilt before this scenario can actually be deployed.

Scenarios 1–3 are built and tested. Scenario 4 has a validated tester but no live deployment yet. Remaining work is wiring Scenarios 1–3 into live Make modules, and restoring/rebuilding Scenario 4's real Apps Script implementation.
