# MH-006
HOME · D:\miltonly-home · feat/nav-v3

**Preview:** https://miltonly-ob5xg0oae-gtahomequest-hubs-projects.vercel.app
**Head:** `287f8adcc174896cb97a8bd514454bd397f41921` (the app; one docs-only commit sits on top of it with this report, the handoff and the queue line) · **Battery on the preview:** `PASS · 17 checks · 509 pages · 666s` · **Local build:** exit 0, zero `P2024`, prebuild all green, 609/609 static
**Five audit pages on the preview:** https://miltonly-ob5xg0oae-gtahomequest-hubs-projects.vercel.app/ · https://miltonly-ob5xg0oae-gtahomequest-hubs-projects.vercel.app/streets/woodward-avenue-milton · https://miltonly-ob5xg0oae-gtahomequest-hubs-projects.vercel.app/neighbourhoods/timberlea · https://miltonly-ob5xg0oae-gtahomequest-hubs-projects.vercel.app/listings/W13117744 · https://miltonly-ob5xg0oae-gtahomequest-hubs-projects.vercel.app/guides/what-milton-neighbourhoods-cost
**Stopped. Core merges by SHA on approval.**

## The resume

The crash left `SiteNav.tsx` half-edited (change 5) on `feat/nav-v3`. The change was stashed by path (`git stash push -- src/components/nav/SiteNav.tsx`, tagged, applied by SHA, dropped by tag), `origin/main` merged (`79590c3`, MC-021 and MA-003), the edit finished and committed as `ad547f8`. A second merge of `origin/main` before change 2 found nothing new. The local chrome battery (nav, homepage, footer against `next start`) caught one finding, a closed `<details>` whose fixed panel still reported a box; fixed in `287f8ad`, rebuilt, re-pushed, and the full battery run on the preview of that head.

## The ten changes: where the branch stood, and what this task did

| # | change | before this task | now |
|---|---|---|---|
| 1 | the bar on the scrolled homepage at 390 | done, `fa01446` | unchanged |
| 2 | a footer on every street page | not done | **done**, last, both templates end in `SiteFooter` with the page's context |
| 3 | the CTA colour on street pages | done, `2e3b8e3` | unchanged |
| 4 | listing page and guides on the forest chrome, `Navbar`/`FooterSection` deleted | done, `89535dd` | unchanged |
| 5 | the street search in the bar, first in the rail, a menu before hydration | half-edited, uncommitted | **done**, `ad547f8`: bar search on the page variant at 1024 and up, `<details>` phone menu with a compact copy in the HTML, every search form a GET to the new `/search` redirect route |
| 6 | carry the context | not done | **done**: `NavContext` from street and hub pages; CTA to `/sell?street=…#valuation` or `/value/<hub>`; brief form posts `property_address`, `neighbourhood`, `consentText`, `consentTimestamp` |
| 7 | one basis per figure | not done | **done**: the Sell panel prints one sentence naming the mix-adjusted basket, the 13-week urban sample and /sold's 12-month sample; the date in prose; the A to Z claim dropped |
| 8 | Alerts honest, footer captures | not done | **done**: the Alerts CTA is the brief form's submit; `/saved` `noIndex`, out of the nav; the footer has the brief field beside its search |
| 9 | the footer is the map | not done | **done**: 8 guides, schools and mosques with counts, current edition, `/compare/freehold-vs-condo`, Privacy, Terms, `/sold` once, `<h2>` then `<h3>`, 44px on touch, 12px at 0.66 white on the compliance line |
| 10 | spend the link weight where the page is | not done | **done**: hub pages get the hub's streets, street pages their neighbours and the hub's busiest (`megaContext.ts`); rail sub-labels and counted CTAs; skip link and `aria-label` on the nav; "Also" links 24px, pills and links 44px on a coarse pointer |

## The addendum: pages moved onto the forest tokens

