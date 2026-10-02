# MH-013
HOME · D:\miltonly-home · feat/home-hero-design

**Option D and an orange, navy and white brand are designed over the whole homepage preview at `/design-preview/home`. The preview has no green anywhere; it is previewed, NOT merged, and not for merge.**
- **Branch.** `git fetch` found `origin/main` still at `f0b8bb7`, which the branch already contains, so there was nothing to merge.
- **Work commit.** `6a8a65f`, on top of MH-012's `c7fd3ee`: 8 files. Nothing under `src/components/home/`, `src/components/nav/` or `src/app/page.tsx` changed.
- **Preview.** `https://miltonly-or9axq97u-gtahomequest-hubs-projects.vercel.app/design-preview/home` (`dpl_HqQVAoQTdAAaEtFQQbtoBa2HZCMx`), the only one.
- **Switches.** `?option=c|d`, `?palette=1|2|3` and `?wordmark=serif|script`. The default is my pick: D, palette 1, serif. MH-012's options A, B and C in green stay on its own preview, `miltonly-hokave4jn`.

**Option D, four paths.**
- **Selling** is the large navy door, and the page's one focal point.
- **Buying** is the large paper door beside it.
- **Investing** is a smaller third door, planned and not a link. Its content: "Asking rents beside asking prices, by home type, from active listings. Leased rents and sold prices for signed-in readers."
- **Renting** is a quiet line underneath.
- **On a phone** Selling and Buying stack, each with its heading and button, and the search follows them. Each side's other rows come next, then Investing, then Renting.

**Option C** is MH-012's layout in the new brand with the mature cards, Selling now first. On a phone its two doors stay side by side.

**The H1** stays MH-012's, reordered: "Selling or buying a home in Milton?", with the line "Start on your side of the street."

**What changed in the cards.** MH-012 and MH-013 are side by side in `scratchpad/mh013/clips/cards-compare-1280.png` and `cards-compare-390.png`.
- **Colour.** Forest, with #00ff80 pill buttons and green text links, becomes a navy Selling door and a paper Buying door. The buttons are rectangular, in the lead orange, with navy labels. Links are navy, with a dark orange arrow.
- **Shape.** 16px rounded, shadowed cards become 4px corners and hairline rules, with a 3px top rule per door. There are no pills: the "63 new" badge is gone, and "Planned" is a square label.
- **Type.**
  - Door names are Fraunces at 46px, weight 400.
  - Reading text is 17px, and details are 16px (MH-012 had 14px details and 13px notes).
  - Labels are 14px JetBrains Mono: the 01, 02 and 03 numbering, the planned tag and the search hint.
- **Order.** Selling comes first, as the navy door. Investing is its own door instead of a buyer row.

**The palettes.** All come from `src/components/home-design/tokens.ts`, the one file the page reads.

| | 1 · Harbour | 2 · Midnight | 3 · Slate |
|---|---|---|---|
| Page / card | `#f8f5f0` / `#ffffff` | `#f4f5f7` / `#ffffff` | `#f6f5f2` / `#ffffff` |
| Ink / muted | `#14213a` / `#4c566a` | `#0f1726` / `#4a5263` | `#1b2535` / `#4f596a` |
| Navy / deep | `#14294a` / `#0c1b33` | `#0c1a2e` / `#070f1c` | `#203b60` / `#162b48` |
| Accent / dark orange text / light orange on navy | `#d8642e` / `#a6461b` / `#f2a77c` | `#dd7a22` / `#9a500f` / `#f5b56f` | `#e2603d` / `#ad401d` / `#ffb79e` |
| Lead (buttons only) / its label | `#f47b30` / `#14294a` | `#f5952f` / `#0c1a2e` | `#ff7a4d` / `#162b48` |

- **Contrast.**
  - The token table has 25 text pairs in 3 palettes, 75 measurements: 0 under 4.5:1, and the lowest is 4.95:1, the planned tag (`scratchpad/mh013/contrast.md`).
  - Measured in the browser, every text element on the whole page (nav, hero, sections, footer) passes on all 18 option, palette and width runs. The lowest is 4.76:1, and every placeholder passes.
  - Bright orange is never text on a light ground.
