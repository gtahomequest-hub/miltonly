# MA-004
AUDIT · D:\miltonly-audit · feat/audit

## MA-004: the header, mega menu and footer on production, five page types, three widths

Read-only. Nothing on a page was edited. Production as served 2026-09-13 (Toronto), the code main carries
(`f01a96a` per HANDOFF.md). Tooling under `scripts/audit/` (`nav-footer.mjs`, `nav-links.mjs`,
`nav-lighthouse.mjs`, `nav-bench.mjs`, `nav-pages.json`); raw output under `scratchpad/audit/MA-004/`
(per-page JSON at 1440, 1024 and 390, screenshots of every panel and the mobile accordion, Lighthouse JSON,
link and coverage tables, benchmark captures), untracked. The daily-brief form was submitted with the POST
intercepted and aborted in the browser, so the payload is recorded and no lead was written.

### The five pages and what chrome each one serves

| page | header served | footer served | nav links (unique) | footer links | links on page | footer at (screens, 1440 / 390) | first CTA painted (FCP, mobile / desktop) | menu usable (TTI, mobile / desktop) | Lighthouse perf m / d · a11y |
|---|---|---|---|---|---|---|---|---|---|
| homepage `/` | forest `SiteNav` (home variant) | `HomeFooter` | 142 (113) | 47 (46) | 254 | 6.5 / 12.2 | 3.0 s / 0.8 s | 12.7 s / 2.3 s | 62 / 85 · 95 |
| street `/streets/woodward-avenue-milton` | forest `SiteNav` | **none** | 142 (113) | 0 | 475 | none | 3.1 s / 1.3 s | 9.4 s / 2.4 s | 63 / 87 · 91 |
| hub `/neighbourhoods/timberlea` | forest `SiteNav` | `HomeFooter` | 142 (113) | 47 (46) | 246 | 9.4 / 14.0 | 3.1 s / 0.5 s | 8.1 s / 1.8 s | 64 / 95 · 96 |
| listing `/listings/W13117744` | **navy `Navbar`**, no menu | navy `FooterSection` | 9 (9) | 20 (20) | 52 | 4.9 / 8.3 | 3.0 s / 0.7 s | 10.8 s / 2.0 s | 57 / 90 · 92 |
| guide `/guides/what-milton-neighbourhoods-cost` | **both**: navy `Navbar` and forest `SiteNav` | navy `FooterSection` | 151 (115) | 20 (20) | 195 | 4.0 / 6.8 | 2.9 s / 0.8 s | 7.3 s / 1.6 s | 60 / 97 · 96 |

m = Lighthouse mobile, slow 4G, 390×844; d = desktop preset. "First CTA painted" is FCP, because the bar
and its CTA are in the first bytes of the server HTML on every page. "Menu usable" is Lighthouse TTI: the
triggers are buttons and the burger renders its panel only after hydration, so until then a tap does
nothing. Lighthouse SEO 100 on all ten runs, CLS 0.000 on all ten, `crawlable-anchors` and `link-name`
pass everywhere. The listing page is 461 of the sitemap's 1,113 URLs; streets are 509.

### What holds up

The forest menu does what its own header comment says it does, and I could not break it. Every panel
and every rail item's content is in the server HTML, closed with `hidden`: 113 distinct destinations
crawlable from every forest page, 22 hubs with a live listing count each, 29 streets with the count that
ranked them, the A to Z with a count per letter. Hover opens after 119 to 136 ms of rest and a mouse
crossing the bar opens nothing; the band closes 203 to 229 ms after the pointer leaves; click toggles;
outside click, scroll and Tab-out close it; Enter, Space and ArrowDown open and put focus on the rail;
ArrowUp/Down, Home and End walk the rail; ArrowLeft/Right switch menus; Escape closes and returns focus
to the trigger. Opening moves nothing: CLS 0.000, document height unchanged, the band 460 to 581 px tall
inside a `calc(100vh - 66px)` cap, fitting at 1440 and 1024 with no inner scroll and no horizontal
overflow. Every opening sentence is live with its figures marked, no blurb fell back on any run, and the
notes say true things ("A prior price is stated only where the change was observed on this site"). On the
phone the burger is 44 × 44, the panel is a `role="dialog"` with `aria-modal`, body scroll locks, focus
wraps, Escape closes and refocuses the burger, and the seller CTA sits inside the first screen at open.
No text under 12 px anywhere in the forest bar or its panels. Nothing 4xx. That is a menu most sites do
not have. The defects below are around it, under it, and on the pages that do not get it.

