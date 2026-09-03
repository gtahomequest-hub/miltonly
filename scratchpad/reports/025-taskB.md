# Task B — www host leakage. Read-only recon. No code written, tree clean.

## Short answer

**Nothing in the repo can mint a www URL, and www already 308s to apex. There is no code change to make.** The three GSC rows have two different causes, and neither is a live emitter. What is missing is a re-crawl, not a fix.

## 1. curl

```
https://www.miltonly.com/                    308  ->  https://miltonly.com/
https://www.miltonly.com/listings/W13055010  308  ->  https://miltonly.com/listings/W13055010
https://miltonly.com/                        200
```

## 2. Where the redirect lives

It is a **Vercel domain redirect**, not a Next redirect, and it fires before routing. Two proofs:

- **Header signature.** The 308 carries `Server: Vercel`, `Content-Type: text/plain`, `Refresh: 0;url=...` and **no `X-Matched-Path`**. The apex 200 does carry `X-Matched-Path: /`.
- **Ordering.** `https://www.miltonly.com/streets/asleton-boulevard` -> 308 to apex with the slug **uncanonicalised**, while `https://miltonly.com/streets/asleton-boulevard` -> 301 to `/streets/asleton-boulevard-milton`. Middleware never ran on the www request.

`vercel.json` contains only `crons`. `next.config.mjs` has 30 path redirects and **no `has: host` rule**. So the redirect exists **only in the dashboard** — nothing in the repo enforces, documents or tests it.

## 3. Canonicals — does any read the request host?

**No. Not one.** `headers()` from `next/headers` is never imported in `src/` (the only `next/headers` imports are `cookies`, in `auth.ts:2`, `admin/review/page.tsx:1`, `admin/seo/page.tsx:1`). No file references `x-forwarded-host`, `x-forwarded-proto`, `nextUrl.origin` or `nextUrl.host`.

Every absolute URL derives from one literal — `src/lib/config.ts:20`, `SITE_URL: "https://miltonly.com"`.

| file:line | builds | host source |
|---|---|---|
| `config.ts:20` | the single origin literal | fixed |
| `layout.tsx:72` | `metadataBase: new URL(config.SITE_URL)` — pre-empts Next's `VERCEL_URL` fallback for all relative metadata | fixed |
| `layout.tsx:95/:103` | root canonical + og:url — **this is the homepage's canonical** | fixed |
| `listings/[mlsNumber]/page.tsx:60` | listing canonical (both flagged URLs) | fixed |
| `page.tsx:25` | breadcrumb JSON-LD only — **constructs no canonical at all** | fixed |
| `seo.ts:4,28,36,46` | canonical + og:url + og:image for ~25 static routes | fixed |
| `sitemap.ts:10` | every `<loc>` | fixed |
| `robots.ts:55` | `Sitemap:` line | fixed |
| `schema.ts:3`, `schema/street-schema.ts:31` | all JSON-LD `url`/`@id` | fixed |
| `street-data.ts:64 -> :1613` | 431 street canonicals + og:url | fixed |
| `hubLive.ts:110` | neighbourhood canonicals | fixed |

**The two files you named:**

- `listings/[mlsNumber]/page.tsx:60` — `canonical: \`${config.SITE_URL}/listings/${l.mlsNumber}\``. Only input is `params.mlsNumber`. Despite `dynamic = "force-dynamic"`, both flagged URLs serve 200 with an apex canonical and **0** occurrences of `www.miltonly` in the body.
- `page.tsx` — 34 lines, **no `metadata` and no `generateMetadata` export**. The homepage canonical comes entirely from the root layout. Served: apex canonical, apex og:url, 0 www strings.

Served confirmation: `sitemap.xml` = 200, 573 `<loc>`, **all apex, zero www** (the only `www.` is the sitemaps.org XML namespace). `robots.txt` = `Sitemap: https://miltonly.com/sitemap.xml`.

## 4. Every www string in the repo — 9 files, none served

- `docs/whitlock-avenue-mockup.html` — 26 pre-flip JSON-LD `@id`s. `docs/` is not `public/`; the path 404s.
- `.env.example:69` — `CHEATSHEET_PDF_URL=https://www.miltonly.com/...`. Stale template. **Not set in production.**
- `src/lib/seo/gscClient.ts:46`, `scripts/gsc-coverage-audit.ts:110` — www->apex **normalisers**, the opposite of a mint.
- 5 prose/comment lines documenting the flip.

