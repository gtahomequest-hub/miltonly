# DO-NOT-REPEAT.md — Settled Decisions

> These are final. Do not debate, revisit, or suggest alternatives unless Aamir explicitly reopens them.

---

Milton-only. No GTA expansion. No Halton Region expansion. Milton.

Design system is locked. Never change colours, typography, spacing, or component styles.

All Claude API calls route through `src/lib/ai/compliance.ts` only. No exceptions.

Passwordless auth. No passwords. No NextAuth. No Google OAuth unless explicitly decided.

No placeholder pages. If a page is not ready it does not exist.

No broken links. Ever. Fix immediately.

PropTx raw data never enters a Claude prompt. The database computes. Claude sees the answer only.

`permAdvertise` and `displayAddress` enforced on every listing query. No exceptions.

VOW agreement #1848370 is active as of 2026-04-16. Sold + leased data pipeline is licensed. The 90-day VOW display window is enforced on the read path (`/api/sold`), not at storage — historical rows are retained in `sold.sold_records` forever for DB4 training. Individual records never reach unauthenticated browsers — `VowGate.tsx` is SSR-only and anon users see only pre-computed aggregates.

Always `.trim()` TREB env vars (`TREB_API_TOKEN`, `TREB_API_URL`, `VOW_TOKEN`) at import. Vercel-stored values have been observed with trailing whitespace that corrupts query strings and Authorization headers silently. Every TREB-integration file wraps env reads in `(process.env.X || "").trim()`.

**Always target `https://www.miltonly.com` directly — never the bare `miltonly.com`** — in scripts, CI jobs, and internal API calls that need authentication. The bare apex domain issues a 307 redirect to the `www` subdomain, and `fetch()` strips the `Authorization` header on cross-origin redirects per the Fetch spec (security measure to prevent auth leakage). The script sees the second-hop 401 and cannot distinguish it from a wrong-secret failure — diagnosed 2026-04-17 after the force-regenerate script failed on every call despite a correct `CRON_SECRET`. Same rule applies to `homesly.ca` vs `www.homesly.ca` and to any other domain in the portfolio that uses a `www` canonical — always call the `www` form directly. Query-param auth (`?secret=…`) survives redirects because it rides the URL, not a header, but the fix for authenticated calls is to never redirect in the first place. Never use the bare apex for authenticated automation.

`TREB_API_TOKEN` is IDX-scoped (active listings only). `VOW_TOKEN` is VOW-scoped (closed sales + leases). They are separately licensed. `detect/route.ts` uses IDX. `sync/sold/route.ts` and `sync/sold/test/route.ts` use VOW. Do not cross-wire.

AMPRE `CloseDate` is `Edm.Date` and cannot be used in `$filter`. Only `$select` and `$orderby`. Cursor pagination on sold data uses `ModificationTimestamp` (`Edm.DateTimeOffset`) instead. An `Edm.Date` vs `Edm.DateTimeOffset` literal mismatch returns a 400.

AMPRE field names follow RESO standard. The field is `ListingContractDate`, not `ListDate`. Verify against the Property field reference before guessing new field names — unknown fields in `$select` return `"The property 'X' is not defined in type 'Property'"`.

AMPRE rejects empty-string comparisons like `ListingKey gt ''`. First page of cursor pagination must use only the primary filter with no key tiebreaker; subsequent pages introduce the tiebreaker once a real `ListingKey` exists.

**AMPRE is on OData v4.0, not v4.01. The `in` operator is NOT supported.** `ListingKey in ('X','Y','Z')` returns 400 with `"The property 'n' must not follow a collection"` — the parser reads `ListingKey i n (...)` as property access on a collection. Use `or`-chained `eq`: `ListingKey eq 'X' or ListingKey eq 'Y' or ListingKey eq 'Z'` — same primitive form `sync/sold/route.ts` uses for cursor pagination. Diagnosed 2026-04-17 after the `list_office_name` backfill script failed on all 71 batches.

**AMPRE Elasticsearch `bool`-query clause limit — keep OR-chains short.** AMPRE translates OData `or`-chains into ES `bool`/`must` queries. At 50 terms AMPRE rejects the request with `[bool] failed to parse field [must]` (ES `max_clause_count` exceeded). Safe batch size for `ListingKey eq X or …` filters is **10 terms per request**; 5 if 10 ever fails; 1 is always safe (single `eq`). Diagnosed 2026-04-17 when 140/141 batches failed and the 1 that succeeded was the trailing single-key partial. Pace inter-batch calls at ≥500ms to stay clear of rate limits.

**`null === null` is `true` in staleness comparisons — always guard the non-null side first.** The skip_current branch in `makeStreetDecision` originally returned `"skip_current"` on `currentHash === existing.marketDataHash` which triggered on the double-null case, silently blocking the nightly cron from picking up (a) brand-new streets, (b) rows manually invalidated by nulling `marketDataHash`. Fixed 2026-04-18 at `streetDecision.ts:72`: `if (existing.marketDataHash !== null && currentHash === existing.marketDataHash)`. When writing any future staleness / hash / equality guard, check for `null` explicitly before the equality test. Comment pinned in source at the decision site so the guard isn't "simplified" back out.

