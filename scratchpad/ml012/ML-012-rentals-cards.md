# ML-012

LEADS · D:\miltonly-leads · feat/leads

**Built, gated, previewed. The proven tree is `4bc9343e613c9770291c68014937aba12f85d21c`, one preview `miltonly-ahq9hojts` at that SHA, battery `PASS · 24 checks · 719 pages · 617s`; above it sit only this docs commit (the report, the handoff, the queue mark, the evidence) and a merge of `origin/main` at `c636e20`, MC-045's report, which is docs only.** Both defects are fixed on the branch, which also carries ML-005 (`064c5b6`) and `origin/main` at `be6c5bc` (MC-043), merged in as `bcf9a18` before any edit; `git diff 4bc9343 <tip> -- src prisma scripts package.json` is empty. Not merged: Core merges by SHA. This is a fix for a live production defect, so under DEC-BATCH-MERGE it merges and deploys alone.

Every gate passed before the push:

- prebuild gates on the final tree, each exit 0: `vow-fields` 111, `core-batch-3` 57, `lead-forms` 222, `audit-night-1` 57, `neon-egress` 63, `build-cost` 44 assertions; `tsc --noEmit` clean; `next lint` clean on the five files;
- local gate `pnpm build` on Node 22, **exit 0 in 709 s, 841 of 841 pages, 0 `P2024`** (the tree of `4bc9343`);
- local battery on `next start -p 3100` at `4bc9343`: **`PASS · 24 checks · 719 pages · 593s`**;
- one preview, `miltonly-ahq9hojts`, `npx vercel deploy --yes` with the SHA passed: **`PASS · 24 checks · 719 pages · 617s`**. A first deploy, `miltonly-5mvsnjf2g`, never became a preview: Vercel's builder failed the `vercel-ignore` prebuild gate in 80 s because this Windows checkout had given `scripts/vercel-ignore.sh` CRLF line endings (`.gitattributes` says `text=auto`, `core.autocrlf` is true, and the CLI uploads the working copy as it is), so bash on Linux answered neither BUILD nor SKIP. The working copy was normalised to LF, byte-identical to the index, and the second deploy is the preview; no code changed between them.

## 1. The cards' specs: the token, not the call sites

**`--t4` is not wrong globally. It is declared on `.rentals-page` and nowhere else, and its value is right for the ground aaff821 chose it for; the token was misapplied on the one light island, because the token had no ground.** aaff821 (2026-09-13, the chrome) moved `--t4` from `#94a3b8` to `rgba(255,255,255,.72)` and `--t5` to `.86`. That is white on the deep ground, 7.13:1 on `--mid` and 8.03:1 on `--navy`, where 16 of the 21 live `--t4` reads sit (the hero, the wizard, the filter bar, the booking card). On the white listing card, where four reads sit, white at 72% composites to white: **1.0:1** on beds, baths, parking, "/ month" and the separator. The same commit moved `--t3` the other way, to `#6b6f6a`: right on the card and 2.39:1 on `--mid` and 2.78:1 on `--navy`, where 11 of its 17 live reads sit (both placeholders, the booking card's lines, the alert strip's fine print, "Select filters above").

**The fix is two declarations.** The root keeps the deep-ground ramp (`--t3` becomes white at 60%, 5.41:1 and 6.07:1), because this is a deep-ground page, and the two light islands, `.listings-sec` and `.sdrop`, redeclare the ramp for a light ground: `--t3 #6b6f6a`, `--t4 #6e726d`, `--t5 #6e726d`. `#6e726d` clears 4.5:1 on white (4.89), on `--surf` (4.52) and on `--pearl` (4.82); a paler grey does not clear it on `--surf`, so the light ramp ends there and `--t5` repeats it (its only consumer is a dead selector). No consumer was patched. Six literals in the same file now read the ramp instead of a hex: `.q-of`, `.back-lnk`, `.submit-note`, `.ra-count` and `.ra-label`, which aaff821 left at 1.0:1 to 4.0:1 on the deep ground, and the card's MLS line (`#94a3b8` since April, 2.56:1). Nine of the ramp's selectors (`.fpill-select`, `.prio-txt`, `.cnt-btn`, `.time-main`, `.fsp-*`, `.tb-browse`, `.cf-opt`) have no markup left since aaff821's 71-line removal from the client; they were left as they are.

