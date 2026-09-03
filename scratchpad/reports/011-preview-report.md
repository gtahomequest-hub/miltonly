# fix/street-name-canon — verification report

Two steps could not run as specified. Details below; nothing was faked or skipped silently.

## 1. Branch state — PREMISE DOES NOT HOLD

```
git status                              clean
git rev-list --count main..fix/...      ahead:  0
git rev-list --count fix/...&main       behind: 1
```

Not 2 commits ahead — **0 ahead, 1 behind**. Both commits are already in `main`:

```
5d304ae IS in main
2460df9 IS in main
main = origin/main = 39d8848
```

They were merged and pushed to production earlier this session on your instruction ("Merge fix/street-name-canon"). **There is no delta to preview** — a preview deploy of this branch would build code already serving on miltonly.com.

## 2. Push — DONE

```
5d304ae..2460df9  fix/street-name-canon -> fix/street-name-canon
origin now at 2460df96d459
```

Origin held only the first commit; it now has both.

## 3. Vercel preview — BLOCKED

- no global `vercel` binary
- no `.vercel/` project link in the repo
- no `VERCEL_TOKEN` in `.env` or `.env.local`

`.env.local` does carry 16 VERCEL_* keys, but they are runtime build vars from `vercel env pull` (`VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_OIDC_TOKEN`, …), not deploy credentials. `vercel --scope gtahomequest-hubs-projects` would need an interactive login and project link, which this non-interactive shell cannot complete.

To unblock: `VERCEL_TOKEN` in the environment, or run `vercel link` once yourself.

## 4. Verification battery — run against PRODUCTION

Production is running exactly the code in question, confirmed two ways before running:

```
<title>Rose Way, Milton — Homes, Prices &amp; Sales History</title>     (no " | Miltonly" -> template deletion live)
Cedric meta: "homes typically $1,100,000 across 8 sales in the last ~2 years."
             (windowDisclosure live; stored prose gone -> suppression fix live)
```

```
BASE=https://miltonly.com node scripts/verify/run.mjs
exit code 0

═══ MILTONLY STREET VERIFICATION ═══
target      https://miltonly.com
sitemap     426 published street pages (derived, not a literal)
crawled     426 pages · 426 × 200 · 0 other
ASSERT iterated == live sitemap count (426) : PASS
```

| check | result | coverage |
|---|---|---|
| `denials` | **PASS** | 3,367 prose blocks, 10,069 schema strings; 0 denials visible or in JSON-LD |
| `schema-parity` | **PASS** | 893 visible FAQ items == 893 schema Question nodes; 61 zero-FAQ pages emit neither heading nor FAQPage node |
| `claims` | **PASS** | 24 pages claim absence == 24-street zero-sale set, both directions; 426/426 CTAs wired |
| `tiles` | **PASS** | 0 prices with no entitled basis; 0 DOM/sold-to-ask below n12<5; 0 malformed basis lines |
| `consistency` | **PASS** | 893 FAQ + 2,048 prose sections; 0 metric published at two values |
| `composition` | **PASS** | 426 published = 423 registry + 3 allowlist; 0 on neither |
| `coordinates` | **PASS** | 400 pages with distances, all carrying OGL attribution |
| `hub-meta` | **PASS** | 22/22 hubs: meta, hero and JSON-LD all match the live aggregate; sub-k hubs (milton-north, moffat) silent everywhere |
| `geometry-control` | **PASS** | TREB/geometry agreement 97.5% over 713 streets (floor 95%) |

`═══ PASS · 9 checks · 426 pages · 50s ═══`

**Nothing red.** Five NOTEs, none gated:

1. 0 pages state a sample differing from the record (ISR lag reporting, currently zero)
2. rent pill vs market card disagree on 2 pages (`melville-bonus-crescent-milton`, `mcdougall-crossing-milton`) — known standing defect
3. stored `HubContent.metaDescription` (no longer served) still drifts from live on 21 of 22 hubs
4. 1 stored description publishes a price off a sub-k pool
5. geometry agreement 97.5% (above the 95% floor)

## 5. H1 / title / registry — production

H1 and `<title>` **agree on all 11** — the single-source name fix holds. Six disagree with the **registry**.

| slug | registry | H1 + title | |
|---|---|---|---|
| kennedy-circle-milton | KENNEDY CIRCLE | **Kennedy Circle West** | publishes another registry street's exact name |
| cargill-path-milton | CARGILL PATH | Cargill Path | matches |
| jempson-path-milton | JEMPSON PATH | Jempson Path | matches |
| magurn-gate-milton | MAGURN GATE | Magurn Gate | matches |
| mceastern-path-milton | MCEASTERN PATH | McEastern Path | matches (Mc-casing fix live) |
| sellers-path-milton | SELLERS PATH | Sellers Path | matches |
| main-street-milton | MAIN STREET | **Main Street East** | diverges |
| bronte-street-milton | BRONTE STREET | **Bronte Street South** | diverges |
| trafalgar-road-milton | TRAFALGAR ROAD | **Trafalgar Road West** | diverges |
| buckthorn-garden-milton | BUCKTHORN GARDEN | **Buckthorn** | diverges (truncated) |
| sycamore-garden-milton | SYCAMORE GARDEN | **Sycamore** | diverges (truncated) |

Titles render as `<name>, Milton — Homes, Prices & Sales History` throughout.

Two things this confirms:

- The **five mis-routed destination pages all render correctly and match the registry.** The wrong-street bug is in `heroSearch` resolution, not in these pages — consistent with the routing audit.
- The registry-name defect is **unfixed and live**, exactly as the audit found. `displayStreetName` repairs artifacts (`#bsmt`, `Mcphail`, doubled type words) but does not change where the name is *sourced* from — `street-data.ts:347` still prefers `streetContent.streetName` over the registry. That is queue item 1.

## 6. Status

- Preview URL: **none** — blocked (§3) and moot (§1)
- Battery: **PASS**, 9/9, exit 0, against production running this exact code
- Red checks: **none**
- **Not merged** — and nothing to merge; `main` already contains both commits
- Branch pushed to origin as instructed

Registry name canon (queue item 1) would clear all 6 divergences above, including the Kennedy page publishing a neighbouring street's name.
