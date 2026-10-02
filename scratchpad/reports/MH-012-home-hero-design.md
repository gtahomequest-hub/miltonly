# MH-012
HOME · D:\miltonly-home · feat/home-hero-design

**The homepage hero is designed on the real stack at `/design-preview/home`: a buyer side and a seller side, in three layouts, on the homepage's own live public data. It is previewed, NOT merged, and not for merge.** Branch `feat/home-hero-design` is cut from `origin/main @ f0b8bb7`, which contains `aa8c9d8` (MC-046 Stage 1). The work commit is `c7fd3ee`: 8 files, 1,737 lines in, and nothing under `src/components/home/` or `src/app/page.tsx` changed. The preview is `https://miltonly-hokave4jn-gtahomequest-hubs-projects.vercel.app/design-preview/home` (`dpl_GbM2NFDdwKLpYuf6D99kHszMKwJz`), the only one. Switch with `?option=a|b|c`.

**The H1:** "Buying or selling a home in Milton? Start on your side of the street." It names both intents and the town, promises no figure, and tells the visitor what to do; "street" keeps the site's street-by-street identity. I also considered "Milton homes, bought and sold one street at a time" and "Buy or sell in Milton, starting with your street".

**The options.** All three share the H1, the words, the links and the search; only the layout differs.
- **A · Road.** The two sides face each other across a drawn road (MH-011's road, stood upright), with the search above. On a phone they become two lanes, Buying and Selling, and the seller's step is one tap away.
- **B · Sentences.** "I'm buying…" sits on forest and "I'm selling…" on cream, and each row finishes the sentence. On a phone the sides stack, and two chips under the H1 jump to each side.
- **C · Doors.** One white card per side, lifted over the forest band, each opening on "Your next step" and its button. On a phone the two doors stay side by side, so both buttons are on the first screen with no tap, and each side's rows follow.

**The links.** All come from one list, `src/components/home-design/links.ts`. Status was checked on production and on the preview (`scratchpad/mh012/links-prod.md`, `links-preview.md`).

| Side | Label | Intent it serves | `data-hero-intent` | Target | Status |
|---|---|---|---|---|---|
| Buyer | Book a showing (button) | Ready to see a home | `book-showing` | `/book?ref=%2F` | 200 (noindex, a form page) |
| Buyer | Homes listed this week | Active searcher checking fresh inventory | `new-listings` | `/listings` | 200 |
| Buyer | Buying your first home | First-time buyer setting a budget | `first-home` | `/guides/what-it-costs-to-buy-your-first-home-in-milton` | 200 |
| Buyer | Buying to rent it out | Investor | `investor` | planned `/invest` | 404 today, not built |
| Seller | Get my home's value (button) | Owner who wants a number | `home-value` | `/sell` | 200 |
| Seller | Look up your own street | Owner starting from their own street; its page opens with a valuation form, the street prefilled | `own-street` | `#hd-q`, the hero's search | in-page |
| Seller | Selling and buying at once | Owner moving within Milton | `sell-and-buy` | planned `/sell-and-buy` | 404 today, not built |
| Seller | Talk it through first | Owner ready to talk now | `call` | `tel:+16478399090` | a phone number |
| Renter | Renting instead? 1,281 homes available to rent now | Renter on a buy-or-sell page | `rentals` | `/rentals` | 200 |

- **Planned, not built:**
  - `/invest`: asking rents beside asking prices, by home type, from active listings only.
  - `/sell-and-buy`: how to time two closings.
  - Both are drawn with a "Planned" tag and are not links.
- **Left out:**
  - The daily brief. Its sender has no cron under R17, so a link would collect sign-ups for emails that do not go out.
  - `/exclusive`, which is empty today.
  - `/compare/freehold-vs-condo` and the GO train guide: research, not a next step.
  - Schools and mosques, under guardrail 2.
  - "Is it a good time to sell": noindex, and built on sold measures.

**The search.**
- **Placement.** Every option keeps it: above the sides on A and C, under the chips on B, and beside the H1 at 1024px and up.
- **Behaviour.** It is AskBar's: the same `/api/hero-index` suggestions and the same `/api/hero-search` resolver, so an address lands on its street page at that number.
- **The nav.** The form keeps AskBar's id, so the nav's bar search still appears on scroll.
- **Proposed, not built:** a seller-side submit that lands on the street page's valuation form (`#capture`).

**GA4 hooks.**
- `data-hero-side`: `buy`, `sell`, `rent` or `both`.
- `data-hero-intent`: one per row, plus `address-search`, `side-tab` and `jump-to-side`.
- `data-hero-status="planned"` on the planned rows, and `data-hero-option` on the section.
- No listener is wired, because the preview would send its clicks to the production property.

**Guardrails, proven on the preview.**
- **VOW.**
  - The hero reads three counts the live homepage already serves: 488 for sale, 64 new this week and 1,281 to rent, all from active listings. Nothing imports `src/lib/vow`.
  - The leak test reads `CLEAN · 6170 responses · 0 findings`.
  - `leak.mjs --explain` on each option, HTML and RSC, finds 0 values and 0 class phrases. The `data-vow` marker is absent, and the page has no JSON-LD (`leak-explain-preview.log`).
  - The one separator `--explain` lists is the nav's A to Z "X" cell, which is pre-existing (MC-050) and not in the hero.
- **Grounds.** Every link names a task.
- **Brand.**
  - `#00ff80` is on the two lead buttons only (`/book` and `/sell`), checked on 9 runs.
  - The hero has no em-dash, no superlative, and no sold, leased or market-pace word.
- **Registrant.** The live `SiteNav` carries both lines at 14px on all 9 runs.
- **Not indexed.**
  - The page is noindex, nofollow and nocache.
  - `/sitemap.xml`, `/robots.txt` and `/` do not mention `design-preview`.

**Phone.**
- There is no sideways scroll at 360, 390 or 1280, and no tap target is under 44px.
- **First screen**, by the bottom edge in CSS px:
  - C: both buttons at 508 on a 360x640 screen.
  - A: the buyer's button at 538 and the Selling lane at 432.
  - B: the buyer's button at 610 and the "I'm selling" chip at 294.
- At 1280x800 both buttons sit at 551 to 573.

**Contrast.**
- `tokens.ts` has 20 pairs, 0 of them under 4.5:1; the lowest is 5.05:1, accent green on cream (`contrast.md`).
- In the browser, the lowest hero text across the 9 runs is 5.05:1, and the placeholder is 6.92:1.

**The gate.**
- Local `corepack pnpm build`: exit 0, 0 `P2024`, 842/842, with `ƒ /design-preview/home` listed.
- Local battery at `c7fd3ee`, `--only=homepage,nav,phone-390,vow-display`: `PASS · 4 checks · 719 pages · 184s`.
- Preview `/api/build` reports `c7fd3ee`. Preview battery `--only=homepage,nav,phone-390,vow-display,leak`: `PASS · 5 checks · 719 pages · 1065s`.
- `scratchpad/mh012/verify.mjs` passes locally and on the preview. It waits for load rather than network idle, because the preview never goes idle.

**Screenshots.** `scratchpad/mh012/shots/` holds 17 files, 2.7 MB in all:
- per option, the first screen and the full hero at `desktop-1280` and `phone-390`, plus `small-360-first-screen`;
- `a-phone-390-selling-lane` and `c-phone-390-search-typed`.

**My pick: C, Doors.**
- Of the three, C alone meets the five-second bar on a phone without a tap: both next steps are on the first 360x640 screen.
- Neither side waits for the other. A opens on Buying, and B puts the seller second.
- It reads as two doors, not a search box over a photo with Buy, Sell and Rent tabs.
- It speaks MH-011's language: the forest band, a white card lifted over it, a green mark for the buyer and a clay mark for the seller.
- A's road is the more memorable picture on desktop; if wanted, it can become the gutter between C's doors. B reads well but takes longer to scan, because a visitor reads sentences before reaching a button.

**For Core.** Nothing to merge; this is a design for review. If it is approved, the hero on `/` is its own brief (the H1 and hero swap, and a GA4 listener), and `/invest` and `/sell-and-buy` are briefs of their own. The `ChromeGate` line is byte-identical to MH-011's.

Report: scratchpad/reports/MH-012-home-hero-design.md
