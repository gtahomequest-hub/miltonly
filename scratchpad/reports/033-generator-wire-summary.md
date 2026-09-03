# `fix/generator-name-wire` @ `2939710` — all steps pass

**Yesterday's failing criterion now holds: zero bare names on both pages.**

Full report at `scratchpad/generator-wire.md`.

## The sweep found two more that were missed

Writing the guard immediately surfaced defects beyond the one named in the brief:

- **`street-data.ts buildDescriptionBody`** — the `About <name>` heading came from the *stored* name. It rendered **"About Buckthorn" beneath an H1 reading "Buckthorn Garden"**.
- **`api/sync/vip-hubs`** — the `description` beside the `streetName` fixed last time had the *same* bug: raw MLS, falling back to the bare slug. A cron writing `"Real estate data for buckthorn-garden-milton"` into the DB.

Both fixed.

## The guard, red then green

**Red on main**, naming the exact cause of yesterday's failure:

```
src/lib/ai/buildGeneratorInput.ts:290 reads a raw street name but never calls resolveStreetName.
```

**Green on branch.** It is file-level rather than line-level on purpose — the raw read is usually the *fallback argument* to the resolver, several lines from the call, so a line-level check would flag every correct site.

Allowlisted with reasons: the resolver itself, `admin/review` (shows the stored value to a reviewer deliberately), `sync/regenerate` and `api/admin/publish` (read the stored row, not display surfaces), plus `SeoLinkGrid` and `lib/stats` (dead code, zero importers).

## Regenerations — both 0 bare

```
buckthorn   6/6 bare -> 0/7    succeeded, 2 attempts, 861 words, $0.0056
sycamore    8/8 bare -> 0/7    succeeded, 4 attempts, 967 words, $0.0097
```

Combined **$0.0153**. Judge PASS on both.

Sycamore's four attempts are worth reading as a positive: the grounding validator rejected attempts 1 and 3 for `temporal_pairing` — the model wrote *"from around $1.0M in Q2 2025, it rose to approximately $1.25M by Q4 2025"* when the input typical was $1,021,983, outside the ±$51,099 tolerance — and attempt 2 for a superlative. It caught a fabricated price trend three times and only accepted grounded copy.

## Condo check — no stubs

All five non-pilot URLs: **200**, 2207–2500 words, real H1, 5 `h2` sections, JSON-LD, real figures (`$492,333` typical on the spot-checked one). Sitemap unchanged.

| URL | status | words | H1 |
|---|---|---|---|
| `1005-nadalin-heights-milton` | 200 | 2243 | `1005 Nadalin Hts` |
| `1340-main-street-milton` | 200 | 2252 | `1340 Main St E` |
| `1105-leger-way-milton` | 200 | 2253 | `1105 Leger Way E` |
| `100-millside-drive-milton` | 200 | 2500 | `100 Millside Dr S` |
| `1045-nadalin-heights-milton` | 200 | 2207 | `1045 Nadalin Hts` |

**One thing not asked about:** every condo H1 uses the abbreviated MLS form — `Nadalin Hts`, `Main St E`, `Millside Dr S`. Same defect class the registry work fixed, on a surface the registry does not cover since condo buildings are not Town streets. Not a stub, not in scope — flagging it as the obvious next naming target.

## State

| | |
|---|---|
| branch | `fix/generator-name-wire` @ `2939710`, pushed |
| preview | https://miltonly-292wbwq16-gtahomequest-hubs-projects.vercel.app |
| merged | **no** |
| battery | PASS · 9 checks · 426 pages |
| prebuild | 8 tests green |
| buckthorn | 0/7 bare, $0.0056 |
| sycamore | 0/7 bare, $0.0097 |
| condo stubs | none found |

Both regenerations wrote to **production data**, so those two pages serve the corrected FAQ live now — the code change is what is still unmerged.
