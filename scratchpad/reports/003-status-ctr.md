Committed on `fix/signin-unblock` as `51a13cf`. Build + merge deferred until the audit workflow stops writing scratch files into the repo root — building now just races them.

## Status

- **Done** — `/signin` removed from the `robots.ts` disallow; both comment blocks rewritten to describe the post-change state. Typecheck clean.
- **Deferred** — build + merge + deploy, a few minutes out. Not urgent, so waiting costs nothing.
- **Running** — CTR audit across 5 dimensions with an adversarial challenge pass on each.

## The temp-file collision is mine

I told the audit agents to write scratch `.ts` files into the repo root, because module resolution for `@/lib/prisma` fails outside it. They are untracked and self-deleting, but `next build` picks them up from the tsconfig include path. It did not touch the commit — the two source files were staged by path — but the strays need sweeping before the real build.

## What I noticed in generateMetadata

There is a hardcoded per-slug override for `bennett-boulevard-milton` at `src/app/streets/[slug]/page.tsx:38-56`, and the comment below it says the general title formula was *"proven by the Bennett SERP rewrite."* The two do not match:

| | Title |
|---|---|
| Bennett override | `Bennett Boulevard, Milton — Homes, Sales & Street Guide` |
| General formula | `<name>, Milton — Homes, Prices & Sales History` |

Different suffixes. So whatever was tested on Bennett is not what the other 427 pages emit, and nothing in the repo establishes that either version actually earned clicks — the comment cites a GSC report from 2026-07-18 that recorded the *problem* (position 7.6, zero clicks), not a result. The audit has been told to treat "proven" as an unverified claim and check whether Bennett's CTR actually moved after the rewrite.

## Ask

Page-level GSC for `/streets/bennett-boulevard-milton`, before vs after 2026-07-18. That settles whether the fix is "roll Bennett's formula out to all 428" or "both formulas are wrong."

## Baseline being audited against

28-day actuals: 68 clicks, 4,260 impressions, 1.6% CTR, average position 10.2. Expectation at position ~10 is 2-3%, so roughly 2x is on the table (~130-190 clicks). Constraint: no new content.