`SITE_URL_WWW` was deleted in `acbf098` (2026-07-17) and has zero references.

## 5. Where the www URLs actually come from — settled by URL Inspection, not inference

| URL | coverageState | googleCanonical | lastCrawl |
|---|---|---|---|
| `www.../listings/W13055010` | Submitted and indexed | **www** | **2026-07-01** |
| `apex.../listings/W13055010` | **URL is unknown to Google** | — | never |
| `www.../listings/W13521548` | Submitted and indexed | **www** | **2026-07-04** |
| `www.miltonly.com/` | Page with redirect | **apex** | 2026-08-30 |
| `miltonly.com/` | Submitted and indexed | apex | 2026-08-29 |

**The two listings are stale index entries.** Both were last crawled *before* the 2026-07-17 host flip, so Google still holds a pre-flip snapshot in which www genuinely was the serving host. The apex twin of W13055010 has **never been fetched**. This is exactly the `staleCrawl = lastCrawl < FLIP_DATE` test the repo already implements at `scripts/gsc-coverage-audit.ts:148`.

**The homepage is already consolidated** — `googleCanonical = apex`, coverageState "Page with redirect". Its 75 impressions are Domain-property reporting residue: `sc-domain:` aggregates every hostname, and Performance attributes an impression to the URL as it appeared at query time.

**Not purely historical either — the migration is mid-flight.** Weekly impressions by host:

```
2026-06-14  www=685  apex= 19   97.3%
2026-07-12  www=933  apex=  9   99.0%   <- flip lands 2026-07-17
2026-07-26  www=823  apex=322   71.9%
2026-08-23  www=605  apex=678   47.2%
2026-08-30  www=198  apex=530   27.2%
```

Clean monotone decay from 99% to 27%, inflecting on the flip week. Google is swapping host page by page and is roughly halfway.

**Google's own referring-page data shows no external www seeding.** The recorded referrers are our own pre-flip internal links (www->www, frozen at crawl time). The only *external* inbound links point at the **apex**. One submitted sitemap, apex, 0 errors.

## 6. The smallest change

**None. Both requirements are already met** — www 308s to apex at the edge, and every canonical reads apex.

**The highest-leverage action is external and takes 60 seconds:** GSC -> URL Inspection -> `https://miltonly.com/listings/W13055010` -> **Request Indexing**, same for `W13521548`. That forces the fetch that reads the apex canonical and collapses the www twin.

Optional hardening, descending value, none blocking:

1. **`next.config.mjs`** — add one `has: [{ type: "host", value: "www.miltonly.com" }]` redirect rule. Today the www->apex redirect lives **only in the Vercel dashboard**; this makes it reviewable and survives a dashboard mistake.
2. **`.env.example:69`** — change to the apex form. Last www literal in shippable config, and the only thing that could reintroduce www if someone copies the template into Vercel.
3. `src/middleware.ts:127-129,139-141` — build from `config.SITE_URL` rather than `req.nextUrl.clone()`. Measured, it currently emits a **relative** `Location`, so it cannot serialise a host. Only matters if (1) is never done and the dashboard rule is later removed.

**Explicitly not recommended:** no GSC property change (`sc-domain:` is correct and is *why* www rows are visible), no canonical-tag change, no sitemap host change.

## 7. What the repo cannot answer

| Unknown | External check |
|---|---|
| The Vercel domain-redirect config itself — behaviour proven, config unpinned | Vercel -> Settings -> Domains: confirm apex Primary, www "Redirect to miltonly.com (308)" |
| Whether Google re-crawls the two listings unaided, and when | Request Indexing, re-inspect in ~7 days; expect `googleCanonical` to flip to apex |
| Full off-site www backlink profile | GSC -> Links -> Top linking sites, filtered for www targets |

Worth noting on discovery: `sitemap.ts:24` emits only `/listings`, **no `/listings/<mls>` detail URLs** (0 of 573). Both flagged MLS numbers sit behind crawlable pagination and are not on page 1. Reachable, but slowly — which is why Request Indexing is worth the 60 seconds.

**One correction to an earlier pass:** the claim that all three flagged URLs lack an apex twin is false. The apex homepage has one (imp=38, pos=48.1 vs www imp=75, pos=16.8) — the same page reporting from two SERP slots. Only the two listings genuinely lack an apex twin.
