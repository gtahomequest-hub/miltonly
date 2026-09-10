# Handoff — leads worktree

LEADS · D:\miltonly-leads · feat/leads

_Created 2026-09-10, after the Gate A lead recon. No code written._

## Scope of this worktree

Lead capture site-wide: the `/sell` valuation flow, street alerts, daily-brief signup, thank-you
states, the emails they trigger, and the CRM handoff. It **never** touches street pages,
generation, the homepage, or the header and footer. Shared lib functions may be *read* by new
routes; they are not modified here.

Standing rule: the first line of every report is the worktree folder and branch.

## Where things stand

| | |
|---|---|
| branch | `feat/leads`, forked from `794f96e` |
| state | **Gate A reported, awaiting approval.** No code |
| report | `scratchpad/reports/062-leads-gate-a.md` |
| QUEUE | untouched — leads is not a QUEUE item and was not added to one |

## What the recon found

**Four live ingress routes, two lead tables, one route that does not exist.** `POST /api/leads`
(1,201 lines, four branches) writes `public.Lead` and fires realtor email + SMS + the BoldTrail
parser email. `POST /api/leads/create` (282 lines) writes `ads.leads` and fires Meta CAPI + a
generic confirmation + an ops alert gated on `ALERT_EMAIL_TO`. `/api/off-market-leads` and
`/api/exclusive-inquiry` each write `public.Lead` with their own hand-rolled notifications.
`/api/alerts/subscribe`, which `ExitIntent` posts to, has never existed.

**23 lead surfaces, and 2 of them are broken.** `ExitIntent.tsx:87` posts natively to the
non-existent route; `CornerWidget.tsx:111` posts a form-encoded body to a route that calls
`request.json()`, so the visitor gets a 500 rendered as JSON. Both are the no-dead-buttons class
`StreetAlertCTA` was written to close.

**Every alert promise in the app is unkept.** Five surfaces promise recurring email. Nothing reads
those rows. The only alert sender is `/api/alerts/match`, it reads `SavedSearch` (which no lead
surface creates), **and it has no entry in `vercel.json`** — so it has never run on a schedule
either. "We'll email you the moment a home on X is listed or sold" is currently false on 445
street pages.

**`ads.leads` may notify nobody.** `ALERT_EMAIL_TO` is `""` in `.env.local`; production is
**unverified** (this worktree has no Vercel credentials — `npx vercel env ls` opens a device-login
flow). Nothing in `src/` reads `prisma.adsLead`. If that variable is unset in production, a
`#street-alert` signup is a DB row nobody is told about and nobody looks at. Verify it first: it is
the cheapest fix and the largest current loss.

**The k-gated typical the valuation flow needs already exists.** `buildStreetEnrichment` →
`graduate()` → `PriceBasis{typical,count,window}` + `windowDisclosure()`, floor `K_TYPICAL`,
12-month window preferred with a ~2-year fallback, `null` below k. `/value/[neighbourhood]` already
publishes the neighbourhood-grain version of the same sentence. The street-grain version is
unbuilt; do not compute a second typical.

**The two ladder CTAs both work.** `/sell?street=<resolved name>#valuation` — the anchor exists at
`sell/page.tsx:64`, and `HomeValuationCard:90` reads `?street=` once as the address field's initial
value. `#street-alert` resolves to `StreetAlertCTA` on both street shells. Only the resolved street
name travels; no house number and no figure.

Eleven gaps, G1 to G11, are in the report with file and line references. Read it before touching
anything.

## Traps

- **Two tables, no join key.** `public.Lead` (85 columns, consent, scoring, `LeadActivity`) and
  `ads.leads` (21 columns, no consent). `LeadCaptureForm` deliberately writes both. Adding a
  surface to one of them silently creates a second identity for the same person.
- **`ALERT_EMAIL_TO` and `ENABLE_AUTO_REPLY` are both `""` locally.** A lead submitted on a local
  dev server sends no ops alert and no auto-reply. That is configuration, not a defect, and it also
  means neither path is exercised locally.
- **`KVCORE_LEAD_PARSE_EMAIL` is absent from `.env.local`** and `kvcore.ts` documents "empty →
  silent no-op". The CRM handoff is written and dormant, not missing.
- **`StreetAlertCTA` takes a `shortName` prop.** `sections.tsx:663` passes `data.name` into it, so
  no `shortName` reaches prose today. The prop name is a trap; the rule in `CLAUDE.md` still holds.
- **`/api/sold-stats` is auth + VOW gated.** It is not the source for anything served
  unauthenticated. The street page's own k-gated basis is.

## Next

Await approval of `scratchpad/reports/062-leads-gate-a.md`. The proposed sequence is in its final
section; the first step is verifying one production environment variable, not writing code.
