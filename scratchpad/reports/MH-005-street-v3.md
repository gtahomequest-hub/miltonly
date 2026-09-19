# MH-005
HOME · D:\miltonly-home · feat/street-v3

**Street Page v3, previewed, NOT merged.** Head `2553f2ed83139ea738010a3b51c41287ef78385e`, preview `https://miltonly-8g65ix8ay-gtahomequest-hubs-projects.vercel.app` (CLI deploy, `VERCEL_GIT_COMMIT_SHA` as env), full battery on it with the full SHA: `PASS · 20 checks · 606 pages · 764s`. Local build exit 0, zero `P2024`. Branched from `origin/main@5ac650b`; MA-001 changes 2 through 10 one commit each, then the phone-review items, then the gates. The MH-005 pre-step (the icon set) is its own branch, `fix/favicon@9144b35` from `origin/main`, pushed for Core to merge first and merged into this branch.

**Vercel pause, 2026-09-19.** Every gate above ran on the preview before the pause; the preview and production both answer 402 now, for about seven hours. Nothing on this branch is pending: the merge is Core's and waits for production to answer 200. Anything that follows on this worktree gates locally (`pnpm build`, `next start` on a free port, `BASE=http://localhost:<port>` with the local build SHA) and says "gated locally, preview pending" until Vercel is back.

## Lighthouse mobile, the ten audit streets (slow-4G Moto G preset), production before against the preview after

| street | perf before / after | LCP before / after | TBT before / after | bytes before / after | a11y | best practices |
|---|---|---|---|---|---|---|
| woodward-avenue | 55 / **78** | 6.3s / **3.6s** | 349 / **178** ms | 3.2 MB / **489 KB** | 91 / 100 | 79 / 100 |
| beaver-court | 66 / **89** | 5.0s / **3.2s** | 406 / **6** ms | 910 KB / **371 KB** | 91 / 100 | 79 / 100 |
| harvest-drive | 76 / **89** | 3.9s / **3.2s** | 475 / **0** ms | 907 KB / **368 KB** | 91 / 100 | 79 / 100 |
| scott-boulevard | 70 / **79** | 5.3s / **4.3s** | 414 / **146** ms | 1.9 MB / **528 KB** | 91 / 100 | 79 / 100 |
| sauve-street | 69 / **91** | 6.3s / **3.4s** | 222 / **7** ms | 5.3 MB / **443 KB** | 91 / 100 | 79 / 100 |
| guelph-line | 66 / **90** | 6.5s / **3.6s** | 282 / **8** ms | 7.1 MB / **508 KB** | 91 / 100 | 79 / 100 |
| richardson-way | 80 / **91** | 3.7s / **2.9s** | 381 / **12** ms | 903 KB / **364 KB** | 95 / 100 | 79 / 100 |
| bussel-crescent | 73 / **90** | 3.8s / **3.2s** | 469 / **7** ms | 914 KB / **374 KB** | 91 / 100 | 79 / 100 |
| main-street | 66 / **91** | 5.0s / **3.4s** | 612 / **49** ms | 18.1 MB / **539 KB** | 91 / 100 | 79 / 100 |
| frost-court | 78 / **86** | 4.5s / **3.7s** | 300 / **10** ms | 989 KB / **450 KB** | 91 / 100 | 79 / 100 |
| **median** | 70 / **90** | 5.0s / **3.4s** | 394 / **9** ms | 1.4 MB / **446 KB** | 91 / 100 | 79 / 100 |

The preview's `X-Robots-Tag: noindex` fails Lighthouse's `is-crawlable` on every after-run (SEO 66 to 69 instead of 100); that is the preview host, not the page. Accessibility 91 to 100 on all ten (`color-contrast`, `heading-order` and `target-size` cleared); best practices 79 to 100 (the pixel no longer sets a cookie before interaction). **LCP is not yet under 2.5 s under this lab preset** (2.9 to 4.3 s): the element is the hero's summary paragraph and its render delay is the document (48 KB brotli), one CSS chain and 167 KB of woff2 (Fraunces variable 66 KB, Inter 400 to 700) on a 1.6 Mbps link with 150 ms RTT. Fewer Inter weights and a static Fraunces cut would be the next lever; TBT (median 394 to 9 ms) and bytes (median 1.4 MB to 446 KB, Main Street 18.1 MB to 539 KB) are done.

## The changes, one commit each

