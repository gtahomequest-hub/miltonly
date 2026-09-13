# MC-016
D:\miltonly · main

## MC-016: Neon egress recon, no code

### What Neon will and will not say

`neonctl` authorised through the browser during this task (the Vercel-linked org `org-snowy-cake-35483314` and Aamir's personal org both listed). **Per-day and per-endpoint consumption history is a Scale-plan endpoint** (`/consumption_history/projects` answers 403 "included with Scale plans and above"), so the three-day, per-branch breakdown the task asked for is not available from the API on this plan. What the API does give is the month-to-date counter per branch (`data_transfer_bytes`, `active_time_seconds`), read 2026-09-12 21:34Z and again at 21:44Z after a full battery run: **the counter did not move by a byte in ten minutes**, so it refreshes on a lag of hours, not minutes, and cannot measure a run.

| project | endpoint | what it is | data transfer, 1 to 12 September | compute |
|---|---|---|---|---|
| `fancy-bread-13256110` Miltonly (personal org, us-east-2) | `ep-patient-paper` | **DB1**, `DATABASE_URL`, Prisma | **46.37 GB** | 280.9 h active, 77.8 compute-h |
| `winter-leaf-52425555` miltonly-analytics (Vercel org, us-east-1) | `ep-square-voice` | **DB2 and DB3 are the same database**: `SOLD_DATABASE_URL` and `ANALYTICS_DATABASE_URL` name the same host, and `pg_stat_database` reads identically on both | 1.77 GB | 230.4 h |
| `lingering-sea-07597558` neon-fulvous-globe (Vercel org) | `ep-muddy-dawn` | `NEON_DATABASE_URL`, the Vercel-integration database; nothing in the app reads it | 0.74 GB | 242.2 h |

**The 101 GiB in a day does not reconcile with these counters.** DB1's month-to-date is 46 GB over twelve days (≈3.9 GB/day); a 101 GiB day would exceed the month. Either the console figure is summed across projects and orgs (Homesly's project sits in the personal org beside Miltonly), or its "data transfer" is a different quantity from the API's `data_transfer_bytes`, or the API counter is behind. Which of the three is Aamir's console to settle; every number below is measured, not read off a dashboard.

### Where the bytes go: measured

`pg_stat_statements` was enabled on DB1 and DB2 at 21:46Z (an extension, no app code; drop it with `DROP EXTENSION pg_stat_statements` if unwanted) and reset, then one full production battery ran (`PASS · 16 checks · 489 pages · 856s`, preceded by a `db2` tag drop so renders hit the database). The window also carries the hourly crons and whatever real traffic there was; the battery dominates.

**The battery's own reads are nothing.** Its three record loaders, measured at the socket (a fetch wrapper around the Neon HTTP driver): `loadRecord` 0.21 MB in 5 calls, `loadHubRecord` 0.05 MB, `loadHomeRecord` 0.04 MB. **0.29 MB per run.** The checks aggregate in SQL; they do not pull rows.