**Measured on the real served page** (`scratchpad/ml012/measure.mjs`, Chrome, computed colour composited over every ancestor's background), production `5f8cdb0` before and the preview `miltonly-ahq9hojts` at `4bc9343` after:

| field | before | after |
|---|---|---|
| beds (`.lspecs`) | **1.0:1** white on white | **4.89:1** `#6e726d` on white |
| baths (`.lspecs`) | **1.0:1** | **4.89:1** |
| parking (`.lspecs`) | **1.0:1** | **4.89:1** |
| "/ month" (`.lprice span`) | **1.0:1** | **4.89:1** |

The other consumers of the ramp, and the literals it absorbed, on the same two hosts:

| site | ground | before | after |
|---|---|---|---|
| the separator `.lcard-links .sep` | card | 1.0:1 | 4.89:1 |
| the MLS line (inline) | card | 2.56:1 | 4.89:1 |
| `.q-of` "Question 1 of 3" | wizard | 1.0:1 | 6.04:1 |
| `.back-lnk` "← Back", steps 2 and 3 | wizard | 1.0:1 | 6.04:1 |
| `.submit-note`, the CASL fine print under the wizard submit and on the success screen | wizard | 1.0:1 | 8.04:1 |
| `.ra-label` "1 Bed Condo →" | rent band | 3.97:1 | 7.53:1 |
| `.ra-count` "123 listings" | rent band | 2.56:1 | 5.72:1 |
| `.bc-sub`, `.bc-trust`, `.as-fine`, the search placeholder, "Select filters above" | booking card, alert strip, hero | 2.39:1 | 5.43:1 |
| `.fs-reset` in the empty state (computed; needs a filter set with no match) | `--surf` | 1.06:1 | 4.52:1 |

Every live `--t4` read now clears 4.5:1 on its ground (the full 29-site table is in the review notes, `scratchpad/ml012/review-result.json`). `--t1` and `--t2` are read only on the light islands and were not touched.

**Found, measured, and not fixed here, because it is a design decision:** the override block at the top of `rentals.css` (lines 19 to 27), which aaff821 wrote to paint the accent as the signal green on the deep ground, loses every cascade contest to the later rules of equal specificity that paint `var(--amber)`, which the same commit remapped from `#f59e0b` to `#017848`. The comment "those rules are overridden below" states the opposite of the cascade. Live, on production and on the preview alike: the hero's "Milton" 2.56:1 (35 px), the "Search →", "Show results", "Save this search →" buttons and the wizard's primary button at 2.56:1 (navy on `#017848`), `.ra-eyebrow` and `.trust-why-ico` 2.56:1, `.ra-view` 2.35:1, `.mc-v em` 2.20:1, `.q-badge` 1.72:1, `.vtab.on` 2.95:1. Moving the block to the end of the file is not the fix (it would put `#00ff80` on the white card's "See this today" button and on the pearl booking button); each selector needs its ground decided, as this task did for the muted ramp, and the result turns a dozen elements signal green. Also sub-AA and visible: four `#8a8f8a` literals at 4.32:1 on the navy (`.new-this-week`, `.trust-row`, `.wiz-sub`, `.ra-subtitle`), and the shared `AgentContactSection` email line at 3.98:1, which is Home's.

## 2. The street links: the published page or nothing

**Cause.** `RentalsClient.tsx` sliced a slug out of the address text, unit included: "115 Nipissing Road 2004" became `/streets/nipissing-road-2004` and "1 Yates Drive Bsmt" became `/streets/yates-drive-1-bsmt`. Neither carried the town suffix, so the ones without a unit reached their page only through the middleware's suffix 301.

**Fix.** Both pages select `streetSlug` and `streetName`; `src/lib/rentalStreetPage.ts` resolves the row's slug the way the middleware resolves an inbound URL (exact, then the curated map, then the identity rule) and links it only when the result is in `publishedStreetPageSlugs()`, the sitemap's set (a published `StreetContent` row AND a `ResidentialStreet` entity, so a linked slug is canonical and cannot 301 or 404). The anchor text is what the page's own heading says: `resolveStreetName` over the page's fallback chain (the rural side-road name, then the published row's `streetName`), not the listing's `streetName`, which carries the feed's unit noise. A rental on a street with no page gets no street entry in the card's link row; the neighbourhood link stays. A withheld listing is `null` before any lookup. The raw street columns leave every row before serialisation, so no payload carries a withheld listing's street. The `/rentals` Upstash bundle key moved from `v3` to `v4`, since a `v3` bundle would link no street on any card. Nothing creates a page; nothing writes.

**Re-crawled, all four views, every distinct link fetched with `redirect: manual`:**

| view | cards | before: links / 404 / 301 / 200 | after: links / 404 / 301 / 200 | cards with no link |
|---|---|---|---|---|
| `/rentals` | 47 | 47 / **28** / 19 / 0 | 43 / **0** / 0 / 43 | 4 |
| `/rent` | 47 | 47 / **28** / 19 / 0 | 43 / **0** / 0 / 43 | 4 |
| `/rentals?neighbourhood=timberlea` | 48 | 48 / **47** / 1 / 0 | 47 / **0** / 0 / 47 | 1 |
| `/rentals?neighbourhood=harrison` | 43 | 43 / **11** / 32 / 0 | 39 / **0** / 0 / 39 | 4 |

Before is production `5f8cdb0` on 2026-09-24: 114 links to 404 pages across the four views (MA-010 counted 115 on 09-23; one lease left the set) and not one direct 200. After is the local server at `4bc9343` and the preview `miltonly-ahq9hojts`, which agree line for line: **0 links 404, 0 redirect, 172 answer 200, and 13 cards render with no link.** The 13 are rentals whose feed slug is not a published page and does not resolve to one: `clarriage-court`, `robert-street`, `nipissing-street`, `mctrach-crescent` (on `/rentals` and `/rent`), `ontario-street-s-street` (Timberlea), `mctrach-crescent`, `wise-crossing-n-a`, `mcdougall-cross-n-a`, `mccandles-court`, `mcdougall-crossing-n-a` (Harrison). The canonical rule rescued one: `nipissing-rd-road-milton` links `nipissing-road-milton` (one card on `/rentals` and `/rent`, one in Timberlea). The `-n-a` and doubled-suffix variants the identity rule does not collapse are the /streets pipeline's to decide, if at all; this task links only what exists. A card count below 48 is the client's default price band (1,500 to 5,000), unchanged.

**Anchor text.** `scratchpad/ml012/names-check.mts` compares every linked card's text with the heading its page renders, for the 48 newest leases of each view: **134 linked cards, 0 mismatches.** Before the review's fix the linker fed the listing's `streetName` and five Nipissing Road cards would have read "Nipissing Road 520 A" and "Nipissing Road East".

## 3. Review

Forty agents, four lenses (correctness, VOW and names, the CSS table, the constraints), three skeptics per finding: 12 findings, 8 confirmed, 4 refuted. All 8 are in `4bc9343`:

- the anchor text diverging from the page heading on off-registry streets (S2, above);
- a feed-variant slug with a page getting no link (S3, two lenses; the canonical rule, above);
- `.back-lnk` at 1.0:1 on the wizard (S2) and `.submit-note`, the consent fine print, at 1.0:1 (S2): the same aaff821 literal the first draft fixed on `.q-of`;
- `.ra-label` at 3.97:1 (S3);
- the consumer counts in the CSS comment, twice (S4): rewritten from the review's table.

Refuted: "lightest" in a CSS comment as a superlative (reworded anyway), and the island `--t5` at 3.29:1, which had no live consumer (set to `#6e726d` anyway). The constraints lens also verified the override-block finding in section 1 and that nothing under `scripts/audit/`, `src/app/streets/`, `src/lib/streetSurface.ts`, `src/lib/streetName.ts`, `src/middleware.ts` or `prisma/` changed.

## 4. For Core

- **Merge `4bc9343e613c9770291c68014937aba12f85d21c` by SHA**, or the tip: `git log 4bc9343..origin/feat/leads` lists this docs commit (the report, the handoff, the queue mark, the evidence under `scratchpad/ml012/`), the merge of `origin/main`, and MC-045's docs commit `c636e20` that the merge brings; no app file differs between `4bc9343` and the tip. Both carry ML-005 (`064c5b6`), whose preview never completed under the 402 pause; this preview covers it, and its prebuild gate (`lead-bot-gate`, 21 assertions) passed in this build.
- `origin/main` at `c636e20` is an ancestor of the tip (`be6c5bc` was merged as `bcf9a18` before the work; `c636e20`, docs only, after the preview). Run `git merge-base --is-ancestor origin/main <sha>` after the last fetch.
- After the deploy: the `/rentals` bundle is keyed `v4` and rebuilds itself; nothing to purge.
- **`.gitattributes` needs `*.sh text eol=lf`** (it has the rule for `*.sql`). Core's worktree wrote the ignore script with LF and its CLI previews pass; any worktree that receives the file through a checkout gets CRLF and its CLI preview fails the same gate. One line, Core's file; not added here because the proven tree was already gated.
- **Two things to learn from this run.** Claude Code reaped the second local gate at 630 of 841 pages "because the system is running low on memory" (4.8 GB free of 15.9, five sessions open). The MC-035 detached runner survives that, but not as a PowerShell process: there `bash` on PATH is not Git's, and the `vercel-ignore` prebuild answers 99 on all twelve cases. `scratchpad/ml012/gate-build.sh`, launched with `Start-Process` on Git's `bash.exe -l -c` with `/usr/bin` on PATH, is the form that works; `run-start22.sh` there is the same for `next start`.

## 5. Left open, for the owner

- The accent override block (section 1): a Leads surface, a design decision, a later task.
- The four `#8a8f8a` literals at 4.32:1 on the navy, same file.
- The rentals alert strip still promises an SMS "before it appears on any other site" (HANDOFF-leads open item 11).

Report: scratchpad/ml012/ML-012-rentals-cards.md
