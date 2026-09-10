HOME · D:\miltonly-home · feat/homepage

# 063 — Homepage, header and footer: the build

Built on `feat/homepage`, commit **`b9f0341`**. Not merged.
Preview: **https://miltonly-cofmzwdqr-gtahomequest-hubs-projects.vercel.app**
Battery on that preview at the full SHA: **`PASS · 10 checks · 444 pages · 73s`**, exit 0.
Local: `pnpm build` exit 0, zero `P2024`, **19/19 prebuild**, 546 static pages.

---

## The rulings, and what was done about each

**1. No price-drop section, and remove what claimed otherwise.** Done. No such section
exists and no data function for one was written, deliberately, so nothing can wire one up
by accident. Two claims removed:

- `listingsV2Data`'s `priceReduced` flag and the `Price reduced` badge it fed on every
  listing card. It derived from `lastPriceChangeAt`, which records that a price changed
  and never what it changed from, so the badge said "reduced" over increases too. Removed
  from the loader, both card shapes, the map pin, the mock fixture, the card component and
  its CSS rule. The dead `/listings?priceReduced=true` pill went with it (that parameter
  was never read by `parseListingsQuery`).
- `stats.ts getFeaturedListings`, dead code with zero consumers whose `priceDrops` key
  returned `orderBy: { price: 'asc' }`, the cheapest active listings. Its only consumer
  component, `src/components/sections/FeaturedListings.tsx`, was also unrendered and is
  deleted; keeping a component whose data source is gone is how a lie gets re-wired.

`lastPriceChangeAt` is still selected where the grid needs it and is no longer read as a
direction. A note in `homeSignals.ts` states why no such function is offered.

**2. Hub cards carry the hub's public k-gated typical sold price, from one shared
function.** Done. `src/lib/neighbourhoodCards.ts` `getNeighbourhoodCards()` is that
function. Its price comes from `getMiltonSoldByNeighbourhood()`, which already ran the hub
page's exact `saleAggQuery` over `Neighbourhood.rawStrings` through the hub page's exact
`assembleAggregates` (k-gated at `K_ANON_PRICE`, null below it) and rounded it the way the
hub rounds it. The module adds one thing: a live active-listing count. Both the homepage
ladder and `/neighbourhoods` read it, and `/neighbourhoods` no longer computes its own
active-list-price average. Its card label now reads "Typical sold · 12mo", which names the
statistic it is. Two hubs, `milton-north` and `moffat`, are below k5 and print no price on
either surface.

**3. Daily brief posts to the existing lead path.** Done. `source: "daily-brief"`,
`intent: "daily-brief"`, email only, honeypot, attribution payload. No new model, no new
table, nothing in the component writes. One flag for Leads: the consent text is shown on
screen and sent as `consentText` + `consentTimestamp`, but the generic lead path does not
persist those fields today, and the branch that does (`market-pulse-unlock` /
`home-valuation`) requires a phone number, which a brief signup should not. Wiring consent
capture into the generic path is Leads' call; this surface already sends it.

**4. Title and H1: three options each, nothing shipped.** Below. The homepage still
inherits the root layout's 101-character title and still leads with the brand phrase.

**5. Homepage gate in the battery.** Done, as a 10th check,
`scripts/verify/checks/homepage.mjs`. Its output on the preview:

```
── The homepage links, states its figures, and declares itself
   · unique internal links served: 66
   · of which are in the <nav>: 34
   · stated link floor: 50
   · data-fig figures parsed: 48
   · neighbourhood price figures: 22
   · sub-k hoods (price must be silent): milton-north, moffat
   · JSON-LD nodes parsed: 5
   PASS  homepage returns 200: 200
   PASS  unique internal links >= 50: true
   PASS  neighbourhood price figures found: true
   PASS  menu triggers rendered as anchors: 0
   PASS  menu trigger hrefs in served nav markup: 0
   PASS  rail links in served nav markup: 0
   PASS  Milton-wide figures present: 0
   PASS  neighbourhood figure != its hub record: 0
   PASS  neighbourhood figure off a sub-k pool: 0
   PASS  sub-k hood prints a price instead of its suppression: 0
   PASS  WebSite node present: true
   PASS  Organization node present: true
   PASS  SearchAction on the WebSite node: true
```