**`src/lib/street-content.ts` and `src/lib/generateStreet.ts` are parallel implementations — any Phase N.X compliance change must be applied to BOTH files in sync.** Both write to `StreetContent` via Claude but use different signatures, validator thresholds, and prompt templates. The `metaTitle` column can flip between their two templates depending on which path last wrote. Phase 2.6 was initially applied only to `generateStreet.ts`; `street-content.ts` retained "sold price" in its prompt rule and "Sold Prices" in its metaTitle template until 2026-04-18. TODO comment flagging the consolidation debt is pinned at the top of `street-content.ts`. Tier 2 refactor (fold one into the other, or delete the render-time fallback and handle first-visit in the page component) is deferred but blocks any future compliance pass from being called "complete" while both files exist.

`sold.sold_records` holds both **sales AND leases** (migration 002). Every query against this table must filter by `transaction_type` before aggregating price data. `sold_price` means "final sale price" for `'For Sale'` rows and "monthly rent" for `'For Lease'` rows. Mixing them in an average is nonsense. CHECK constraint on `transaction_type` enforces the values.

Sale compute (`computeStreetSaleStats`) and lease compute (`computeStreetLeaseStats`) are physically separate functions. DB4 prediction engine imports only the sale function. This is how the "no lease data in ML" rule is enforced — at the function boundary, not by application discipline.

When an AMPRE filter returns 0 records, probe before assuming the filter is wrong. Could be token scope, field type mismatch, or string-value variant. `/api/sync/sold/test` runs parallel diagnostic probes (A–D) and returns distinct `MlsStatus`/`StandardStatus`/`TransactionType` strings actually present in the feed.

**K-anonymity threshold for aggregate teasers shown to anon users is 10.** Below 10 underlying records, render a sign-in prompt instead of the aggregate. Do not lower this threshold without a written compliance review. MIN/MAX/AVG look like aggregates but collapse to individual records as n shrinks: n=1 reveals the exact value, n=2 reveals the two extremes, n<5 is trivially back-calculable from one or two known facts (street + date range + property type). k=10 is the floor across the project — street teasers, neighbourhood teasers, any future widget that exposes an aggregate over VOW data to an unauthenticated session. Enforced at query time via `CASE WHEN sold_count_90days >= 10 THEN (subquery) ELSE NULL END` so the aggregate never leaves the database when suppressed.

---

## Milton Intelligence DB (DB4) — rules set before build (2026-04-16)

DB4 is the private prediction-engine datastore (ClickHouse, scheduled for Month 3). These rules are non-negotiable and govern its design; violate any of them and the whole point of DB4 collapses.

**DB4 holds sold records only.** `transaction_type = 'For Sale'` with a populated `CloseDate`. No leases. No active listings. No rentals. The "no lease data in ML" firewall that's already enforced at the DB3 compute-function level extends into DB4 as a hard data-layer rule, not a function-boundary rule.

**DB4 is append-only. Never delete a row. Ever.** Historical completeness is the entire value proposition. VOW 90-day display rules do not apply to storage — they apply to display only. DB4 is storage, not display. Every row is training signal forever.

**DB4 is owner private use only.** The database itself — its rows, its raw queries, its internal feature tables — is the owner's private tool. Features derived from it can reach consumers through pages and APIs; the database behind those features stays private.

**Feature extraction is the only export shape.** DB4 exposes features, not rows. Aggregated features (avg DOM, sold-to-ask ratio, velocity, median by bed count, YoY delta, predicted sale price, value score, probability-of-sale, market-direction signals) are the only shape DB4 data ever takes when leaving the database. Raw rows never leave DB4 for any purpose — not for Claude, not for exports, not for spreadsheets, not for email reports, not for manual inspection, not for anything. If a future task says "the rule was no raw records to Claude, but this is a market report for the owner personally, so it's fine" — the rule still says no. Positive reframe: features out, rows stay.

**DB4 is fed from DB2, not directly from TREB.** One VOW token path. DB2 is the single source of truth for ingested sold data; DB4 is a downstream transformation. Keeps licence audit simple.

**DB4 feature inputs are DB2 snapshots, not live DB2 reads.** When features are computed, record which DB2 rows (by `mls_number` + `modification_timestamp`) contributed to each feature row, and the snapshot timestamp. When TREB later revises a sold record — corrected close price, amended close date, updated `PermAdvertise` flag — the snapshot record identifies exactly which DB4 feature rows are now stale and need recomputation, and which are not. Forward-only schema + versioned feature columns + snapshot inputs = fully reproducible predictions. Miss the snapshot rule and the first TREB correction breaks reproducibility irrevocably.

**DB4 schema evolves forward only.** Add columns for new features. Never restructure or drop historical data to accommodate a new feature.

