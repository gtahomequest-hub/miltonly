# `fix/provider-sitemap` @ `f429b6a`, pushed, not merged

**Steps 1–5 green. Step 6 blocked on DeepSeek balance — third attempt, same wall.**

Full report at `scratchpad/provider-sitemap.md`.

Branched from `fix/ai-provider-failclosed` rather than redoing steps 1–2, so `33c60d7` and its red/green demonstration carry forward intact.

## Sitemap — 460 added, 573 -> 1033

```
total <loc>: 1033    listing detail: 460    www: 0
```

Three gates: `status="active"`, `permAdvertise=true`, `city`. The middle one matters most — `page.tsx:39` noindexes those and renders "not available", so submitting one would advertise a URL we deliberately refuse to show. Zero active listings fail it today; the filter exists so that does not have to stay true.

**Privacy:** a listing entry has exactly `["url","lastModified","changeFrequency","priority"]`. No address, price, coordinate, or `displayAddress`-gated field.

## One conflict worth knowing about

**Both GSC-flagged www listings are `status=rented`**, so the active gate excludes them:

```
W13055010 in sitemap: false   (rented)
W13521548 in sitemap: false   (rented)
```

Step 5's "the two listing URLs from step 3" was read as *two samples from the set step 3 adds*, and those were confirmed. But if the www-flagged pair was meant, steps 3 and 5 contradict each other — and this change does nothing for them. They still need Request Indexing on their apex twins, exactly as Task B concluded.

## www hardening

Pinned in `next.config.mjs` with `has: [{ type: "host", value: "www.miltonly.com" }]`. The platform rule still fires first; this is the net under it so a dashboard edit cannot silently remove the redirect. `.env.example:69` was the last www literal in shippable config — now apex.

On the Host-header point: correct that it cannot be tested against a preview host, and it was not faked. Reported by reading the built config.

## Preview

**https://miltonly-4zx6v65g5-gtahomequest-hubs-projects.vercel.app**

Battery `PASS · 9 checks · 426 pages · 64s`, exit 0. Preview sitemap: 1033 `<loc>`, 460 detail, 0 www, both sample URLs present.

## Step 6 — blocked

```
resolveAiProvider() = "phase41_v2"
[Phase41] TIER 2 (thin-data): totalListings=2
ERR DeepSeek API error 402: Insufficient Balance
```

Routing proven — phase-4.1 entered, DeepSeek called. But balance is still empty. Before and after FAQ are **identical**; nothing was written. `bare "Buckthorn": 6 of 6` both sides.

**"No bare Buckthorn may remain" is not satisfied and cannot be until a provider has credit.** Anthropic empty yesterday, DeepSeek empty on both attempts today. That is the third run blocked on billing — worth topping one up before asking for it a fourth time, since everything else in the chain now demonstrably works.

`StreetGeneration.status` is still `failed` from the earlier attempt and still awaiting a decision on restoring it.

## State

| | |
|---|---|
| branch | `fix/provider-sitemap` @ `f429b6a`, pushed |
| commits | `33c60d7` fail-closed, `f429b6a` sitemap + www |
| preview | https://miltonly-4zx6v65g5-gtahomequest-hubs-projects.vercel.app |
| merged | **no** |
| battery | PASS · 9 checks · 426 pages |
| prebuild | 8 tests green |
| sitemap | 1033 entries, 460 listing detail |
| step 6 | **blocked — DeepSeek 402, third attempt** |
