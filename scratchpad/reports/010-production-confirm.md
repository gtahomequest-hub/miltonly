Merged and deployed — `main` at `39d8848`, build green on the identical tree, 7 prebuild tests passing.

## Production curls — every claim confirmed

**Refutation holds.** The routing claim is definitively false:

```
curl -sI /streets/cedric-terrace-milton     -> HTTP/1.1 200 OK, no Location header
curl -s  /streets/cedric-terrace-milton     -> <h1>Cedric <em>Terrace</em></h1>
curl -s  /api/hero-search?q=cedric+terrace  -> {"href":"/streets/cedric-terrace-milton"}
```

Cedric serves Cedric. No redirect, correct H1, correct search resolution.

**The explanation for what the external audit saw is confirmed too** — a sitemap asymmetry, not routing:

```
sitemap.xml grep cedric-terrace-milton   -> 0   (no StreetContent row, excluded)
sitemap.xml grep jelinik-terrace-milton  -> 1   (published, submitted)
```

Cedric serves a live 200 but was never submitted for indexing. Google ranking the nearest indexed "… Terrace" page for that query is exactly the shape the auditor observed.

**The real bug reproduces live — all five:**

```
cargill+common    -> /streets/cargill-path-milton
sellers+common    -> /streets/sellers-path-milton
jempson+common    -> /streets/jempson-path-milton
magurn+lane       -> /streets/magurn-gate-milton
mceastern+common  -> /streets/mceastern-path-milton
```

Typing a street's exact official name sends you to a physically different street.

**The Kennedy H1 defect is live:**

```
/streets/kennedy-circle-milton      -> <h1>Kennedy Circle <em>West</em></h1>
/streets/kennedy-circle-east-milton -> HTTP/1.1 200 OK   (duplicate, no 301)
```

The page for `KENNEDY CIRCLE` publishes `KENNEDY CIRCLE WEST`'s name, and its body prose opens "Kennedy Circle West traces a quiet arc…" — so the wrong name propagates past the H1 into the copy.

Additional observation not in the audit: Cedric's hero prose renders `A street in Milton Ontario.` — the neutral fallback, working correctly. After this deploy its meta description and JSON-LD will be empty there rather than carrying stored prose the page will not print.

## In flight

K-anonymity audit running — four areas including aggregation/differential disclosure, the failure mode where each figure passes its own gate but two combined back out an individual sale.

## Queue

1. Registry name canon — one insertion at `street-data.ts:347`, clears all 15 H1/registry divergences including Kennedy
2. `heroSearch` ambiguity guard — ~6 lines, fixes the 5 wrong-street resolutions
3. The 39 drafts

Note: 1 and the K-anon fix touch the same file, so worth sequencing rather than running in parallel.

## Commit trail

| Branch | Commit | State |
|---|---|---|
| `main` | `39d8848` | **deployed** — name repair + suppression leak + 2 new prebuild guards |
| | `9b9ac83` | previous deploy |

Prebuild suite is now 7 tests: canonicalization-regression, condo-identity, faq-sentence-count, temperature-regression, sms-format, street-name-repair, index-copy-parity.