## Defects, ranked

Severity: **S1** loses clicks or leads on every visit to a class of pages today; **S2** loses them on a
class of visits or costs ranking signal; **S3** quality; **S4** polish.

### S1

**1. On a phone, the homepage loses its menu and its seller CTA the moment the visitor scrolls.** When
the hero search band passes under the bar, the nav search slides in with `flex: 1; width: auto`
(`src/components/home/home-theme.css:247-255`, the 820 px rule at `:308-312` only trims its margin) and
the row overflows the 390 px bar: measured at scroll 700 and 1,400, the search occupies x 116 to 376, the
"What's my home worth?" CTA is pushed to x 388 to 458 (three lines tall, 108 px, one 2 px sliver visible)
and the burger to x 464 to 506, off-screen and unreachable (`shots/home.390.scroll1400.png`). The
homepage's mobile visitor has the logo and a search box and nothing else for the rest of the page. At
1440 and 1024 the same swap only fades the three triggers (`home-theme.css:222-226`,
`pointer-events: none`), so the desktop homepage has no menu below the fold either, and the three
invisible buttons stay in the Tab order (defect 11). `SiteNav.tsx:647, 675-689`. Homepage, all widths;
S1 at 390.

**2. Every street page ends without a footer.** `StreetV2Page` and `StreetMinimalPage` render
`SiteNavLive` and no footer (`src/components/street/v2/StreetPage.tsx:49-67`,
`StreetMinimalPage.tsx:28`); production serves zero `<footer>` elements on the street page at every
width. The page is 11.7 to 18.8 thousand px tall; a visitor who reaches the end (the sold gate, the FAQ,
the final cards) has no path to a hub, another street, a guide, sold data or the legal pages except back
up to the bar. For the crawler, 509 pages contribute nothing to the footer link graph the homepage and
hub were built to carry. All 509 street pages.

**3. On every street page the menu's call-to-action is white text on bright green, 1.34:1.**
`.street-v2 a { color: inherit }` (`src/components/street/v2/street-theme.css:52`) has the same
specificity as `nav .m-mega-cta { color: #04160f }` (`src/components/nav/site-nav.css:795-802`) and
loads later, so the panel CTA inherits the panel's white on `#00ff80`
(`shots/street.1440.menu-buy.new-today.png`). Three panel CTAs on desktop and all thirteen in the mobile
accordion, on 509 pages; on every other page the same element is dark on green as designed. All street
pages, all widths.

**4. The listing page, 461 of 1,113 URLs, ships the legacy chrome the rest of the site replaced.** No
mega menu, no street search, no hub or street link in the header (`src/components/Navbar.tsx:7-24`: Buy,
Rent, Sell, Exclusive, Streets, About, "Sign in", a `tel:` button in `#f59e0b`), a footer with `/map`
(a 307, `FooterSection.tsx:10`), `/saved`, "Sign in" as the mobile CTA (`Navbar.tsx:120-124`), no form
of any kind, and a mobile menu with no `aria-expanded`, no dialog role, no scroll lock, no Escape and no
outside-tap close that pushes the page down 599 px when it opens (`Navbar.tsx:90, 100-127`). From this
chrome the visitor can reach 6 of the 18 top-level pages and none of the 22 hubs, 509 streets, 8 guides
or the sold and market-watch pages (`coverage.json`). `ChromeGate.tsx:29` keeps the navy nav on
`/listings/<mls>` by design "until its own v2 cutover"; the cutover is the fix. All listing pages, all
widths.

### S2

**5. Guides render two headers.** `ChromeGate.tsx` has no rule for `/guides`, so the root layout's navy
`Navbar` renders (62 px, `sticky`, z-50) and `guides/[slug]/page.tsx:79` renders `SiteNavLive` (66 px,
`fixed`, z-80) over it. The navy bar is invisible under the forest one at every width and scroll position,
but it is in the DOM: two `<header>`, two unlabelled `<nav>`, 151 nav links, and nine invisible Tab stops
(logo, Buy, Rent, Sell, Exclusive, Streets, About, Sign in, Call Aamir) before a keyboard user reaches the
real menu (`guide.1440.json` `tabOrderFromTop`). 8 guide pages plus `/guides`.

