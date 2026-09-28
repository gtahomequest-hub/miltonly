HOME · D:\miltonly-home · feat/home-voice

# Handoff, homepage worktree

_Last rewritten 2026-09-28, MH-010: the bio sentence and the other em-dashes the audit counts every night, on `feat/home-voice`, previewed, NOT merged._

## READ THIS FIRST

**TWO BRANCHES ARE PREVIEWED AND NOT MERGED. Core merges by SHA on approval (DEC-MERGE-CORE-ONLY).**

- **`feat/home-voice @ 12dc3f72e7582b649feddb2584d798ddfe33c419` (MH-010, the em-dashes and the badge).**
  Cut from `origin/main @ ac96e39` (the 2026-09-28 morning report). Preview
  `https://miltonly-f7prm5c70-gtahomequest-hubs-projects.vercel.app`. Local gate `corepack pnpm build` from Git Bash, exit 0, zero `P2024`, 840/840 static,
  prebuild all green. The audit's em-dash rule on the preview: 0 findings from the four sources on 44 of 44 pages (20 listings, 5 condos, 5 schools, 14 others), the 11 left all in the guide prose bucket. The badge: 52 badges on 6 pages, 0 under 12px, 0 under 4.5:1 (cards 13.28:1, hero 9.81:1).
  Battery `--only=homepage,nav,hub-meta,phone-390` on the preview: `PASS · 4 checks · 719 pages · 237s`, exit 0. The docs commit above
  the work carries this handoff, the queue mark, the report and the proofs; merge the head. Record in
  `scratchpad/reports/MH-010-em-dashes.md`.
- **`feat/web-analytics @ 7cfa4a2faaebd30709ab045b7a883fdc841d86d7` (MH-009, Vercel Web Analytics).**
  Cut from `origin/main @ d068f84`. Preview `https://miltonly-l47j2kpf5-gtahomequest-hubs-projects.vercel.app`,
  `--only=homepage,nav` `PASS · 2 checks · 646 pages · 172s`. It adds one dependency
  (`@vercel/analytics 2.0.1`), so `package.json` and `pnpm-lock.yaml` change; expect a lockfile merge.
  Its handoff is the branch's own `HANDOFF-home.md` (`3c133b8`); record in
  `scratchpad/reports/MH-009-web-analytics.md`. The two branches touch no common file.

**EVERY EARLIER HOME BRANCH IS MERGED:** `feat/nav-v3 @ 3b56020` as `6aac9c9` (MH-006),
`feat/rent-menu @ 91f8ef0` as `1b2d7d8` (MH-007), `feat/mobile-fixes @ dd1118f` as `0480e15`
(MH-008), `feat/street-v3 @ 2553f2e` as `e078e91` (MH-005, MC-028). Do not add commits to any of them.

**THE EM-DASHES (MH-010).** MA-010 scoped the nightly's em-dash rule to prose and found 574 findings
from six sources. This branch clears the four the brief named, punctuation only, no wording changed:

1. `src/components/AgentContactSection.tsx:24`, the bio on every listing page, `/sell`, `/about` and
   `/rentals` (481 findings): "far more than price. It is about finding the right fit".
2. `src/lib/condoData.ts:87` "Varies by suite. Confirm with the listing or management.",
   `src/components/condo/sections.tsx:97` "Not stated. Confirm with management" and `:189` "right now.
   Register to be alerted" (56 + 12 findings).
