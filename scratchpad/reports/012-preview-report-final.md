# fix/street-name-canon — verification report

**Two steps could not run as specified.**

## 1. Branch state — premise doesn't hold

```
git status                          clean
ahead of main:   0        (not 2)
behind main:     1
```

Both commits are already in `main`: `5d304ae IS in main`, `2460df9 IS in main`, `main = origin/main = 39d8848`. They were merged and pushed to production earlier this session on your instruction. **There is no delta to preview** — a preview build of this branch would compile code already serving on miltonly.com.

## 2. Push — done

```
5d304ae..2460df9  fix/street-name-canon -> fix/street-name-canon
```

Origin held only the first commit; it now has both.

## 3. Vercel preview — blocked

No global `vercel` binary, no `.vercel/` project link, no `VERCEL_TOKEN`. The 16 `VERCEL_*` keys in `.env.local` are runtime build vars from `vercel env pull` (`VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_OIDC_TOKEN`…), not deploy credentials. The command would need interactive login and project link, which this shell cannot complete.

Unblock with `VERCEL_TOKEN` in the environment, or run `vercel link` once yourself.

## 4. Battery — run against production instead

Production runs exactly this code, confirmed before running: titles carry no ` | Miltonly`, and Cedric's description reads `"across 8 sales in the last ~2 years"` with the stored prose gone.

```
BASE=https://miltonly.com node scripts/verify/run.mjs
exit 0
═══ PASS · 9 checks · 426 pages · 50s ═══
```

| check | result | coverage |
|---|---|---|
| `denials` | PASS | 3,367 prose blocks, 10,069 schema strings, 0 denials |
| `schema-parity` | PASS | 893 visible FAQ == 893 schema nodes |
| `claims` | PASS | 24 absence claims == 24-street zero-sale set, both directions |
| `tiles` | PASS | 0 prices with no entitled basis |
| `consistency` | PASS | 0 metrics published at two values |
| `composition` | PASS | 426 = 423 registry + 3 allowlist |
| `coordinates` | PASS | 400 pages, all attributed |
| `hub-meta` | PASS | 22/22 hubs consistent; sub-k hubs silent everywhere |
| `geometry-control` | PASS | 97.5% agreement over 713 streets (floor 95%) |

**Nothing red.** Five non-gating NOTEs, the notable ones: rent pill vs market card disagree on 2 pages (known standing defect), and stored `HubContent.metaDescription` still drifts on 21 of 22 hubs though it is no longer served.

## 5. H1 / title / registry

H1 and `<title>` **agree on all 11** — the single-source fix holds. **Six diverge from the registry:**

| slug | registry | renders | |
|---|---|---|---|
| kennedy-circle-milton | KENNEDY CIRCLE | **Kennedy Circle West** | another street's exact name |
| cargill-path-milton | CARGILL PATH | Cargill Path | ok |
| jempson-path-milton | JEMPSON PATH | Jempson Path | ok |
| magurn-gate-milton | MAGURN GATE | Magurn Gate | ok |
| mceastern-path-milton | MCEASTERN PATH | McEastern Path | ok — Mc-casing fix live |
| sellers-path-milton | SELLERS PATH | Sellers Path | ok |
| main-street-milton | MAIN STREET | **Main Street East** | diverges |
| bronte-street-milton | BRONTE STREET | **Bronte Street South** | diverges |
| trafalgar-road-milton | TRAFALGAR ROAD | **Trafalgar Road West** | diverges |
| buckthorn-garden-milton | BUCKTHORN GARDEN | **Buckthorn** | truncated |
| sycamore-garden-milton | SYCAMORE GARDEN | **Sycamore** | truncated |

The five mis-routed **destination** pages all render correctly — confirming the wrong-street bug is in `heroSearch` resolution, not in these pages. And the registry-name defect is live and unfixed: `displayStreetName` repairs artifacts but does not change where the name is *sourced*; `street-data.ts:347` still prefers `streetContent.streetName` over the registry.

## 6. Status

Preview URL: **none** (blocked and moot) · Battery: **PASS 9/9** · Red checks: **none** · **Not merged** — and nothing to merge.

---

Note on the copy step: `| clip` was run as specified but mangled the UTF-8 — em-dashes came back as `ΓÇö` and the box-drawing characters were destroyed. Re-copied via `Set-Clipboard`, which handles UTF-16 correctly.
