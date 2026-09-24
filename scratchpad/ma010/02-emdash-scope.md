# MA-010 step 2: the em-dash rule, scoped to prose
AUDIT · D:\miltonly-audit · feat/audit

Code: `scripts/audit/nightly/checks.mjs`, the block `// MA-010. The em-dash rule` (`PROSE_EXCLUDED`,
`sentencesIn`, `blankElements`, `contentOnSide`, `proseOnly`). Fixtures: `test-voice-rules.mjs`,
section 5, 265 page cases.

## What changed

Before, the rule counted every `—` in the visible body. Now a dash counts only when it punctuates
running text: something on each side of it, reading through the inline tags around it. The body goes
through five exclusions first.

| excluded | selector or test | why | production evidence (2026-09-23) |
|---|---|---|---|
| navigation | `nav`, `[role=navigation]` | menu items and the A-Z index are labels, not prose | the A-Z "X—" on all 1,343 pages |
| breadcrumbs | `[class*=crumb]`, `[aria-label*=breadcrumb]` | a trail of links is navigation even outside a `nav` | every crumb today uses "/" or "›", 0 dashes; kept out so a separator change cannot flood the report |
| option and ARIA control labels | `option`, `[role=option\|combobox\|listbox\|menuitem\|tab]` | a control's label is not prose | none today |
| label elements | `label`, `legend`, `th` | they name a control or a column | none today |
| value placeholders | an element holding only "—"; a dash glued to a unit or sign ("—/mo", "—%", "$—", "~—", "#—", "-—"); in brackets ("Tax (—)"); opening its own inline element ("<span>— vs last year</span>"); opening a line after a `<br>` | the dash stands for a missing or k-suppressed figure, not punctuation | `div.s-stat-v` on 644 street pages (1,667 dashes), `s-n` on 83, `s-rent-v` on 34, listing spec tiles on 10, `lv-stat-v`, `cb-mid-num`, `pl-stat-v` |
| link separators | a dash between two links or controls in a row of them | a row separator, not a sentence | none today |

Kept in scope on purpose:

- **Prose inside a nav or a label element.** Production's mega menu carries about forty sentences of
  method notes and fine print, and the home valuation form's CASL consent sentence sits inside a
  `<label>`. Inside a nav, a `<p>` of eight words or more is prose; so is an element with only inline
  content, eight words or more, that writes at least four of them itself (a menu card whose words all
  sit in child spans is a label); a container of blocks keeps its own sentence. A label element of
  eight words or more is kept whole. A word has two letters or more, so "3 bd · 1 ba · $3,200/mo" is
  not a sentence.
- **Headings, cards, FAQ answers, the `<title>` and the meta description.** They are the site's own
  words. The title and meta are counted whole, so a placeholder dash in a templated title or meta
  still counts: a "—" in a search result is a defect either way.
- **Share-card and JSON-LD strings** are not read by this rule (the superlative rule reads them).

## Proof

- **Two independent implementations agree on production.** The regex rule (what the nightly runs)
  and a DOM implementation of the same definition, run in Chrome with a TreeWalker over all 1,343
  captured pages, count the same dashes on every page: **743 = 743, 0 mismatches**. The same DOM
  implementation agrees on 249 of the 254 fixture pages; the 5 that differ are malformed HTML (an
  unclosed `nav` or `label`, which the rule keeps in scope and Chrome's parser swallows) and two
  step-order edge cases the fixtures pin.
- **Every one of the 743 counted dashes is punctuation.** The round 4 em-dash red team read all 144
  distinct contexts by hand: 3,939 visible body dashes, 743 counted, 3,196 dropped, and every counted
  one is prose.
- **Same bytes, old rule against new:** 1,368 em-dash findings become **574**. 794 findings disappear,
  all of them pages whose only dashes were the A-Z marker and suppressed-value tiles.

## What the 574 are

| where | findings | source |
|---|---|---|
| the agent bio, "far more than price — it is about finding the right fit" | 481 (478 listings, /sell, /about, /rentals) | `src/components/AgentContactSection.tsx:24` |
| condo cost notes, "Varies by suite — confirm with the listing or management." and "Not stated — confirm with management" | 56 | `src/lib/condoData.ts:87`, `src/components/condo/sections.tsx:97` |
| condo empty state, "No active listings in … right now — register to be alerted" | 12 | `src/components/condo/sections.tsx:189` |
| `<title>` | 19 | page metadata (about, sell, freehold, condos-guide, potl, compare x2, condos, 3 building pilots, 8 mosques) |
| meta description | 6 | home, compare, sold, 3 building pilots |
| guide and tool prose (freehold, condos-guide, potl, compare, freehold-vs-condo, sell, sold, listings, rentals, mosques, building-v2 condos) | the rest | `src/lib/tenureHubData.ts`, `src/lib/comparisonData.ts`, page files |

The excerpt now quotes the first counted dash, so a listing page's finding reads "…far more than price
— it is about…", not the menu's "X—".

## Known limits (tested, accepted)

A sentence split across two sibling spans at the dash; a quotation-attribution dash opening its own
block ("<footer>— Priya S.</footer>"); a null value interpolated mid-sentence with words on both sides
("Homes here sell in — days", counted); malformed markup keeps its text in scope; a breadcrumb with
only Tailwind classes and text separators (production uses "›").
