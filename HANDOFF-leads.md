# Handoff — leads worktree

LEADS · D:\miltonly-leads · fix/lead-hotfix

_Last rewritten 2026-09-10, after Phase 0 merged to main and production was verified on it._

## READ THIS FIRST

**Phase 0 is MERGED and live.** `main` fast-forwarded to **`c4a162b`**, production serves it on the
apex, battery **`PASS · 9 checks · 444 pages · 56s`** at the full SHA. Phase 1 has not started and
begins only on an explicit prompt.

**`ALERT_EMAIL_TO` is now `gtahomequest@gmail.com` in Production and Preview, and it works.** Three
ops alerts landed during the Phase 0 proof, the first messages with subject `New ads lead` in the
account's entire history. Before this, that variable existed in both environments as a **Secret**
whose value could not be read back, and the evidence said it was not delivering: on 2026-07-31
`/api/leads/create` ran twice and its lead-facing confirmation ("I got your message — talking soon",
a subject that exists at `route.ts:127` and nowhere else) arrived both times while no ops alert
did. The old value is unrecoverable, which is recorded because overwriting an unreadable value is a
one-way action.

**`ads.leads` holds exactly ONE row and always has.** A Phase-3 smoke test, `test@test.com`,
2026-05-23, submitted from a preview URL. **No real person has ever submitted through
`/api/leads/create` in production** — not the street alert CTA, not either condo CTA, not the sold
valuation CTA. Report 062 called the notification gap "the largest current loss"; the realized loss
is **zero** and 063 supersedes that sentence. The gap was entirely prospective.

**Preview writes to the production database.** `DATABASE_URL` is one value for Production and
Preview and resolves to the same Neon host, verified field by field. The one historical row proves
it: it came from a preview deployment. Every test row created during Phase 0 was deleted with
`scripts/delete-ads-lead.ts`; the table is back to that single row. **Any lead test on preview
lands in production data — delete what you create.**

**`/api/leads/create` accepts unauthenticated writes with no honeypot and no rate limit.** A plain
`curl` against a Vercel-protected preview deployment wrote a row into the production table. That is
the shape of the route as it stands, and it is a Phase 1 item, not a Phase 0 regression.

**Neither form fixed in Phase 0 is rendered by any page.** `ExitIntent` and `CornerWidget` are
referenced only by `globals.css` and their own files; `street-data.ts` builds `cornerWidget` props
that no `.tsx` consumes. So the two broken forms were never reachable by a visitor, and the fix is
correctness for whenever they are mounted, not a live bleed that was stopped. **Mounting them is a
street-page composition decision and was deliberately not made here.** The proof below is therefore
at the route, with the components' own payloads, which is everything except rendering.

## Where things stand

| | |
|---|---|
| `main` | **`c4a162b`** (fast-forwarded, no merge commit) |
| production | **`miltonly-gyv7dgpcl`**, serving `c4a162b`, confirmed on the apex through `/api/build` |
| battery on production | **`PASS · 9 checks · 444 pages · 56s`**, at the full SHA `c4a162b033eaab81f4a68ea767eb441b47e8a0c1` |
| battery on preview | **`PASS · 9 checks · 444 pages · 62s`**, `miltonly-pqyzb9jz1`, served == expected |
| local build | exit 0, zero `P2024`, **19/19 prebuild**, 546 static pages |
| `ads.leads` rows | **1** (the 2026-05-23 smoke test; every test row created here was deleted) |
| Phase 0 | **done** |
| Phase 1 | not started |

## What happened 2026-09-10 — Phase 0

**Ruling 1.** `ALERT_EMAIL_TO` was present in Preview and Production but unreadable. Removed and
re-added as `gtahomequest@gmail.com` in both via stdin. Also confirmed absent from production:
**`KVCORE_LEAD_PARSE_EMAIL`** — the BoldTrail handoff is written, wired into three of
`/api/leads`'s four branches, and dormant.

**Ruling 2.** `scripts/read-ads-leads.ts` censused production: 1 row, `ads-rentals-lp`, status
`new`, un-notified. `ads.leads` has no notification column and `/api/leads/create` writes none, so
notification state had to be reconstructed from the mailbox — zero `New ads lead` messages had ever
arrived. Rows listed in `scratchpad/reports/063-unnotified-leads.md` with only the four fields the
ruling names. One summary email sent through the existing Resend path,
`scripts/mail-unnotified-leads.ts --send`, Resend id `dd5983dd-604a-43b1-a419-43529cf7c293`.

