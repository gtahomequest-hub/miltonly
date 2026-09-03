# Task B — www leakage. No code change needed.

Full report at `scratchpad/taskB.md`.

**Nothing in the repo can mint a www URL, and www already 308s to apex.** The three GSC rows have two different causes, neither a live emitter. What is missing is a re-crawl, not a fix.

## Where the redirect lives

It is a **Vercel domain redirect**, not a Next one — proven two ways. The 308 carries no `X-Matched-Path` (the apex 200 does), and `www.../streets/asleton-boulevard` 308s with the slug **uncanonicalised** while the apex 301s it to `asleton-boulevard-milton`. Middleware never ran on the www request.

**But it exists only in the dashboard.** `vercel.json` has just `crons`; `next.config.mjs` has 30 path redirects and no `has: host` rule. Nothing in the repo enforces or tests it.

## No canonical reads the request host — not one

`headers()` from `next/headers` is never imported in `src/`. No `x-forwarded-host`, no `nextUrl.origin`. Every absolute URL derives from `config.ts:20`, `SITE_URL: "https://miltonly.com"`.

- **`listings/[mlsNumber]/page.tsx:60`** — only input is `params.mlsNumber`. Both flagged URLs serve apex canonical, **0** `www.miltonly` in the body.
- **`page.tsx`** — 34 lines, exports **no metadata at all**; the homepage canonical comes from the root layout.

Sitemap: 573 `<loc>`, **all apex, zero www**.

## The actual cause, settled by URL Inspection

```
www.../listings/W13055010   indexed   googleCanonical=www    lastCrawl 2026-07-01
apex.../listings/W13055010  URL IS UNKNOWN TO GOOGLE          never crawled
www.../listings/W13521548   indexed   googleCanonical=www    lastCrawl 2026-07-04
www.miltonly.com/           Page with redirect  -> apex       lastCrawl 2026-08-30
```

**The two listings were last crawled before the 2026-07-17 flip.** Google holds a pre-flip snapshot where www genuinely was the serving host. The apex twin of W13055010 has *never been fetched*. The homepage is already consolidated — its impressions are Domain-property reporting residue.

And it is mid-flight, not finished: www's share of impressions has decayed **99% -> 27%** since the flip, inflecting exactly on flip week.

Google's own referrer data shows **no external www seeding** — the recorded referrers are our own pre-flip internal links; the only external inbound links point at the apex.

## The smallest change

**None.** Both requirements are already met. The highest-leverage action takes 60 seconds and is external: **GSC -> URL Inspection -> the two apex listing URLs -> Request Indexing.** That forces the fetch that reads the apex canonical and collapses the www twin.

Worth doing because `sitemap.ts:24` emits only `/listings` and **no detail URLs** (0 of 573) — both MLS numbers sit behind crawlable pagination, so unaided re-crawl is slow.

Optional hardening, none blocking: pin the www->apex rule in `next.config.mjs` so it survives a dashboard mistake, and fix the stale `www` literal at `.env.example:69`.

**One correction to an earlier pass:** the claim that all three flagged URLs lack an apex twin is false. The apex homepage has one (imp=38, pos=48.1 vs www imp=75, pos=16.8), the same page reporting from two SERP slots. Only the two listings genuinely lack one.