3. 29 title, meta and share strings in 22 files, listed before and after in
   `scratchpad/mh010/title-meta-list.md` (the nightly's 19 title and 6 meta findings, plus the same
   pattern on pages the nightly does not crawl: blog, coming-soon, saved, signin, value, rentals/ads,
   the layout's fallback title and `config.seo.defaultTitleSuffix`). A colon where the second half
   elaborates the first, a comma where it qualifies, a full stop where it is a sentence, a pipe before
   the site name. The home meta was already clean: `config.seo.defaultDescription` has no dash; the
   2026-09-23 finding was the description MC-043 replaced.
4. `.pl-badge` (`src/components/places/places-theme.css`): 12px, and the blue and green tones take
   `var(--pl-text-body)` on the tint (13:1 on a white card). On `.pl-hero` the tint composites to
   `#064e33`, so the hero badge takes `var(--pl-text)`, the hero's white (about 9.8:1). `#00ff80` is
   a CTA colour again everywhere on the places pages. Amber is unchanged (7.78:1).

**LEFT ALONE ON PURPOSE.** Street titles, metas and H1s (frozen; MC-048 cleared them). The listing
title template (Core's, larger). The guide and tool prose, the sixth MA-010 source: about 150 dashes
on 25 pages (`/freehold`, `/condos-guide`, `/potl`, `/compare`, `/compare/freehold-vs-condo` and its
H1 in `comparisonData.ts:88`, `/sell`, `/sold`, `/listings`, `/rentals`, `/mosques`, the three
building pilots); those are wording, not one string, and want their own task. The four design-preview
titles (`condo-preview`, `guide-preview`, `guides-preview`, `hub-preview`), internal pages. The JSON-LD
Article description at `src/app/listings/page.tsx:93`, which the em-dash rule does not read.

**PREVIEWS COME FROM THE CLI.** `vercel.json` cancels Git-triggered builds on every branch but
`main`. `npx vercel deploy --yes --env VERCEL_GIT_COMMIT_SHA=<sha> --build-env VERCEL_GIT_COMMIT_SHA=<sha>`
from the worktree; without the env, `/api/build` says `unknown` and the battery aborts. The URL is
the `Preview` line of the CLI's output. One preview per code task (DEC-ONE-PREVIEW); a second needs a
sentence naming the check only Vercel can run.

**THE LOCAL GATE RUNS FROM GIT BASH, THROUGH COREPACK.** `pnpm` is not on PATH in this session
(no shim under `C:\nvm4w\nodejs`); `corepack pnpm build` resolves the pinned 9.15.9 on Node 22.23.2.
Run it from the Bash tool, not PowerShell: PowerShell here has no `bash` at all, so
`scripts/test-vercel-ignore.ts` (which spawns `bash scripts/vercel-ignore.sh`) answers its `99`
sentinel on 11 of 12 assertions and the prebuild fails on a build that is fine. From Git Bash the same
test passes 12/12. Puppeteer's cached Chrome download is incomplete; `scripts/audit/nightly/browser.mjs`
falls back to `C:/Program Files/Google/Chrome/Application/chrome.exe` on its own, so the proofs
launch without `CHROME_PATH`. After a `pnpm add`, run `npx prisma generate` before `tsc`.

**THE PROOFS, RERUNNABLE.** `BASE=<url> node scratchpad/mh010/emdash-proof.mjs` runs the nightly's
`pageFindings` on 20 listings, 5 condos, 5 schools and 14 other pages and buckets every em-dash finding
by source (bio, condo-cost, condo-empty, title-meta, other). `BASE=<url> node scratchpad/mh010/badge-proof.mjs`
runs the audit's `inspect()` (text under 12px at 390) and reads every `.pl-badge`'s computed size,
colour, composited backdrop and contrast. Production before: `scratchpad/mh010/proof-prod-before.txt`
(bio 21, condo-cost 3, title-meta 17, other 11 on the 44 pages) and `badge-prod-before.txt` (52 badges
at 9px, 28 under 4.5:1).

## Scope of this worktree

`D:\miltonly-home` owns **the homepage, the header with its mega menu, the footer, the
neighbourhood hub template, and the chrome wrapper for pages with no theme of their own**, and
takes voice tasks on the shared components when a brief assigns them. It never touches generation
or the database.

Owned files:

- `src/app/page.tsx`, `src/app/layout.tsx` (header/footer wiring only)
- `src/components/home/*` including `home-theme.css`, `home-sections.css`, `footer.css`, `mockData.ts`
- `src/components/nav/*` (`BriefSignup.tsx`, `SiteChrome.tsx`, `SiteFooter.tsx`, `site-chrome.css`, `LandlordSignup.tsx`)
- `src/components/hub/*`
- `src/lib/homepageData.ts`, `src/lib/megaLive.ts`, `src/lib/megaContext.ts`, `src/lib/rentSignals.ts`, `src/lib/figureFormat.ts`,
  `src/lib/neighbourhoodCards.ts`, `src/lib/homeSignals.ts`, `src/lib/hubData.ts`,
  `src/lib/hubStreetLadder.ts`, `src/lib/hubSchools.ts`, `src/lib/hubNearby.ts`, `src/lib/hubFooter.ts`
- `src/app/search/route.ts`, `src/components/ChromeGate.tsx`, `src/components/VercelAnalytics.tsx` (MH-009)
- `scripts/verify/checks/homepage.mjs`, `nav.mjs`, `hub-page.mjs`, `footer.mjs`, and the hub rows of `scripts/verify/lib/db.mjs`
- `scripts/probe-mobile-menu.mjs`, `scripts/probe-hub-contrast.mjs`

Touched outside that scope on `feat/home-voice` (MH-010), punctuation and one CSS rule only:
`src/components/AgentContactSection.tsx`, `src/components/condo/sections.tsx`, `src/lib/condoData.ts`,
`src/lib/comparisonData.ts`, `src/lib/config.ts`, `src/components/places/places-theme.css`, and the
metadata of 19 `src/app/**/page.tsx` files and `src/app/layout.tsx`. The full list is `git show --stat 12dc3f7`.

## Standing rules for this worktree

- **Every task prompt begins with `MH-`.** The report is `scratchpad/reports/MH-NNN-slug.md`,
  first line `# MH-NNN`, second line the worktree and branch, committed with the work.
- Keep this file updated instead of `HANDOFF.md`. Do not rewrite `HANDOFF.md` from here.
- Everything in the root `CLAUDE.md` still applies: pnpm only, exit-code gate, no em-dashes,
  "typical" not "median", terminal gets 10 lines or fewer, no clipboard writes.
- **Stop the local `next start` before `pnpm build`.** A running server holds the Prisma query
  engine DLL and the build fails on `EPERM ... query_engine-windows.dll.node`. Kill the
  listener first (`Get-NetTCPConnection -LocalPort 3000`).
- **Local battery needs `VERCEL_GIT_COMMIT_SHA=local pnpm start` and `EXPECT_SHA=local`.** Against a
  preview, `EXPECT_SHA` defaults to the local HEAD, so run it before the docs commit or set it.
- **The Bash tool collapses `\\` to `\` inside heredocs.** Write patch scripts with the Write tool
  into the session scratchpad and run them from there; a Python replacement script fed through a
  heredoc is fine when it carries no backslashes (MH-010 used one for the 35 edits).
- **Python's stdout redirected to a file is cp1252 here.** A generated Markdown file with em-dashes
  came out cp1252 and had to be re-encoded; write files with `io.open(..., encoding='utf-8')`.
- **Lighthouse is not a repo dependency.** MH-006 ran the audit's `nav-lighthouse.mjs` from the
  session scratchpad against an install left in the audit worktree's scratchpad.

## Where things stand

| | |
|---|---|
| MH-010 head | **`12dc3f72e7582b649feddb2584d798ddfe33c419`** (`feat/home-voice`, the work), plus the docs commit carrying this handoff and the report |
| MH-010 preview | `https://miltonly-f7prm5c70-gtahomequest-hubs-projects.vercel.app` |
| MH-009 head | `7cfa4a2faaebd30709ab045b7a883fdc841d86d7` (`feat/web-analytics`), docs commit `3c133b8` above it |
| local build | exit 0, zero `P2024`, prebuild all green, 840/840 static |
| main | `ac96e39` (the 2026-09-28 morning report); has neither branch |
| production | main's tip; the em-dashes and the 9px badge are live until the merge |

## Gates

- `nav.mjs`: the served chrome contract (label, skip link, GET search, `<details>` menu with its
  compact copy, no `/saved`), the CTA and strips following the page, sub-labels on the rail, the
  Rent contract; in a browser at 380, 390, 1024 and 1440: four menus, the bar search at 1024 and up,
  the phone panel under the 66px bar, Escape closing the `<details>`, and two NO-JS runs.
- `homepage.mjs`: the same chrome contract on the homepage's own render, plus the map footer's
  legal and guide links, `/sold` once, the brief form.
- `footer.mjs`: thirty page types, one map footer under one bar, every hub, every map destination,
  `<h2>`/`<h3>`, search well and brief form, every href 200.
- `phone-390.mjs` (MH-008): no text clipped by a 390px viewport on the page types it samples.
- The nightly audit (`scripts/audit/nightly/`, Audit's) reads production at 03:00 Toronto; its
  em-dash rule is the one `scratchpad/mh010/emdash-proof.mjs` runs.

## Traps, and decisions that must not be re-litigated

- **The bio is one sentence split in two, not rewritten.** "far more than price. It is about" keeps
  every word; a later voice pass on the bio is a wording task and needs its own brief.
- **A title's separator is a colon, not a pipe, unless the second half is the site name.** The
  pipe is what `layout.tsx` and the share titles already use before `Miltonly`; a colon reads as
  one title in a SERP, a comma as a qualifier, and neither is a dash.
- **The hero badge is white, the card badge is ink.** Both sit on the same 14% green tint; the tint
  over the dark hero is `#064e33`, over a card `#dbffed`. A single colour cannot pass on both.
  `#00ff80` is for CTAs (CLAUDE.md), and it was 1.25:1 on the cards.
- **`#00ff80` as text on the deep ground** (eyebrows on the recoloured pages, `--cta` on rentals)
  follows the hub theme's own use of `--h-green` for figures; it is not used on a light ground
  anywhere, where the accent is `#017848`.
- **The brief form's watch kind is the lead path's.** `kindForSource("daily-brief")` is `brief`
  (`src/lib/lead/savedSearch.ts`, Leads' file); turning a street-page brief signup into a street
  watch is Leads' call.
- **`@media (pointer: coarse)`** carries the 44px targets. Lighthouse's mobile preset emulates
  touch; a desktop browser narrowed to 380 does not.
- **The phone panel sits UNDER the bar** (`top: 66px`); `nav.mjs` asserts that geometry.
- **A lease figure's floor is its own sample.** `getLeaseMarket()` gates each home type's typical
  on that type's count and the three landlord figures on the pool's.
- **The figures block keys on its menu** (`menu-${menu.key}-${f.key}`); the Rent list uses `menu-rent-hub`.
- **The lease-market cache key is in `SOLD_WIDE_PATTERNS`.** A new `cached()` key over
  `sold.sold_records` fails `test-sold-cache-purge.ts` until it is.
- Everything in MH-002 to MH-009's trap lists still holds for the menu, the hub and the analytics mount.

## Open, and owned elsewhere

- **Merge**, on Aamir's approval: `feat/home-voice` and `feat/web-analytics`, each by SHA. Core.
- **The guide and tool prose em-dashes** (about 150 on 25 pages, the last MA-010 source): a
  wording task, owner to be assigned; `comparisonData.ts:88` (the H1) goes with it.
- **The nightly's count falls over four nights, not one.** It runs `main`'s `checks.mjs` (audit code
  `82c56de`, MA-010's scoped rule), but a finding on a page not re-swept that night is carried forward
  with its old excerpt, and streets and listings rotate over four nights. Expect the 585 to fall as the
  rotation reaches each listing page after the merge.
- **The street watch from a brief signup**: Leads. **`/sold`'s basis sentence**: Core.

## Next action

Aamir reviews the MH-010 preview (report has the URL). Core merges `feat/home-voice` by SHA on
approval, then `feat/web-analytics`; neither depends on the other.