- **The lead colour.** It is painted on exactly seven controls, all lead captures:
  - the hero's Get my home's value and Book a showing;
  - the valuation card's submit;
  - the daily brief's submit;
  - the footer brief's submit;
  - the nav panel's brief and landlord submits.

  It is never text, never a border, and never on any other element. The accent orange never fills a control. The bar's "What's my home worth?" is outlined, so the hero's Selling button is the one orange thing on the first screen.
- **No green.** Across 18 runs, every element and pseudo-element was scanned, every computed colour including gradients and shadows: 0 greens.
  - `theme-color` is the palette's navy.
  - The tab icon is a navy SVG, scoped to this route.
  - One green is left in browser chrome: the root `app/favicon.ico` link, which a route cannot remove.

**The wordmark changes.**
- **Why.** The live gold-to-red gradient runs through orange, so beside an orange lead button it reads as a second, competing orange.
- **Two versions are shown.** Script is Kaushan in solid white. Serif is Fraunces with "ly" in light orange, the footer's face. Clips are in `scratchpad/mh013/clips/wordmark-*.png`, beside `wordmark-live.png`.
- **My pick is serif.** It reads as a firm's name rather than a signature.

**Fixed from MH-012.**
- **Planned rows.** No planned row is a link: 2 planned items, 0 links, checked on every run.
- **The listings row.** `/listings` has no "this week" filter, so the row now says what the page is: "Every home for sale, newest first". The detail reads "488 in Milton today, 63 of them listed in the last 7 days".
- **The rentals count.** 1,281 equals `/rentals`' own "1281 active rentals", checked against the live page on every run.

**The links** (`scratchpad/mh013/links-prod.md`, `links-preview.md`).

| Side | Label | Intent it serves | `data-hero-intent` | Target | Status |
|---|---|---|---|---|---|
| Seller | Get my home's value (button) | Owner who wants a number | `home-value` | `/sell` | 200 |
| Seller | Look up your own street | Owner starting from their street | `own-street` | `#hd-q`, the hero's search | in-page |
| Seller | Selling and buying at once | Owner moving within Milton | `sell-and-buy` | planned `/sell-and-buy` | 404, not built |
| Seller | Talk it through first | Owner ready to talk | `call` | `tel:+16478399090` | a phone number |
| Buyer | Book a showing (button) | Ready to see a home | `book-showing` | `/book?ref=%2F` | 200 (noindex form page) |
| Buyer | Every home for sale, newest first | Active searcher | `new-listings` | `/listings` | 200 |
| Buyer | Buying your first home | First-time buyer | `first-home` | `/guides/what-it-costs-to-buy-your-first-home-in-milton` | 200 |
| Investor | Investing (door) | Investor | `investor` | planned `/invest` | 404, not built |
| Renter | Renting instead? | Renter | `rentals` | `/rentals` | 200 |

**Guardrails, proven on the preview.**
- **VOW.** The battery reads `--only=homepage,nav,phone-390,vow-display,leak` `PASS · 5 checks · 719 pages · 1197s`, and the leak test `CLEAN · 6170 responses · 0 findings`. `leak.mjs --explain` on all six option and palette pairs, HTML and RSC, finds 0 values and 0 class phrases. The `data-vow` marker is absent, and the page has no JSON-LD. The one separator `--explain` lists is the nav's pre-existing A to Z "X" cell.
- **Registrant.** The live nav carries both lines at 14px on all 18 runs. The listing cards below the hero keep the brokerage at the price's size, unchanged.
- **Indexing.** The page is noindex, nofollow and nocache. `/sitemap.xml`, `/robots.txt` and `/` do not mention it.
- **Voice.** Every link is a task. The hero has no em-dash, no superlative and no sold or leased figure.
- **Phone.**
  - Nothing scrolls sideways at 360, 390 or 1280, nor at 768, 900 or 1024.
  - No hero tap target is under 44px.
  - Hero body text is 16px or larger, and labels are 14px.
