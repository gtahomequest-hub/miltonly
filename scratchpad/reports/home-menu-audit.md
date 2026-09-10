HOME · D:\miltonly-home · feat/homepage

# Mega menu audit — production, 2026-09-10

Driven with Puppeteer against `https://miltonly.com` at 1440, 1024 and 380, serving
`e2d8476`. 66 machine findings in `scratchpad/menu-audit/findings.json`, 17 screenshots in
`scratchpad/menu-audit/`. The Puppeteer Chromium download is blocked in this environment, so
the audit drives the locally installed Chrome; the scripts are in the same directory.

**Aamir is right, and the two worst defects are not subtle.** The mobile menu paints its
contents outside its own container on every page of the site, and the Sell panel publishes raw
floats — `$937,465.504`, `27.829694323144103` — live, right now. Both are visible in the
screenshots. Neither was caught by any gate, including the ones I wrote, because every check I
built reads the homepage body and none of them opens a menu.

---

## Defects, ranked

### S1 — The mobile panel is 66px tall and its content renders outside it. Every page.

`src/components/nav/site-nav.css:140-142` sets `.sn-panel { position: fixed; inset: 0 }`.
`src/components/nav/site-nav.css:15-16` and `src/components/home/home-theme.css:123` set
`backdrop-filter: blur(14px)` on the `<nav>`.

**A `backdrop-filter` creates a containing block for `position: fixed` descendants.** So
`inset: 0` resolves against the 67px nav, not the viewport. Measured at 380:

```
panel      : top 0, height 66, width 380, scrollHeight 408, position fixed, overflow-y auto
viewport   : 780
accordion  : top 78, height 230  -> starts BELOW the panel's own bottom edge
firstSummary: belowPanelBottom = true
containingBlockTraps: [ NAV .m-nav, backdrop-filter: blur(14px), h 67 ]
```

The menu's links paint over live page content with no background behind them, the panel's own
`overflow-y: auto` is useless because its box is 66px, and body-scroll lock is still applied so
the page underneath cannot move either. `380-accordion-open.png` shows the result: a close
button, then the hero showing through where the menu should be.

Confirmed identical on `/streets` (`.site-nav`, same `backdrop-filter`). **This is every page
of the site on every phone.**

### S2 — The Sell panel publishes unformatted floats. Live.

`src/components/nav/SiteNav.tsx:90` `const money = (n) => '$' + n.toLocaleString('en-CA')`,
applied at `:159` to `s.typical`; `:165` renders `{s.daysToSell}` bare; `:171` renders
`{s.soldToAsk}%` bare. `src/lib/homepageData.ts:197-199` feeds them the Board's raw values.

Rendered on production (`1024-Sell-open.png`, `1440-Sell-open.png`):

| shown | should be |
|---|---|
| `$937,465.504` | `$937K` |
| `27.829694323144103` | `28 days` |
| `0.980868783307145%` (clipped) | `98%` |

This is the same defect I fixed on the homepage proof points in `5448b96` — and **the menu was
never fixed with it**, because `buildMegaLive` reads `overall.soldToAsk.value`, the ratio,
rather than `soldToAskPct`. It is still wrong on my own preview branch.

### S3 — The panel overflows the viewport at 1024.

`src/components/nav/site-nav.css:277-282`: the panel is `position: absolute` against
`.m-navitem` at `left: -24px`, `width: min(760px, calc(100vw - 48px))`. Anchoring a 760px panel
to the trigger means the further right the trigger, the further off-screen the panel.

| width | menu | panel right edge | viewport | overflows |
|---|---|---|---|---|
| 1024 | Buy | 1024 | 1024 | flush, by luck |
| 1024 | Streets | **1089** | 1024 | **yes, 65px clipped** |
| 1024 | Sell | **1173** | 1024 | **yes, 149px clipped** |
| 1440 | all three | 1206 / 1271 / 1355 | 1440 | no |

At 1024 the Sell panel loses its entire third figure and half the in-demand strip. 1024 is a
MacBook Air open in a browser window; this is not an edge case.