**6. The menu does not exist until JavaScript runs.** The desktop triggers are `<button>`s with no
fallback; the mobile panel is rendered only when `menuOpen` (`SiteNav.tsx:771`), so before hydration the
burger is a button that does nothing and the street search is not on the page. Lighthouse TTI on the
mobile preset is 7.3 s (guide) to 12.7 s (home); unthrottled at 1440 the triggers hydrated at 1.1 s
(cached street) to 3.8 s (guide). The bar and its "What's my home worth?" link paint at FCP (2.9 to 3.1 s
mobile), so for four to ten seconds the visible menu is a decoration. All forest pages, mobile most.

**7. Nothing in the header carries the street or the hub with it.** The bar CTA and the mobile panel CTA
are bare `/sell` (`SiteNav.tsx:629, 691, 819`); the Sell panel's "What is my home worth?" is bare `/sell`
(`SiteNav.tsx:117`); the valuation form on `/sell` prefills only from `?street=`
(`HomeValuationCard.tsx:85-90`) and requires address, email, phone and consent. The brief form posts
`{source: "daily-brief", intent: "buy", email, notes: "Daily brief signup (menu)", event_source_url}`
and nothing else (`SiteNav.tsx:169`; captured on all twelve forest runs), so `kindForSource` files it as a
Milton-wide `brief` watch (`savedSearch.ts:27-33`) whether the visitor was on Woodward Avenue or
Timberlea, and no `consent`/`consentText` is recorded although the form prints its own promise
("Miltonly emails only. No account, unsubscribe anytime."). All forest pages.

**8. The Sell panel's numbers disagree with each other and with the page they lead to.** "What's it
worth" prints Typical price $925,000 · 12 months · 334 sales, Days to sell 28 days · 13 weeks · 632 sales,
Sold to ask 98.1% · 13 weeks · 632 sales (`megaLive.ts:249-253`). The 334 is the sum of k-gated
street-by-type cells in a mix-adjusted basket (`computeBoard.ts:146-188`), the 632 is every urban sale in
13 weeks (`:194-209`), and the Board's `mixAdjusted: true` flag (`:259`) is not rendered, so the reader
sees 334 sales in a year beside 632 in a quarter. One click later, `/sold` says "1,729 sales in the last
12 months, 88 days on market at 98.2% of asking". 28 days against 88, three sample sizes for "Milton
sales" within one gesture, no sentence that reconciles them. The "Sold this month" note prints an ISO
date, "Closed sales through 2026-09-13" (`megaLive.ts:267`). All forest pages.

**9. The Alerts panel's destination is a sign-in wall, and the crawler is sent through it.** The panel
says "No account" and its CTA "Saved listings and alerts" goes to `/saved` (`SiteNav.tsx:82`), which
renders "Sign in to get started" for anyone without a session (`SavedDashboard.tsx:117-131`), on navy
chrome, `index, follow`, absent from the sitemap, and linked without `nofollow` from every forest page
(the navy "Sign in" link does carry `rel="nofollow"` and `/signin` is `noindex`). `/neighbourhoods`, the
Streets panel's CTA on every page, is also not in the sitemap (`src/app/sitemap.ts` lists only
`/neighbourhoods/<slug>`). All forest pages.

**10. Neither footer is the site's map.** `HomeFooter` (home, hub) reaches 22 of 22 hubs, 8 streets and
16 of 18 top-level pages, and 0 of 8 guides, 0 of 29 schools, 0 of 7 mosques, 0 of 59 condo buildings,
no Market Watch edition, no `/compare/freehold-vs-condo`, and no Privacy or Terms link at all
(`HomeFooter.tsx:29-86`); `/sold` is listed twice under two labels (`:66, :81`). `FooterSection` (listing,
guide) reaches 13 top-level pages, no hub, no street, no guide, not `/sold`, `/guides` or
`/market-watch`, and carries `/map`, a 307 (`FooterSection.tsx:4-21`). The forest pages therefore have no
legal link anywhere in their chrome. All pages.