**Ruling 3.** Both forms repointed at `/api/leads/create`, the ingress that exists, rather than
creating `/api/alerts/subscribe` — a fifth ingress route that Phase 1 would immediately delete.

- `ExitIntent` posted natively to `/api/alerts/subscribe`, which has never existed, so every
  submission navigated the visitor to a 404. It now posts JSON, holds the dialog open through the
  submit so the outcome is visible, and stamps the seven-day cooldown **only on a confirmed write**
  so a failure does not burn the visitor's one showing.
- `CornerWidget` posted a form-encoded body to `/api/leads`, whose first statement is
  `request.json()`; every submission returned 500 and the browser rendered that JSON in place of the
  page. It now posts JSON.
- `src/lib/postLeadClient.ts` is one shape in one place. The same twelve-line fetch was already
  copied into `StreetAlertCTA`, `CondoCTAs` and `SoldValuationCTA`; these two would have made five.
  It resolves true **only** when the route confirmed the write, so no caller can render a
  confirmation it did not earn.
- Both components said `streetShort` in prose ("Before you leave …", "Private access to …"). Both
  now carry `streetName`, in the copy and in the captured field. `streetShort` survives only as a
  localStorage key.

**Proof, one submission per component shape.** On preview `miltonly-pqyzb9jz1`, then once more on
production, each returning `200 {"ok":true,"lead_id":…}`, each writing its row, each producing an
ops alert:

| Source | Row | Alert | Value |
|---|---|---|---|
| `street-exit-intent` (preview) | `dcd16171-cd48-498d-8936-4de905dff0c3` | 08:20:02Z | CAD 200 |
| `street-corner-widget` (preview) | `7d476b73-2518-4b22-b7e8-ea855afeb03e` | 08:20:02Z | CAD 500 |
| `street-exit-intent` (production) | `79e33cc0-55b4-4dc9-afa6-70c6a1d76909` | 08:26:30Z | CAD 200 |

All four test rows (including one flag probe) deleted; `REMAINING 1`.

**The values are the reason for the intent vocabulary.** `estimateLeadValue` understands only
`rent | buy | sell`. `buy` scored CAD 200 and `sell` CAD 500 above **because the new code sends
those tokens**. The older surfaces send `"buyer"`, which falls through to **0** and ships a
meaningless signal to Meta's optimizer. `postLeadClient` types the field so a new caller cannot
repeat it. Fixing the three existing callers is a Phase 1 item.

## Traps

- **Preview writes to production data.** See above. Delete what you create.
- **The `name-prose` prebuild guard reads string literals, not just page copy.** It failed the
  first build on an em-dash inside a `notes:` template string. Comments are tolerated; anything that
  can reach a row or a page is not.
- **Two tables, no join key.** `public.Lead` (85 columns, consent, scoring, `LeadActivity`) and
  `ads.leads` (21 columns, no consent). `LeadCaptureForm` deliberately writes both.
- **`/api/leads` has a honeypot and a rate limit; `/api/leads/create` has neither.** Every surface
  moved onto the newer route lost both protections.
- **The confirmation email is wrong for an alert signup.** Someone who ticked a street-alert box
  receives "I'll personally review your request and reply within the hour". Proven again during the
  Phase 0 test. G6, Phase 1.
- **`vercel env pull` writes `.env.local` by default.** It would overwrite this worktree's file.
  Always pass an explicit path outside the repo, and delete the pulled file afterwards.
- **`StreetAlertCTA` takes a `shortName` prop.** `sections.tsx:663` passes `data.name` into it, so
  nothing leaks today. The prop name is the trap.

## Scope of this worktree

Lead capture site-wide: the `/sell` valuation flow, street alerts, daily-brief signup, thank-you
states, the emails they trigger, and the CRM handoff. It **never** touches street pages,
generation, the homepage, or the header and footer. Shared lib functions may be read by new routes;
they are not modified here. Phase 0 changed two components that live under `src/components/street/`
because they are lead forms and the ruling named them; it changed nothing that any street page
renders.

## Next

**Phase 1 begins only on an explicit prompt**: one `Lead` model, the single submission path, the
three confirmation emails, `SavedSearch` and its missing cron entry, leads-per-page readable by the
Brain, the CRM handoff on every path, and the daily brief. The gap list it works from is G1 to G11
in `scratchpad/reports/062-leads-gate-a.md`, as corrected by `063`.

Open questions that belong to someone else: whether `ExitIntent` and `CornerWidget` should be
mounted at all, and whether `KVCORE_LEAD_PARSE_EMAIL` gets set.