**Feature computation is versioned.** When an algorithm changes (e.g., `value_score` formula), the output column is versioned (`value_score_v1`, `value_score_v2`) so historical predictions remain traceable to the exact algorithm that produced them.

**Every DB4 write is audit-logged.** Non-negotiable for a private ML store built on VOW-derived data. Maintain an `_ingest_log` table with columns: source (DB2 snapshot ID or sync batch ID), timestamp, row count, content hash of the batch, feature-version applied. Append-only without an audit log is just append-only — append-only *with* an audit log is auditable. If PROPTX ever asks "prove you haven't redistributed VOW data," the log is the answer. Also catches silent sync failures before they rot weeks of training data.

**DB4 → Claude API: NEVER.** Specific application of the feature-extraction rule. Raw sold records and individual feature rows never enter any AI prompt. Aggregated/derived feature summaries only, and only when explicitly scoped to a single consumer request.

PIPEDA consent banner stays. Do not remove it.

Mobile tested on iPhone before every deployment.

90+ PageSpeed before public launch.

`ComplianceLog` table logs every nightly audit. Do not remove this.

Always run `npx next build` before git push. Never rely on `tsc` alone. Vercel serves the old build on failure.

Dark navy (#0A1628) is the primary dark. Brand blue (#2563EB) is for CTAs. Do not introduce new brand colours.

Geist Sans is the only font. Do not add additional font families.

Street pages are AI-generated through the pipeline. Do not manually write street content.

The MLS pipeline runs nightly on cron. Do not change it to on-demand without discussion.

Admin panel is password-protected. Do not expose admin routes publicly.

Lead capture must exist on every public page. No page without a CTA.

School and mosque data is hardcoded in `src/lib/`. Do not move it to the database without discussion.

Cron secrets use the value stored in the `CRON_SECRET` env var [REDACTED — see local notes]. Do not change the secret format without updating all endpoints.

Exclusive listings are entered manually via admin panel. They are not part of the MLS sync.

Maintenance gate (`MAINTENANCE_MODE` in `src/middleware.ts`) stays on until PropTx IDX URL approval for miltonly.com is confirmed. Do not flip it to `false` early. Crons, `/admin`, and `/coming-soon` are the only routes allowed through.

No Inspectionly, no home-inspection step, no inspector partner. Removed 2026-04-14. Do not re-add without explicit owner decision.

---

## Settled rules from 2026-04-28 launch-prep session

**Do not pass `user_data` inline as an event-param property in `gtag('event', …)` for GA4 — the AW- pattern is silently dropped.** GA4's measurement protocol has no inline event-param slot for nested `user_data`; gtag.js drops it during `/g/collect` serialization. Use back-to-back `gtag('set','user_data', userData)` then `gtag('event','generate_lead', payload)` synchronously in the same tick. The "race condition" warning about `gtag('set')` only applies when the set call is far separated in time from the event. Diagnosed 2026-04-28 after `/g/collect` payload showed `ep.transaction_id, epn.value` but no `up.em`/`up.ph`. Three call sites across Miltonly use the corrected pattern (commit `ed43e49`): `ThankYouClient.tsx`, `fireGenerateLead` in `ListingExtras.tsx`, `submitLead` in `ListingDetailClient.tsx`.

**GA4 Admin → Data collection → "User-provided data collection" toggle MUST be ON at the property level for Enhanced Conversions to forward `user_data` to `/g/collect`.** Code-side gtag('set','user_data',…) calls are silently dropped if the property toggle is off. The toggle is GA4's property-level acknowledgement that user_data is allowed to flow to linked Ads accounts. Code path is necessary but not sufficient — both code AND admin toggle must be ON. Diagnosed 2026-04-28 via 5 `[EC-DEBUG]` checkpoints that confirmed the code chain was correct while the wire payload still lacked `user_data`. Always verify GA4 admin toggles when wire payload disagrees with code intent.

**Vercel env var changes do not automatically invalidate the build cache.** Setting a new env in the Vercel UI and triggering a redeploy will reuse the prior build's compiled bundle, which has the previous env values inlined at build time. `process.env.X` reads `undefined` at runtime even though the value is set in the UI. Fix: redeploy with "Use existing Build Cache" explicitly OFF, or push an empty commit to force a fresh build. Verify env presence at runtime (server log + browser console where applicable), not just in the Vercel config UI.

**When a service log shows `"X undefined"`, the literal string before `undefined` is the LABEL — `undefined` is the value of the env that label refers to.** Example: `[twilio:stub] → aamir undefined` from `src/lib/twilio.ts:27` is `console.log("[twilio:stub] -> aamir", process.env.AAMIR_PHONE, …)` — `aamir` is the label, `undefined` is `AAMIR_PHONE` (not `AAMIR_EMAIL` — separate env). Read the source of the log line to identify the actual env being read; do not assume the label corresponds to the env name. Misdiagnosing the env can lead to "fixing" the wrong variable.