2. **Photos as images** (`3376c6b`). `ListingTile` renders `next/image` with `sizes` for the tile, AVIF/WebP, the first two eager and the rest lazy, decoding async. The feed's `rs:fit:3840:3840` is inside a signed path and cannot be changed, so the optimiser resizes the source (`images.remotePatterns` for `trreb-image.ampre.ca`); a 640px tile is a 21 KB AVIF against 270 KB and up. Each unique source photo counts once toward the Vercel image-optimisation quota.
3. **The render-delay budget** (`a75ba32`). gtag.js and fbevents.js load on first interaction or idle six seconds after load; two inline stubs (`DeferredTags.tsx`) queue every `gtag`/`fbq` call from the first byte so no caller changes. Geist's two `.woff` files are deleted (Tailwind's sans is Inter); Playfair is not preloaded off the homepage; everything left is woff2. The RSC duplication of the address list is trimmed by change 8's client island. The `/rent` layout's duplicate gtag.js is gone.
4. **One field under the hero** (`4545444`). `StreetCapture`: valuation (source `street-valuation`, new, intent sell) or watch (`street-alert`), one email field, the street as `property_address`, through `postLead`. Every `/sell` link on the page carries `?street=<name>#valuation` (`sellHrefFor`).
5. **The sold gate from the top** (`fd82fb1`). "N closed sales in the last 12 months · see every one, free" in the hero, anchored to `#sold-records`; the gate is the server-rendered default and a signed-in visitor's rows replace it; no "Loading sold records" row. The gate button was already the CTA token (MH-008).
6. **The head** (`a9451d0`). Title `<Street>, Milton: Homes, Prices and Sales History`; description hook-first, cut at a word under 155; `og:image` the poster where filmed, else `/streets/<slug>/og.png`, an edge `ImageResponse` fed by `/api/streets/<slug>/card` (`6524a20`: the Node renderer 500ed); `lastUpdated` is the later of the profile's generation and the latest closed sale, stated as "Updated <date>" and as `dateModified` on a new `WebPage` node with `image` and `about`.
7. **The heading tree** (`297e862`). H2 over the prose (the generated "About" section drops its duplicate H3), H3 sidebar and context cards, "Questions about <street>" for the FAQ; a sale pill links `#type-<type>` only where that section renders, a lease pill links `#leases` on the leases card, otherwise the pill is a span. `guide-links.mjs` reads either form.
8. **The ladder** (`5dd57d8`, `256314a`, `d3197ae`). A house-number field at every width scrolls to and highlights the mark or names the nearest; on a phone the same DOM flows as one column in number order, 44px rows with the detail beside each, cross streets as named rows, in a box at most two thirds of the screen that scrolls inside itself; above sixty addresses it is collapsed behind the field and "Show all". `LadderTrack` is a client island fed a tuple per address; the anchor guard's markup contract holds (52 assertions).
9. **The copy holes** (`2b9884c`). `isResidue` drops a FAQ answer that is only the caveat or one hedge sentence, from the page and the FAQPage node; `isFragment` drops a one-sentence section; "before it reaches the public portals" and "Response within one hour" are gone; a programme page's subtitle is its neighbourhood or nothing; the placeholder says there is no written profile yet; `/streets` labels its figure "Typical asking, listed now".
10. **Axes and reasons** (`06e3187`, `4fc42b9`). Bars carry their typical and count against an axis; a year-on-year sentence where both four-quarter windows clear k5; the minimal template's "Market activity score" is replaced by the neighbourhood typical; silent cells and pills say "needs 5 sales, has 3" (10 for a band).
- **The phone-review items** (`2c04cae`, `d3197ae`, `2553f2e`): the price first in the hero; a 12px floor on every size on the page and the guides block; eyebrows on the deep ground at 11:1 and the trust line at 0.78 white; `AggregateOffer` replaced by `PropertyValue`s on the Place (the typical sale price per type with window, sample and a description that says it is a statistic); 44px targets on a coarse pointer for the pills, the ladder sentence's links, the fine-print link and the breadcrumb. **The night poster has no live case**: zero rows carry a night clip after MC-015's rekey; a per-clip poster is the upload script's to write when the next one is filmed (Core).

## Gates

- `phone-390.mjs` (`691e7ca`): on the street page the ladder must have the field, and its track, opened, must be no taller than the viewport and scroll inside itself.
- Full battery on the preview: `PASS · 20 checks · 606 pages · 764s`.
- MA-001 harness re-run on the preview (`scripts/audit/street-page.mjs`, output in the session scratchpad): ten streets, both widths, all 200, one H1 and valid JSON-LD on every run, no horizontal overflow; on mobile the first CTA at screen 0.02 on all ten (was 2.1 to 5.7), sub-44px targets 26 to 34 per page (was 286 to 365 on the ladder streets; what remains is the nav, the footer's hub links at 27 to 41px wide, the inputs at 22 to 26px tall), font-floor findings 0 on every page (was a fifth of the page's text), document height 11.1 to 31.8 screens (was 9 to 33.2; Main Street 31.8). The harness's contrast probe still flags the sold gate's three lines at 1:1 against white: it reads the gate's ground as the page's, not the forest gradient the gate paints; a probe defect, not a page one.

## Outside Home's files, flagged

`src/lib/street-data.ts`, `src/lib/streetV2Data.ts`, `src/lib/prose/numericSentences.ts`, `src/lib/schema/street-schema.ts`, `src/app/streets/[slug]/page.tsx` and `src/app/streets/page.tsx` (the street page and its data, changes 4 to 10), `src/app/layout.tsx` and `tailwind.config.ts` (change 3), `src/lib/lead/sources.ts` and `notify.ts` (the `street-valuation` source), `next.config.mjs` (`images`), `scripts/verify/checks/guide-links.mjs` (the pill match), `src/components/guides/guide-uplinks.css` (12px). Deleted: `MetaPixel.tsx`, `GoogleAnalytics.tsx`, the two Geist fonts.

Core merges by SHA on approval; `fix/favicon@9144b35` first.