### S4 — Keyboard users cannot reach the menu at all.

Tab order from the logo, measured at 1440:

```
tab1 A.m-navtrigger 'Buy'      openPanels=[] focusInsidePanel=false
tab2 A.m-navtrigger 'Streets'  openPanels=[] focusInsidePanel=false
tab3 A.m-navtrigger 'Sell'     openPanels=[] focusInsidePanel=false
tab4 A.m-navcta                openPanels=[] focusInsidePanel=false
```

Focus never opens a panel and never enters one. All 55 panel links are unreachable by keyboard.
Pressing Enter on a trigger *does* open the panel (`openPanels: 1`) but focus stays on the
trigger, so a keyboard user opens a drawer they cannot then walk into, with no way to know it
opened. `aria-expanded` stays `false` through the whole tab sequence.

### S5 — No hover. Click only, on all three menus, at every desktop width.

```
1440 Buy/Streets/Sell opens-on-hover: false, false, false
1024 Buy/Streets/Sell opens-on-hover: false, false, false
```

Every reference mega menu opens on hover on a pointer device. Ours requires a click, and the
trigger is also a link, so a user who clicks slightly wrong navigates away instead. This is the
single most likely source of "does not function properly": it does not respond to the gesture
people use.

### S6 — The mobile menu carries none of the live content.

```
380 mobile-live-content: cards 0, frames 0, figs 0
```

Rails only. No listings, no film posters, no market figures. The desktop panels carry all three.
Phone traffic gets a table of contents where desktop gets the product.

### S7 — Every text node in every panel is below 14px.

Measured across all three panels at 1440: **77 text nodes, not one at 14px or above.**

| element | size |
|---|---|
| rail label ("BUY") | 10px |
| in-demand strip label | 10px |
| figure labels ("Typical price") | 11px |
| listing address / street name | 11.5px |
| lead line, strip links, "All listings" | 12.5px |
| rail links | 13.5px |

Contrast is fine — zero nodes below 4.5:1 against `rgb(4,22,15)`. The problem is purely scale:
at these sizes the panel reads as a dense utility dropdown, not a designed surface. This is the
"not world class" signal.

### S8 — The in-demand strip is the same eight links in all three panels.

`SiteNav.tsx` renders `<InDemandStrip>` inside every panel. Open all three and you see
Farmstead, Scott, Laurier, Ontario, Rose, Asleton, Kennedy, Bronte — three times. It earns its
space once. At 1024 it also wraps to two lines and is clipped by S3.

### S9 — Two panel links 307-redirect.

`/map` and `/book` both return 307 from the panel. 31 of 33 return 200. A nav link should be a
destination, not a redirect hop.

### S10 — The Buy panel shows listings with no photographs.

`panel-content: cards 4, totalImgs 0`. Four price-and-address rows. The Streets panel proves the
mechanism works (4 posters, `brokenImgs: 0`). A listings panel without images is the one place
a real estate site cannot afford text-only.

### Minor

- Panels are 353-428px tall in a 900px viewport at 1440: under-filled, lots of dead space.
- No open/close animation; the panel appears instantly (measured open 145-183ms, which is
  harness latency, not motion).

### What works, and should be kept

- **All three panels are in the DOM when closed**, with 21 / 19 / 15 links each. Crawlable.
- **Escape, outside-click and scroll all close correctly**, at both desktop widths, every menu.
- **Layout shift on open is 0.0000.** The panel overlays; it never pushes content.
- **Tap targets at 380 are 44px** on every accordion link, the burger and the CTA.
- **No broken images**; the film posters load.
- **The accordion opens and Escape closes the mobile panel** — the logic is right, S1 just
  makes it invisible.

---

## Against the four reference panels

