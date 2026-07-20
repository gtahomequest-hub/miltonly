# Miltonly Status Brief - 2026-07-19 (for external planning session)

Main HEAD: ff03179 (2026-07-19). Working tree clean. No unmerged local branches.

## STALENESS WARNING (read first)
- CHANGELOG-DECISIONS.md has ZERO entries after 2026-04-28. AI-BRIEFING.md is dated 2026-04-28.
  ~80 commits shipped since. Git log is the only reliable record; both docs are badly stale.
- These question premises have NO repo record anywhere (docs, code, commits): "4-hour regen cron",
  "Track 2 Pass 1.5 / Pass 2", "scott-boulevard price-pairing failure", "25 Hotspot Hubs",
  "Ineligible-Streets grounding" (as a named item), "Per-Street Monthly Updates Blog".
  They likely live in Notion. The repo can neither confirm nor refute them.

## 1. Coverage
- Street pages: "~900 pages" per street-title commit (2026-07-18); docs say "700+" (stale);
  sitemap universe is 550 URLs total; GSC baseline 246/550 indexed (2026-07-18 audit).
  A precise published-vs-universe street count is NOT documented anywhere; counts contradict.
- No 4-hour regen cron exists. vercel.json today: generate HOURLY (0 * * * *), regenerate-stale
  weekly Sun 12:00 UTC. AI-BRIEFING's cron table (generate 10:05 daily) is stale.

## 2. Track 2
- Only mention in the entire repo: docs/phase-4.1/02b-market-prompt.md:227 "(Track 2 Pass 1)".
  No Pass 1.5, no Pass 2, no scott-boulevard anywhere. Status unknowable from the repo - flag
  for Notion lookup. Nothing in git suggests either shipped.

## 3. Shipped since 2026-05-27 (from git; none of it is in the changelog)
- Jun 13-18: forest v2 indexes (/neighbourhoods, /condos, mosques/schools), /blog noindex
  placeholder, robots disallow /signin, tenure ingest, /freehold + /condos-guide + /potl hubs.
- Jun 18-22: CompareModule extracted; flagship /compare/freehold-vs-condo; compare on streets.
- Jul 3-6: sold-count future-dating fix; detect-cron tenure fix; /value door-hanger landing
  (24 slugs, noindex); CompareDecisionTool; compare on /listings.
- Jul 17: canonical host flipped www -> APEX; trust claims unified to "235+ families";
  GSC health checks 13-15 merged; hub dead-link fix; pnpm-lock sync (deploys had been failing).
- Jul 18: GSC coverage audit (246/550); GSC keyword report (345 queries); homepage audit fixes +
  "Milton Real Estate Encyclopedia" tagline; mobile hamburger nav + MLS chips; SERP title
  rewrites; street title formula (~900 pages) + hub title formula (22 hubs); generator migrated
  deepseek-chat -> deepseek-v4-flash (deprecation 2026-07-24).
- Jul 18-19: ORGANIC GROWTH LOOP pieces 1-4: SENSE weekly cron (Sun 09:00), Monday digest email,
  /admin/seo approval queue, HMAC-signed admin auth + ACT auto-enqueue (THIN_ENTITY only,
  7 safety gates, cap 10/week, behind ORGANIC_LOOP_ENABLED kill switch). Logo home-link fix.

## 4. In flight
- Nothing. Tree clean, all local branches merged. Last-known blockers (AW- conversion IDs,
  campaign unpause, Twilio A2P 10DLC) are frozen at their 2026-04-28 state in the docs -
  no later repo record of resolution. Verify ads/SMS status in Notion or the ad account.

## 5. Content strategy backlog
- Ineligible-Streets grounding: no repo trace as a named item (a grounding gate DOES exist in
  the street pipeline and was left unchanged by the SEO loop). Status: unknown/pending.
- 25 Hotspot Hubs: no repo trace. Not started in code.
- Per-Street Monthly Updates Blog: NOT started - /blog is an honest noindex placeholder
  (2026-06-14) with no build behind it.

## 6. Review/QA on regenerated content
- New street content: drafts flow through /admin/review (human publish gate) + automated
  validator + grounding gate; SEO-loop actions need human approval in /admin/seo, except ACT
  auto-enqueue (THIN_ENTITY, capped 10/week, audit-logged, kill-switch gated).
- Hourly regen/drain output on EXISTING published rows republishes on validator+grounding pass
  WITHOUT human re-review, per repo evidence. No doc states a human audits regen output.

## 7. Top 3 open items (my read)
1. Doc rot is now operational risk: planning inputs (this session's premises) don't match repo
   reality. Backfill CHANGELOG-DECISIONS May 27 -> today; refresh AI-BRIEFING cron/model/routes.
2. Indexing gap: 246/550 indexed, 239 discovered-not-crawled. Loop pieces 1-4 are live to work
   this; re-run coverage audit --fresh ~2026-07-25 to get the first trend point.
3. Paid-funnel state unknown: last record (Apr 28) says campaign paused on placeholder AW- IDs
   and SMS stubbed on 10DLC. If still true, the lead engine has been idle for ~12 weeks.