Four things worth stating about it:

- **The link floor is 50, and it is stated in the file with its arithmetic.** 66 today, 24
  before. It is set roughly 15 below the current count so an ordinary week with fewer
  filmed streets passes, and a truncated footer (about 19 links) or a section that stops
  rendering (8 to 22) fails.
- **The floor does not guard the header, and the file says so.** 65 of the 66 links come
  from the body, because the footer duplicates most nav destinations. It is the anchor
  assertions, not the count, that would catch a return to click-mounted panels.
- **Figures are read from `data-fig` attributes, not from prose.** A parser that reads
  rendered copy stops covering anything the moment a label is reworded, and reports "no
  findings" while reading nothing.
- **Figure equality is asserted against the DB2 record**, the same record `hub-meta` checks
  the hub pages against. Homepage equals record and hub page equals record together mean
  homepage equals hub page, without this check parsing a second template.

Suppression is asserted in both directions: a sub-k hood must print no price, and it must
also print its suppression rather than falling silent invisibly.

---

## Link count, before and after

| | before | after |
|---|---|---|
| unique internal links in served homepage HTML | **24** | **66** |
| of which come from the `<nav>` | **0** | **34** |
| visible body words | **302** | **1,146** |
| published hubs linked from the homepage | 3 | **22** |
| street pages linked from the homepage | 2 | **17** |

Before was measured on production 2026-09-10; after on the built preview. Both counts use
the same rule: unique `<a href="/…">`, build assets and the manifest excluded.

The header change is site-wide, not homepage-only. Every forest page renders the same
`SiteNav`, and the page variant previously had no mega menu at all: its `MEGA_PANELS`
lookup was gated on `isHome`, so street pages, hubs, `/listings`, `/sell` and the rest
shipped four bare links. They now ship the same three menus and the same 34 anchors.

---

## The three menus

Buy, Streets, Sell. Each is a rail of intents and a live right panel, with a shared
in-demand-streets strip along the bottom.

**Every link is an `<a href>` and every panel is rendered on the server**, closed with the
`hidden` attribute rather than by not existing. Each trigger is itself an anchor to that
menu's index page (`/listings`, `/streets`, `/sell`); a desktop click with JavaScript opens
the panel instead of navigating, and without JavaScript, or below 820px, it navigates. The
popover is the enhancement. The links are not.

Below 820px the same three menus render as native `<details>` accordions inside the
hamburger panel. They open with no JavaScript, which means the menu survives a failed
hydration, and they are sized for 380px. I have not opened them in a browser at that
width: the CSS is written for it, and the preview review is where that gets confirmed.

Live panels read only data the page already fetched, so the menu costs no extra query:
Buy reads the newest listings and the active count, Streets reads the video posters and
their count, and Sell reads **the same `analytics.board_stats` overall row THE BOARD
renders below it**, including its window label and its suppression, so the menu cannot
state a figure the page contradicts. Pages other than the homepage pass no live data and
render the rails alone, which is still a complete, crawlable menu.

---

## The sections

| | section | source |
|---|---|---|
| — | Hero, one search box and four live figures | on the market 448, new in 7 days 45, sold so far this month 23, typical $930,000 |
| 01 | Streets on film | 40 published streets carry a clip, 10 shown, poster-gated |
| 02 | Newest on the market | `getNewestListingCards`, through the RECO/IDX display gate |
| 03 | The neighbourhood ladder | all 22 hubs, ranked by sales, k-gated price |
| — | THE BOARD | unchanged |
| 04 | Valuation, three proof points | street count, 12-month sales, sold-to-ask |
| 05 | The daily brief | `/api/leads`, source `daily-brief` |
| — | Footer link graph | every hub, the in-demand streets, the tools |

Three design decisions worth recording, since each is a departure from the category norm:

**The ladder is not a card grid.** Every brokerage in this market renders neighbourhoods as
photo cards, which sort alphabetically, bury the figures inside the tile and make
twenty-two places look like twenty-two identical products. This ranks them: one ruled row
each, ordered by 12-month sales, with a measure bar scaled to the busiest hood. The
ordering is the content. A reader learns where Milton actually trades before reading a
number.