Converted (body palette, Fraunces headings, one footer): **`/rentals`** (tokens remapped in `rentals.css`, the page's own footer removed, four inline literals), **`/exclusive`** and **`/exclusive/<slug>`** (with `AgentSidebar`, `Gallery`, `InquiryForm`; the mojibake in both files repaired, the em-dash titles rewritten), **`/about`**, **`/saved`**, **`/signin`**, **`/privacy`**, **`/terms`**, and the **404 page** (now inside `SiteChrome`, so a lost visitor gets the bar and the map). All under `SiteChrome`, which now carries `site-chrome.css` (the tokens, Fraunces on h1 to h3). 10px and 11px text on these pages lifted to 12px.

Already on forest themes, verified by their token blocks and not touched: `/sold` (`.sold-v2`), `/listings` (`.listings-v2`), `/condos-guide` and `/potl` (`.hub-v2` tenure hub), `/compare` (`.hub-v2`). `/rent` carries no navy literal.

## Gates

- **`nav.mjs`** extended: the served chrome contract on five page types (labelled nav, skip link, GET search form, `<details>` menu with its compact copy, no `/saved`); the CTA and strips following the street or the hub; sub-labels on the rail; the phone panel under the 66px bar; Escape closing the `<details>`; two no-JS browser runs (380 through the burger, 1440 through the bar), each landing the search on the street it names. Streets rail order updated.
- **`homepage.mjs`** extended: the same contract on the homepage's own render, plus the map footer's legal and guide links, `/sold` once, the brief form.
- **`footer.mjs`** (from `89535dd`): thirty page types, exactly one map footer under one bar, every hub, every map destination, `<h2>`/`<h3>`, search well and brief form, every href 200. It asserted the map before the footer was one; it passes now.
- **Local build** exit 0, zero `P2024`, prebuild all green, 609/609 static.
- **Lighthouse**, the five audit pages, mobile and desktop, production before (`main` at the time of the run) and the preview after:

| page | preset | perf | a11y | seo | LCP ms | TBT ms | contrast fails (chrome) | target fails (chrome) | heading-order | a11y fails |
|---|---|---|---|---|---|---|---|---|---|---|
| home | mobile | 63 → 68 | 95 → 97 | 100 → 69 | 5291 → 5069 | 317 → 125 | 19 (1) → 18 (0) | 0 (0) → 0 (0) | 0 → 1 | color-contrast/heading-order → color-contrast |
| home | desktop | 82 → 85 | 95 → 97 | 100 → 69 | 2104 → 1760 | 11 → 3 | 22 (1) → 21 (0) | 0 (0) → 0 (0) | 0 → 1 | color-contrast/heading-order → color-contrast |
| street | mobile | 60 → 71 | 91 → 91 | 100 → 66 | 6304 → 6357 | 472 → 112 | 1 (0) → 1 (0) | 286 (0) → 286 (0) | 0 → 0 | color-contrast/heading-order/target-size → color-contrast/heading-order/target-size |
| street | desktop | 90 → 94 | 91 → 91 | 100 → 66 | 1767 → 1503 | 113 → 32 | 1 (0) → 1 (0) | 232 (0) → 232 (0) | 0 → 0 | color-contrast/heading-order/target-size → color-contrast/heading-order/target-size |
| hub | mobile | 69 → 83 | 96 → 100 | 100 → 69 | 3774 → 3364 | 412 → 105 | 1 (1) → 0 (0) | 0 (0) → 0 (0) | 1 → 1 | color-contrast → none |
| hub | desktop | 87 → 92 | 96 → 100 | 100 → 69 | 1155 → 1212 | 18 → 0 | 1 (1) → 0 (0) | 0 (0) → 0 (0) | 1 → 1 | color-contrast → none |
| listing | mobile | 63 → 63 | 92 → 92 | 100 → 69 | 9662 → 9943 | 425 → 280 | 64 (1) → 61 (0) | 0 (0) → 0 (0) | 1 → 1 | color-contrast/label → color-contrast/label |
| listing | desktop | 92 → 89 | 92 → 92 | 100 → 69 | 1804 → 1875 | 11 → 3 | 67 (1) → 64 (0) | 0 (0) → 0 (0) | 1 → 1 | color-contrast/label → color-contrast/label |
| guide | mobile | 58 → 76 | 96 → 96 | 100 → 66 | 5239 → 5426 | 499 → 186 | 4 (1) → 1 (0) | 0 (0) → 0 (0) | 1 → 1 | color-contrast → color-contrast |
| guide | desktop | 98 → 97 | 96 → 96 | 100 → 66 | 1009 → 1015 | 9 → 3 | 4 (1) → 1 (0) | 0 (0) → 0 (0) | 1 → 1 | color-contrast → color-contrast |

  Reading it: the `seo` column is a preview artefact, `is-crawlable` failing on the `X-Robots-Tag: noindex` every Vercel preview sends; production will not carry it. The chrome no longer appears in any contrast or target finding on any of the ten runs (the `(chrome)` counts, 1 on eight runs before, 0 on all ten after); `heading-order` passes on the homepage, which named the footer's `<h4>`s; the hub reaches a11y 100 with no failing audit; the guide's contrast findings fell from 4 to 1. What remains is each page's own: the street page's `target-size` (the address ladder's marks, MA-001) and `heading-order`, the listing page's `label` and its 61 body contrast findings, one `color-contrast` in the guide body. TBT fell on all ten runs and mobile performance rose on four of five page types.

## Owned elsewhere

- The brief signup's watch kind is keyed on `source` in `src/lib/lead/savedSearch.ts` (Leads). The forms now post the street and hub; making a street-page signup a street watch is that file's one-line call.
- `/sold`'s own basis sentence (Core): the panel says why 334, 632 and 1,729 differ; the destination does not yet.

Report: scratchpad/reports/MH-006-chrome.md
