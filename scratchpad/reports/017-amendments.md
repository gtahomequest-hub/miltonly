# Build 1 amendments — `feat/name-source` @ `4c05cc5`, pushed. Not merged.

**Steps 1–3 done and committed. Step 4 gate FAILED — vercel is logged out, so steps 5, 6 and 7 did not run.**

## 1. The 4 redirected rows retired

```
BEFORE:
  wood-close-n-a-milton                status=published  name="Wood Close"
  first-line-nassagaweya-line-milton   status=published  name="First Line Nassagaweya Line"
  clitherow-drive-milton               status=published  name="Clitherow Dr"
  jarrett-cross-milton                 status=published  name="Jarrett Cross"

rows updated: 4

AFTER:
  wood-close-n-a-milton                status=unpublished  name="Wood Close"
  first-line-nassagaweya-line-milton   status=unpublished  name="First Line Nassagaweya Line"
  clitherow-drive-milton               status=unpublished  name="Clitherow Dr"
  jarrett-cross-milton                 status=unpublished  name="Jarrett Cross"

published street pages now: 427  (was 431)
```

Sitemap confirmation, generated from the branch build:

```
sitemap entries total: 573
  /streets/ entries:   426

the 4 unpublished slugs:
  wood-close-n-a-milton                in sitemap: no
  first-line-nassagaweya-line-milton   in sitemap: no
  clitherow-drive-milton               in sitemap: no
  jarrett-cross-milton                 in sitemap: no

control — their 301 targets:
  wood-close-milton                    in sitemap: yes
  first-line-nassagaweya-milton        in sitemap: yes
  clitherow-street-milton              in sitemap: yes
  jarrett-crossing-milton              in sitemap: no
```

`jarrett-crossing-milton` absent is expected and previously flagged — it has no `StreetContent` row, so it renders via `dynamicParams` and was never in the sitemap. The 301 still lands on a page that serves; it is just not submitted for indexing. If you want it indexed it needs a content row, which is Build 2.

Note the gap between 427 published and 426 `/streets/` entries: `sitemap.ts` gates on entity existence as a second independent condition, so one published slug has no `ResidentialStreet` row. Pre-existing, unchanged by this work.

## 2. Public listings API

`api/content/v1/listings/recent` now emits the resolver name in the existing `streetName` field and adds `streetSlug`.

```
BEFORE (raw MLS, as the API emitted it):
{
  "mlsNumber": "W13668088",
  "address": "383 Main Street E 302, Milton, ON L9T 8K8",
  "streetName": "Main St E",
  "neighbourhood": "1035 - OM Old Milton",
  "city": "Milton",
  "price": 489900
}

AFTER (resolver name + streetSlug):
{
  "mlsNumber": "W13668088",
  "address": "383 Main Street E 302, Milton, ON L9T 8K8",
  "streetName": "Main Street",
  "streetSlug": "main-street-milton",
  "neighbourhood": "1035 - OM Old Milton",
  "city": "Milton",
  "price": 489900
}
```

`address` is left alone — it is the MLS address of record, not a display name.

## 3. Build

```
BUILD EXIT=0
7 prebuild tests PASS
no compile errors
```

Committed as `4c05cc5`, pushed to `origin/feat/name-source`.

## 4. Vercel — GATE FAILED

```
npx vercel whoami
  Vercel CLI 59.11.2 (Node.js 20.20.2)
  > Logged out.
  > Run `vercel deploy --temporary` ... or `vercel login` to log in.

project linked?  no .vercel link
```

Not logged in, not linked. **Stopping as instructed.**

## 5, 6, 7 — NOT RUN

No preview URL. The verify battery, the extended name guard against a preview, the H1/title curls, the 301 status codes and the sold-stats analytics check all require a deployed preview and did not run. Nothing is being reported for them.

## To unblock

Either works, and both need to be done by you — I will not attempt an interactive login:

- `vercel login` then `vercel link` in `D:\miltonly`, or
- put a `VERCEL_TOKEN` in the environment

Then I can run steps 5–7 exactly as written.

## If you would accept a local substitute instead

`next start` against the branch build I just made would serve the real branch on `localhost:3000`, and every check in steps 6 and 7 would run against it — battery, guard, H1/title curls, 301 status codes, sold-stats. That is not a preview deployment and I did not do it unasked, partly because orphaned Next processes locked the Prisma engine and broke a build earlier today. Say the word and I will, managing the process lifecycle explicitly.

## State

| | |
|---|---|
| branch | `feat/name-source` @ `4c05cc5`, pushed |
| commits | `2a88b59` Build 1, `4c05cc5` amendments |
| merged | **no** |
| working tree | clean |
| published street pages | 427 |
| Build 2 still untouched | content regeneration, adjacency re-run, `faqJson`, `description` |