**Every listing card carries three links, not one.** A card that links only to itself is a
dead end for a crawler and for a reader who does not want that house. The address goes to
the listing, the neighbourhood to its published hub. Raw TREB neighbourhood strings are
resolved to a canonical published hub server-side through `getRawStringHubMap()`; a raw
string with no published hub gets no link rather than a slugified guess, which is the same
rule `/neighbourhoods` already applies for the same reason.

**Sections are set as encyclopedia entries.** A monospace index number in the left margin,
a full-width hairline, the heading hard left with its standfirst beside it rather than
beneath it. The device repeats exactly, section after section, which is what makes the page
read as one document rather than a stack of imported widgets. Cream and forest grounds
alternate so the ordering is legible before a word is read.

The TrustBand is retired. Its 27 words of adjectives are replaced by four live figures in
the hero and three in section 04, each of which names what it counts.

---

## Address to anchor

`resolveHeroSearch` now splits a leading house number, resolves the remainder as a street
through the same two-tier entity match, and **confirms the number against the Town's
40,826-address projection** before returning an anchor. Verified on the preview:

```
505 Farmstead Drive   -> /streets/farmstead-drive-milton#505
3 Scott Blvd          -> /streets/scott-boulevard-milton#3
262 Pine Street       -> /streets/pine-street-milton#262
410 Farmstead Drive   -> /streets/farmstead-drive-milton      (Farmstead starts at 499)
999999 Pine Street    -> /streets/pine-street-milton
Farmstead Drive       -> /streets/farmstead-drive-milton      (unchanged)
Beaty                 -> /neighbourhoods/beaty                (unchanged)
what is my home worth -> /sell                                (unchanged)
```

The confirmation is the point. An unverified `#410` is a link to an id that is not on the
page, which browsers answer by silently doing nothing: a dead link that looks alive. When
the Town carries no such number, it degrades to the street page, which is still the right
page. Unit prefixes are handled: `12-410 Main St E` takes the street number.

---

## 4. Title and H1 options. Nothing shipped; Brain picks.

**Current title**, inherited from the root layout, 101 characters:
`Milton Real Estate Encyclopedia — Milton Ontario Real Estate, Homes For Sale & Street Data | Miltonly`

The layout's own comment records that this length was measured as harmful on street pages,
where it pushed 298 of 431 titles past Google's cut. The homepage never got the same pass.
Google sources the site-name line from `og:site_name`, so the ` | Miltonly` suffix costs 11
characters and buys nothing. All three options drop it and set the title on the page rather
than inheriting it, along with an explicit canonical.

| | Title | Chars | The bet |
|---|---|---|---|
| **T1** | `Milton Real Estate: Every Street, Every Sale` | 44 | Brand-led. Keeps the line the site already says out loud, reads as a promise, and is short enough that no device truncates it. Weakest on head-term match |
| **T2** | `Milton Homes for Sale, Street by Street` | 39 | Query-led. Carries the actual head term ("Milton homes for sale") in front, then the differentiator. Most likely to win the click on a commercial query, least distinctive on a brand one |
| **T3** | `Milton Real Estate Data, Street by Street` | 41 | Category-led. Claims the thing no competitor claims, and matches what the page now demonstrably is. Trades some commercial intent for a defensible position |

**Current H1**: `Milton` / `Real Estate Encyclopedia`, a brand phrase in two lines.

| | H1 | The bet |
|---|---|---|
| **H1a** | `Every Milton street. Every sale. Every answer.` | Promotes the existing lede to the heading, which is the strongest sentence on the page. Distinctive, no keyword in the head position |
| **H1b** | `Milton real estate, street by street` | States the category and the method in six words. Carries the term, reads as a description rather than a slogan |
| **H1c** | `What Milton homes actually sell for, street by street` | Shaped like the question people type. Longest of the three, and the only one that promises a specific answer the page delivers three sections later |

A pairing note, not a recommendation: T2 with H1a keeps the keyword in the title and the
voice in the heading, which is the usual way to avoid spending both slots on the same job.
T3 with H1c commits the whole page to the data position. T1 with H1b is the conservative
pair.

---

## What is not done

- **Title and H1 unchanged**, pending the pick above.
- **Consent capture for the daily brief is not persisted.** Flagged to Leads above.
- **No price-drop section.** Returns when a prior price is stored, which is Core's job.
- **Not merged.** Preview is up; Aamir reviews.
