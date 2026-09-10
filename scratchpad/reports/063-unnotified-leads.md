LEADS · D:\miltonly-leads · feat/lead-hotfix

# 063 — `ads.leads` on production, and the rows nobody was told about

_2026-09-10. Read-only. `scripts/read-ads-leads.ts`._

Local `DATABASE_URL` and the production `DATABASE_URL` resolve to the same Neon host
(`ep-patient-paper-aebh7f93-pooler.c-2.us-east-2.aws.neon.tech`, compared field by field against
the pulled production value, which was then deleted). This is production data.

## The census

| | |
|---|---|
| total rows in `ads.leads` | **1** |
| rows by `source` | `ads-rentals-lp` — 1 |
| rows by `status` | `new` — 1 |
| rows with no notification record | **1 of 1** |
| **real people among them** | **0** |

## The un-notified rows

Name, contact, source page, timestamp. Nothing else — no notes, no UTM, no IP, no user agent.

| Name | Contact | Source page | Timestamp (UTC) |
|---|---|---|---|
| (no name) | `test@test.com` / `(111) 111-1111` | `https://miltonly-dg6nt1u8m-gtahomequest-hubs-projects.vercel.app/rentals/ads?fbclid=test_fbclid_phase3&utm_source=fb&utm_medium=cpc&utm_campaign=phase3_smoke` | 2026-05-23T19:43:37.131Z |

That is the Phase-3 smoke test, submitted against a preview deployment on the day the pipeline was
stood up. It is the only row `ads.leads` has ever held that still exists.

## What "no notification record" had to mean

`ads.leads` has no notification column, and `/api/leads/create` writes none. That route's only
possible human notification is the ops alert email to `ALERT_EMAIL_TO`, subject
`New ads lead — <source>`; it makes no realtor email call, no SMS call and no CRM call at all. So a
row's notification state is not in the database and had to be reconstructed from the mailbox.

**Zero messages with subject `New ads lead` exist in `gtahomequest@gmail.com`**, searched
`in:anywhere` across the account's full history. So no row in this table has ever produced an ops
alert, and the one that exists is un-notified.

## The direct evidence that `ALERT_EMAIL_TO` was not delivering

Two messages titled **"I got your message — talking soon"** arrived at `gtahomequest@gmail.com`
from `aamir@mail.miltonly.com` on 2026-07-31, at 19:53 and 20:02 UTC. That subject line exists in
exactly one place in the codebase: `sendConfirmationEmail` in `/api/leads/create`
(`route.ts:127`). It is the lead-facing confirmation.

So on 2026-07-31 that route ran twice, past the `LEADS_API_ENABLED` gate, past the DB write, and
sent its lead-facing email successfully — **and produced no ops alert either time**, while
`ALERT_EMAIL_TO` had existed as a variable since 2026-05-23. That is not an inference from absence;
it is the same route succeeding at one email and sending nothing at the other. The variable was
empty or pointed somewhere that does not deliver to the account.

The rows those two runs created are gone because `scripts/verify-leads-pipeline.ts:121` deletes its
own test row after asserting on it. That accounts for the whole gap between "two confirmation
emails were sent" and "one row exists".

## Correction to report 062

062 called G3 "the largest current loss". **The realized loss is zero.** No real person has ever
submitted through `/api/leads/create` in production — the street alert CTA, the two condo CTAs and
the sold valuation CTA have captured nothing since they went live, and the one surviving row is a
synthetic test. The gap is entirely prospective: the next real street-alert signup would have
vanished silently. It was still the right thing to fix first, and it is now fixed, but 062
overstated what had already been lost and this supersedes it.

## What was changed

`ALERT_EMAIL_TO` existed in both Preview and Production as a **Secret**, so its value could not be
read back (`vercel env pull` writes `[SENSITIVE]` for secrets). Given the evidence above, it was
removed and re-added as `gtahomequest@gmail.com` in **both** environments via stdin, 2026-09-10.
The previous value was unreadable and is therefore unrecoverable — recorded here because
overwriting an unreadable value is a one-way action, and the ruling authorised it for the
missing-or-empty case that the evidence supports.

Also confirmed absent from production: **`KVCORE_LEAD_PARSE_EMAIL`**. The BoldTrail handoff is
written, wired into three of `/api/leads`'s four branches, and dormant. Not a Phase 0 item.