**The renders the battery triggers are the cost.** A battery is 489 street renders plus 22 hubs × 5 whole-corpus checks (hub-meta, hub-intents, guide-links, hub-page, and the homepage check's hub reads), the guides, /rentals, /sold and the homepage: about 620 page renders on Vercel, each of which queries Neon.

Per-window totals from `pg_stat_statements`: **DB1 1,138,193 rows returned over 155,046 calls; DB2 51,863 rows over 59,840 calls** (most of DB2's calls are Neon's own monitoring). The DB1 rows, by statement:

| rows | calls | rows/call | statement | who |
|---|---|---|---|---|
| 235,690 | 481 | 490 | `StreetContent id, streetSlug WHERE status = published` | `publishedStreetPageSlugs()` / `surfacedStreetWhere()`, on nearly every render (18 call sites) |
| 230,157 | 239 | 963 | `ResidentialStreet id, slug` (whole table) | the same helper, the entity floor |
| 194,598 | 57 | 3,414 | `Listing id, streetSlug, streetName, neighbourhood WHERE streetSlug IN (687 slugs) AND streetName IS NOT NULL` | `/streets` (`src/app/streets/page.tsx` line 52): `distinct: ["streetSlug"]` is done by Prisma in memory, so every render of the index pulls every Milton listing to keep 687 of them; the page is `force-dynamic` and is rendered by the nav check, by every crawler and by every `StreetContent` write's revalidation |
| 62,304 | 2,596 | 24 | `Neighbourhood id, slug, name, rawStrings` | per render, several times |
| 60,434 | 2,747 | 22 | `HubContent id, neighbourhoodSlug WHERE published` | per render, several times |
| 39,159 | 57 | 687 | `COUNT(*) GROUP BY streetSlug` over Milton listings | `/streets`, the same render |
| 28,582 | 62 | 461 | `Listing propertySubType, price, bedrooms, transactionType …` | the mega menu's live panels |

Rows to bytes: Prisma returns the selected columns only, so the wide `Listing` row (1,670 B average on disk) leaves as ~110 B for the four-column pull and the slug sets as ~50 B. **Estimate: ≈ 110 to 140 MB of DB1 egress per full battery, ≈ 15 to 20 MB of DB2; ≈ 0.15 GB per run.** Per check: any per-page check is free once the crawl runs (one render per street, shared by all seven of them, ≈ 100 MB); each whole-corpus hub check is 22 hub renders ≈ 22 × 0.6 MB ≈ 13 MB (a hub render scans 18,079 DB1 rows and 45,203 DB2 rows, `pg_stat_database` delta); the homepage ≈ 17,000 DB1 rows scanned; **`/rentals` scans 66,712 DB1 rows in one render** (nine category aggregates plus an average over every lease row, uncached).

Per-render row scans (`tup_returned` deltas, server-side): pine-street 124 DB1 / 8,717 DB2; whitlock-avenue 1,310 / 45,022; hub beaty 18,079 / 45,203; homepage 17,424 / 0; parking guide 2,174 / 0; /rentals 66,712 / 0.

**What that means for yesterday.** Yesterday's Core work alone ran about twenty batteries (MC-005 through MC-014, previews and production) ≈ 3 GB, plus the creation programme's hourly passes, the 38 regen runs, and four worktrees' own previews and batteries. At ~0.15 GB a run, the measured battery cost cannot reach 101 GiB on its own; **the standing consumer is `/streets`**: it rendered 57 times in the fifteen-minute window (each render 3,414 + 687 + 687 rows, ≈ 400 KB), which is 2 GB/day if sustained, and it renders for every crawler hit and for every `StreetContent` write's revalidation (the creation programme writes 20 a day, the regen runs 38 yesterday) regardless of who is looking. The published-slug and entity-floor sets (490 + 963 rows) leave the database on nearly every render of every page, ≈ 70 KB a render, ≈ 40 MB per battery, and as much again from real traffic and crawlers.

### Proposals

1. **Checks read a nightly snapshot instead of live per-page queries** where the comparison does not need live data. The battery's own queries are 0.29 MB; a snapshot would save nothing there. The comparison that does not need a live render is the one that never changes between deploys: `composition`, `coordinates`, `geometry-facts`, `guide-links`, `nav`, `sources-fresh` and the schema-parity half of `schema-parity` read page structure, not figures. **Proposal: a `--structure` mode that crawls a 40-page sample (every template once, the condo-heavy and video cases included) for those checks, and the full crawl only for the figure checks (`denials`, `claims`, `tiles`, `consistency`, `hub-meta`, `homepage`).** Saves ≈ 90 % of the street renders on a structure-only run, ≈ 0.1 GB a run.
2. **One battery per merge, not per worktree.** Today each worktree runs the full battery on its own preview before handing a SHA to Core, then Core runs it again on the preview and once more on production: three full runs per change, four worktrees. **Proposal: a worktree runs `--only` for the checks its change touches on its preview; Core runs the full battery once, on the merged preview, and the production run after the merge is `--only=composition,homepage,hub-meta` (the deployment identity plus the figures that move).** From ≈ 3 full runs a change to ≈ 1.3.
3. **Select only the needed columns in the heaviest queries.** The heavy ones already select narrowly; the waste is the *set* being re-fetched. Specifically: (a) `publishedStreetPageSlugs()` and `surfacedStreetWhere()` fetch 490 + 963 rows per render: cache the two slug sets in Upstash for 15 minutes and drop them on every `StreetContent` publish (the revalidation hook already fires there); (b) `/streets` pulls 3,414 four-column listing rows per render to pick one name per slug: replace the in-memory `distinct` with one `SELECT DISTINCT ON ("streetSlug")` raw query (687 rows), and wrap the page's four bulk reads in `cached()` at `CACHE_TTL.stats` so a render costs Upstash, not Neon; (c) `/rentals` recomputes nine category aggregates and a town-wide average on every request with no cache: one `groupBy` and `cached()` at `CACHE_TTL.stats`; (d) `Neighbourhood` and `HubContent` rows fetched 2,600 times per window: one request-scoped memo each (the `perRequest` helper exists in `streetSurface.ts`). Together these are the bulk of DB1's rows.
4. **Scope the `db2` tag drop to the rows written?** DB2 is 1.77 GB month-to-date and its per-render cost is ≈ 11 KB on a street page; the tag drop after a sync re-runs, at most, one hour of DB2 reads, ≈ 20 MB on a busy hour. **Not worth the complexity now**; if it ever is, the shape is one tag per street (`db2:street:<slug>`) plus a wide tag for the aggregates, and the sync drops the wide tag and the tags of the streets it wrote. DB1 has no data cache at all (Prisma is not fetch), which is why the tag question is the wrong lever for the elephant.

### Proposed monthly ceiling

DB1 **12 GB/month**, DB2 **3 GB/month**, the integration project **1 GB/month** (or delete it if nothing reads it), **16 GB total**, with an alert at 12. At today's measured costs that is ≈ 40 full battery runs a month plus the crons and real traffic once proposals 2 and 3 land; without them the run rate is 46 GB in twelve days on DB1 alone.

### What was changed

Nothing in the repo. `pg_stat_statements` is now installed on DB1 and DB2 (statistics only; `DROP EXTENSION pg_stat_statements` removes it). `neonctl` holds an OAuth credential at `~/.config/neon/credentials.json`. Two battery runs and six page renders were made to measure.

Report: scratchpad/reports/MC-016-neon-egress-recon.md