**11. On the scrolled homepage the three menu triggers are invisible and still focusable.**
`.m-navlinks.m-hidden { opacity: 0; pointer-events: none; position: absolute }`
(`home-theme.css:222-226`): hover does not open (measured), but Tab from the logo lands on Buy, Streets
and Sell before the search and the CTA, and Enter on an invisible trigger opens the band. Homepage,
1440 and 1024.

**12. The 29 streets in the menu are the same 29 on every page.** The three strips are one global query
each (`megaLive.ts:323-390`), so the nav sends a link to Rose Way, Laurier Avenue and Farmstead Drive
from every one of 1,000+ pages while a hub page's own streets and a street's neighbours get none from the
chrome. MA-001 defect 14 (631 to 650 inbound links for five streets, two to four for the rest) is this
mechanism. All forest pages.

### S3

**13. Contrast and font floors in the two footers and the navy mobile menu.** `FooterSection`: 10 px
`#475569` on `#07111f` at 2.5:1 (`:151`), 12 px copyright `#64748b` at 3.98:1 (`:144-148`); navy mobile
menu secondary links 13 px `#64748b` on `#0c1e35` at 3.52:1 (`Navbar.tsx:109`); `HomeFooter` compliance
line 11 px `#748480` on `#021f18` at 4.41:1 (`home-theme.css:1592`) and section headings at 11 px
(`:1569`); the menu's struck prior price `.m-mega-prior` 4.39:1. Lighthouse `color-contrast` fails on
all ten runs, and the chrome element it names is `.m-compliance` on home and hub and the 10 px line on
listing and guide.

**14. Tap targets at 390.** `HomeFooter`: 23 of 49 targets under 24 px tall (every hub link 22 px, the
search input 22 px) and 26 more under 44 (street links 32 px); `FooterSection`: 17 of 20 links 16 px
tall; forest panels: the "Also" links 19 px (`site-nav.css` `.m-mega-more`), the eight strip pills 40 px,
"Read the edition →" 129 × 20; navy burger 36 × 34 and "Sign in" 41 × 20 (`Navbar.tsx:90, 66`).

**15. Copy that claims more than the site holds.** A to Z lead: "Every one states what homes there
actually sold for" (`megaLive.ts:223`); the 24 minimal-template pages show no price (MA-001 defect 16)
and individual sold prices are gated. `FooterSection`: an em-dash in the bio, "RE/MAX Hall of Fame",
"⭐ 5.0/5 Google reviews", "235+ families", "Preferred by clients in Pakistan, India, and the GCC"
(`FooterSection.tsx:31-33, 53, 131`), none with a source on the page. `HomeFooter`'s "In-demand streets"
heading (`:44`) states no basis (it is `recencyWeightedSold` rank, `hubFooter.ts:30`).

**16. Heading order.** `HomeFooter` opens five `<h4>` under no `<h3>` (`HomeFooter.tsx:32, 44, 61, 70,
78`); Lighthouse `heading-order` fails on the homepage on both presets and names the footer `<h4>`.
`FooterSection` uses `<p>` for its headings, so it contributes no headings at all.

**17. Duplicate links in the chrome.** 142 nav links for 113 destinations on every forest page: the
"Most for sale right now" strip is rendered in both New today and Price changes, "Most sales, last 12
months" in both What's it worth and Sold this month, three listing cards appear in two items each,
`/streets` three times as "Browse every street page", `/listings` twice, `/sell` twice (bar and panel).
Harmless to the crawler, but 29 of the visitor's Tab stops are repeats.