- **First screen**, by bottom edge in CSS px:
  - D at 360x640: Selling 373, then Buying 513.
  - C at 360x640: both at 538, Selling on the left.
  - At 1280x800: D both at 662; C Selling at 602 and Buying at 626. C's Selling detail wraps to two lines; a min-height on the detail would level them, and is not built.

**The gate.**
- Local `corepack pnpm build`: exit 0, 0 `P2024`, 843/843.
- Local battery at `6a8a65f`, `--only=homepage,nav,phone-390,vow-display`: `PASS · 4 checks · 719 pages · 164s`.
- Preview `/api/build` reports `6a8a65f`. Preview battery `--only=homepage,nav,phone-390,vow-display,leak`: `PASS · 5 checks · 719 pages · 1197s`.
- `scratchpad/mh013/verify.mjs` passes locally and on the preview, covering 12 checks across 18 runs.

**Rebrand scope, report only** (`scratchpad/mh013/rebrand-scope.md`, generated by `rebrand-scope.mjs`). It found 916 green values in 73 files.
- **Stylesheets:** 24 files, 475 values. 109 CSS variables in 17 of them define a green.
- **TS/TSX:** 34 files, 390 values. 377 Tailwind arbitrary classes follow no variable.
- **Emails:** `email-user.ts`, `brief/compose.ts`, `digest/compose.ts`, `seo/digest.ts` and `unsubscribeHandler.ts` (21 values). The audit's morning and nightly mail and `mail-unnotified-leads.ts` add 11 with the voice-rule fixtures.
- **Share images:** the street `og.png` route (3 values, and it also draws the gradient wordmark).
- **Metadata:** `manifest.ts` and the layout's `themeColor` (3 values).
- **Icons:** `public/icon.svg` (the forest ground and the gradient). The binaries drawn from it are listed: `favicon.ico`, the 192, 512 and apple-touch PNGs, and `logo.png`.
- **Checks:**
  - One battery assertion pins a green by value: `homepage.mjs:205-206` and `:428`, the icon's forest ground.
  - `footer.mjs:114, 139 and 191` name a "forest bar" in their wording only.
- **Wordmark:** the gradient appears in 4 files, and Kaushan is bound in 3.
- **Tailwind:** `tailwind.config.ts` holds a separate green utility scale for success states (10 values).

**Found on the live site, not changed.**
- The homepage valuation card computes 0px padding on production, because `.home-v2 *` beats Tailwind's `p-6`. It is fixed only in the preview.
- `/rentals` opens its grid on "46 match filters" under "1281 active rentals".

**Screenshots.**
- `scratchpad/mh013/shots/` holds 30 files: for C and D in each palette, the first screen and the hero at `desktop-1280` and `phone-390`, plus `small-360`.
- `scratchpad/mh013/clips/` holds the card comparison and the wordmarks.

**My pick: D, palette 1 (Harbour), serif wordmark.**
- **D** puts the Selling door first and largest, and makes it the one navy mass on a light page, so a homeowner finds it before anything else. Buying is its equal, and Investing sits quietly third.
- **D reads lighter than C.** Its ivory page carries the reading and keeps navy for the focal door. C's navy band plus white doors puts more dark on the first screen.
- **Harbour** is the one whose navy reads as navy and whose orange reads as orange. Midnight's near-black reads as black rather than navy, and its saffron leans yellow. Slate's coral leans pink, and its lighter navy loses the private-bank weight. Harbour's warm ivory is also easier on the eyes over a long read than a cooler page.
- **Serif** matches the footer's existing wordmark and the doors' Fraunces, where the script reads as a signature.

**For Core.** Nothing to merge; this is a design for review. If it is approved, the hero on `/` is its own brief, a site-wide rebrand is another (sized above), and `/invest` and `/sell-and-buy` are briefs of their own.

Report: scratchpad/reports/MH-013-home-hero-orange-navy.md