| Reference | What it has | What ours lacks |
|---|---|---|
| **New listings today, cards + counts** | photo, price, beds/baths, days on market, a live "N new today" count | ours has price + address only, **no photo**, no beds, no DOM, and the count sits in one 12.5px line rather than anchoring the panel |
| **Browse by neighbourhood, columns, live counts** | every neighbourhood in 2-3 columns, each with an active count | **ours has no neighbourhood panel at all.** 22 hubs, each with a live count already computed for the homepage ladder, and the menu links to none of them |
| **Conversion panel, proof points + one CTA** | 2-3 proof figures and a single unmistakable action | ours has three figures (broken, S2) and a 12.5px text link. No visual CTA anywhere in any panel |
| **Sell panel with the valuation form inline** | address field + submit, inline | ours links to `/sell`. Defensible — a form inside a popover cannot carry the CASL consent text — but then the panel must earn its space another way, and three broken figures do not |

**What a first-time visitor would find confusing:** three menus that do not respond to hover;
an identical strip of eight street names repeated in each; a "Sell" panel showing
`27.829694323144103`; and on a phone, a menu that dumps its links over the page.

---

## Against THE THREE RULES and the tokens

- **SEO — passes.** 55 links in the served HTML whether or not a panel is open. Keep this
  property through any rebuild; it is the reason the header was rebuilt in the first place.
- **Conversion — fails.** No CTA in any panel. The one conversion surface (Sell) is the one
  rendering floats. Nothing in any panel is styled as an action.
- **Layout unlike industry norms — fails, in the wrong direction.** It is not unconventional;
  it is a conventional mega menu at 80% scale with a broken mobile mode.
- **Tokens** are used correctly: `#073126` ground, `#017848` accent, `#00ff80` reserved for
  signal, Fraunces / Inter / JetBrains Mono all bound through their variables. No token
  violations found. The failure is scale and hierarchy, not palette.

**What a Bloomberg or Airbnb design lead would change first:** the type scale. Bloomberg would
say a panel where every number is 11px has no hierarchy — the figure and its label are the same
weight, so nothing leads. Airbnb would say the panel should open on hover, fill a predictable
full-bleed band under the nav rather than floating off the trigger, and carry one obvious action.
Both would fix the mobile panel before anything else, because it is not a design problem, it is
a broken page.

---

## Rebuild scope, one page

**1. Fix the two live breakages first, as a hotfix, before any redesign.**
Move `backdrop-filter` off the `<nav>` onto an inset pseudo-element so the nav no longer forms a
containing block, or render the mobile panel in a portal outside the nav. Format the Sell
figures through the same helpers the page body uses (`soldToAskPct`, `roundPriceForProse`,
`Math.round` on days). These two are a small, self-contained change and should ship on their own.

**2. Geometry.** Replace the trigger-anchored absolute panel with one full-bleed band anchored
to the nav, spanning the content column, opening under all three triggers at the same place. It
cannot overflow because it no longer depends on where the trigger sits.

**3. Interaction.** Open on hover with a ~120ms intent delay and on focus; keep click; keep
Escape, outside-click and scroll-to-close. On open, move focus into the panel and trap it until
close; restore focus to the trigger on Escape. Set `aria-expanded` honestly.

**4. Type scale.** Floor of 14px for any link, 16px for a listing price, 24px+ for a headline
figure with its label at 12px beneath it. Give each panel one hierarchy: one thing that leads.

**5. Content, per panel.**
Buy: 4 listings with photographs, price, beds and days on market, plus the live active and
new-this-week counts as a headline pair, and one CTA to `/listings`.
Streets: the film posters (already good) plus a neighbourhood column set — all 22 hubs with
their live active counts, which the homepage ladder already computes.
Sell: the three market figures, correctly formatted, each with its window, and one CTA to
`/sell`.
Move the in-demand strip to the Streets panel only.

**6. Mobile.** The accordion is right; give it the live content too — at minimum the counts and
the film posters. Keep the 44px targets.

**7. Gate it.** Extend `hub-intents.mjs` into a nav check that runs on every page type:
panel links present in served HTML, every href resolves, every panel figure matches its source
and its format, no panel overflows the viewport at 1024, and the mobile panel's measured height
is within 20px of the viewport. The last one would have caught S1 on the day it shipped.

**Fix `/map` and `/book`** to point at their real destinations, and re-point the sell panel at
`soldToAskPct` in the same change as S2.