**18. The mobile accordion opens long.** Each menu's first item is `open` by default
(`SiteNav.tsx:792`), so tapping Buy expands 1,442 px (New today's four cards alone 1,013 px) and Streets
1,488 px (22 hub rows at 52 px), pushing the seller CTA 1.5 screens down; the panel holds 165 focusables.
"Address search", the panel's stated purpose, is the last rail item on desktop (`SiteNav.tsx:99`) while
the phone panel puts the same search first.

**19. `/exclusive`, a nav and footer destination on every page, serves a title with mojibake**
("Exclusive Listings â€” Aamir Yaqoob", `links.json`). Page-level, noted because the chrome sends
every visitor there.

### S4

**20. No skip link on any page** (Zoopla and Airbnb have one); `nav.site-nav` has no `aria-label` and the
hub page has two `<nav>`s, one labelled; the homepage nav search input has a placeholder and no label
(`SiteNav.tsx:679-683`). No `SiteNavigationElement` markup anywhere: it has no ranking effect and I do
not recommend adding it.
**21. The navy chrome's palette** (`#07111f`, `#f59e0b`, `#1e3a5f`) is off the site's tokens on the
listing and guide pages, so the visitor changes brand between a hub and a listing.
**22. The logo** measures as 1:1 in the harness because it is a `background-clip: text` gradient; that is
a tool artefact, excluded from the counts above.

## The benchmark

Captured live 2026-09-13 (`scratchpad/audit/MA-004/bench/`). Zoopla refused the mobile fetch (403), so
its phone behaviour is not described.

| | what their navigation does | what they do better | what ours does that they do not |
|---|---|---|---|
| **Homesly** (`www.homesly.ca`) | 64 px sticky bar, Buy / Market / Sell triggers, Sign in, a red "What's my home worth?"; hover opens a 464 px band with a six-item rail where every item has a label and a sub-label ("New listings today · Fresh from the MLS feed"), a headline figure ("12 new listings since midnight"), three cards, a CTA that carries the count ("See all 12 new today"), one basis line ("Counts update through the day, straight from the MLS"), an inline "Get these in your inbox every morning →", and an IN DEMAND strip of neighbourhoods with "All 611 neighbourhoods →"; the Sell panel holds an address field and "Get my valuation" inside the menu; the footer is 1,323 px, 47 links, with a daily-brief form | The sub-label on every rail item; the count inside the CTA; a valuation form in the Sell panel; a lead form in the footer; a hard-sell line in the Buy panel ("Never miss one") | 22 hubs with a live count each; 29 streets ranked by a stated query with the ranking count on the pill; an A to Z with counts; 45 filmed streets as posters; a window and a sample printed under every figure; a keyboard path I could verify end to end |
| **Rightmove** | 50 px static bar, eight plain links (Buy, Rent, House Prices, Mortgages, Find Agent, Commercial, Inspire, Overseas) plus Sign in; hover opens a two-column list of two or three links, no figures; search lives in the hero with Buy / Rent / Sold tabs; 86 header links in the HTML | Eight intents readable without opening anything; "Instant online valuation" one hover from every page; a bar 16 px shorter than ours | Anything live; a street; a hub; a form; a mobile panel with dialog semantics |
| **Zoopla** | 72 px bar, eleven flat links, no dropdowns at all, "Agent valuation" and "Instant valuation" both in the bar, a "Skip to main content" link, `nav aria-label="main"`, `WebSite`/`Organization`/`ContactPoint` JSON-LD, footer 881 px with 52 links | Two valuation doors in the bar; the skip link; labelled landmarks; nothing to hover | Every panel; every figure; the street search; the hub list |
| **Airbnb** | The search is the navigation: a 96 px bar whose centre is the search pill with All / Homes / Experiences / Services tabs, five links, a profile menu; on the phone a fixed bottom tab bar (Explore, Wishlists, Log in) in thumb reach; footer 633 px, 38 links under Support / Hosting / Airbnb; skip link; `WebSite` + `SearchAction` | Search as the first control on every page at every width; a bottom bar on mobile; a footer a reader can scan in one screen | Content in the menu; a link graph; anything about a place |

Plainly: Homesly and Airbnb put the thing the visitor came to do in the bar (an address field, a search)
and Zoopla and Rightmove put the valuation there; ours keeps the street search two hovers deep in a panel
on every page but the scrolled homepage, and the valuation is a link to a four-field form. Homesly's
sub-labels and counted CTAs make its rail readable at a glance; ours is six bare words. Every one of them
has a footer on every page and a lead field in it or near it; ours has no footer on 509 pages and no
lead field in any footer. Ours beats all four on what a panel says once open, on honesty about windows
and samples, and on keyboard behaviour.

## The ten changes, in order of expected effect on clicks and leads

1. **Put the bar back on the scrolled homepage at 390.** Below 820 px the scrolled-in search must not take
   the row: hide it (the panel already opens with a search) or cap it at the width left after the CTA and
   the burger. Expected: the menu and the seller CTA return to the site's most visited page on phones for
   every scrolled second; no other change on this list recovers as many visits.
2. **Give every street page a footer.** Render `HomeFooter` (with its search) under `StreetFinalCtas` on
   both templates. Expected: 509 pages gain a path to every hub, the top streets, sold and guides, and
   the footer link graph doubles in pages.
3. **Fix the CTA colour on street pages.** Scope `.street-v2 a` to the page body or raise `nav .m-mega-cta`
   to win the cascade. One line; 13 CTAs on 509 pages become readable.
4. **Cut the listing page and the guides over to the forest chrome.** `SiteNavLive` plus `HomeFooter` on
   `/listings/<mls>`, a `/guides` rule in `ChromeGate`, and `Navbar` and `FooterSection` deleted with
   their `/map`, their "Sign in" CTA, their 10 px text and their unsourced claims. Expected: 461 listing
   pages gain the menu, the search and 113 crawlable links each; the guide loses its nine ghost tab stops.
5. **Put the street search in the bar on every page.** An input in the bar at 1024 and up (the homepage
   already has the component), the panel's Address search item first not last, and a `<details>`-based
   fallback so the burger and the search work before hydration. Expected: "the fastest way to any Milton
   street" becomes one gesture from every page, and available from FCP instead of TTI.
6. **Carry the context.** On street and hub pages the bar CTA, the Sell panel CTA and the mobile CTA pass
   `?street=` or `?hub=`; the brief form posts `property_address` and `neighbourhood` from the page it
   sits on so the watch is the street's or the hub's; record `consentText` from the fine print. Expected:
   the /sell form arrives prefilled, and a street-page signup becomes a street watch, the alert the
   visitor actually asked for.
7. **One basis per figure, and the same one on the destination.** The Sell panel and `/sold` read one
   Board row with one window and one sample, or the panel's note says why 334, 632 and 1,729 differ;
   render the mix-adjusted flag; write the date in prose. Drop "Every one states what homes there
   actually sold for" unless every page does.
8. **Make the Alerts panel honest and the footer a capture surface.** The Alerts CTA becomes the brief
   form's own promise (or `/saved` goes `noindex` and its link `nofollow`); `HomeFooter` gets the brief
   field beside its search, as Homesly's footer does. Expected: the one lead form in the chrome stops
   pointing at a sign-in wall, and the footer, which every page will have after change 2, captures.
9. **Make the footer the map.** Add the eight guides, Schools and Mosques with their counts, the current
   Market Watch edition, `/compare/freehold-vs-condo`, Privacy and Terms; one `/sold`; `<h2>`/`<h3>`
   headings; hub links at 44 px on touch, 12 px minimum and 4.5:1 on the compliance line. Expected:
   every entity kind reachable in one click from every page, heading-order passing, and a legal link on
   the forest pages for the first time.
10. **Spend the nav's link weight where the page is.** On a hub, the Streets panel's strip is that hub's
    streets; on a street, its neighbours and its hub's busiest; elsewhere the global strips. Add rail
    sub-labels ("Price changes · 20 this week") and the count in the CTA ("See all 460 for sale"). Hide
    the scrolled homepage triggers with `visibility: hidden`, add a skip link and an `aria-label` on the
    nav, lift the "Also" links and strip pills to 24 and 44 px. Expected: the 480 streets with two to
    four inbound links each get chrome links from their own hub and neighbours, and the rail reads at a
    glance the way Homesly's does.

After these, a visitor on any page of the site can type a street into the bar, open a menu that answers
in the first line, hand their street to the valuation without retyping it, and reach every hub, guide,
school and mosque from the bottom of every page. The panels already meet the bar; the pages around them
do not yet.

## Files

- `scripts/audit/nav-pages.json`, `nav-footer.mjs`, `nav-links.mjs`, `nav-lighthouse.mjs`,
  `nav-bench.mjs`, tracked.
- `scratchpad/audit/MA-004/` (15 page JSONs, shots, `lh/`, `links.json`, `coverage.json`, `bench/`),
  untracked.
- `HANDOFF-audit.md` rewritten, `QUEUE.md` annotated. No page, component or library file was edited.
