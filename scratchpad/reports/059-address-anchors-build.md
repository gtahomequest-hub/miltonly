# 059 — QUEUE item 3, address anchors: build

Branch `feat/address-anchors`, no merge.

| | |
|---|---|
| **preview to review** | **`miltonly-b1rancuw3`**, at `312478d` |
| phase 1 (four Gate A streets) | `488d16e`, preview `miltonly-nc9mq48wo` |
| phase 2 (every published street) | `b2746c4`, preview `miltonly-bz6ldhja2` |
| markup diet + siblings recon | `312478d`, preview `miltonly-b1rancuw3` |
| local build | exit 0, zero `P2024`, **18/18 prebuild**, 546 static pages |
| battery on `miltonly-b1rancuw3` | **`PASS · 9 checks · 444 pages · 71s`**, at `312478daa9a9371f5da03febc36d17d716956b3c` |
| anchor verifier on all three previews | `address-anchors PASS`, four streets each |

The addendum at the foot of this file records the markup diet and the
directional-siblings answer, and corrects section 9's claim about Bronte Street.

Gate A's map (report 054) was followed as approved. Where the build scope and the
recon differ, the scope won and the difference is named below.

---

## 1. Where the data comes from

`src/data/townAddressPoints.ts` says "INGEST-TIME ONLY. Nothing that renders a page
imports this", and it is 1.4 MB. Gate A settled the sourcing and this build follows it:
the coordinates are consumed at build time and what ships to the renderer is a house
number, a side and a position fraction.

**`scripts/town/gen-street-addresses.ts` → `src/data/streetAddresses.ts`.**
901 street identities, **40,826 civic addresses**, **3,048 placed cross streets**,
432 KB. It parses the ingest module's packed literal as text rather than importing it,
and asserts the parsed row count against `TOWN_ADDRESS_POINT_COUNT`, so a re-pull that
changes the table fails the generator loudly instead of drifting.

`src/lib/town/addresses.ts` is the one accessor, fronting the generated file the way
`roadFacts.ts` fronts `townRoadFacts.ts`, and returning null under the same rule:
absence is never evidence.

### Position

`0` at the low-number end, `1` at the high, in thousandths. The walk is **per side**,
in house-number order. A merged walk accumulates the road width on every step, because
consecutive numbers alternate across the roadway; on a short street that inflates the
total by more than the street is long. The two sides are put on one scale by measuring
each side's first point back to the street's own low-number anchor, so a side that
starts halfway along does not restart at zero. Where every point resolves to one
rooftop the fallback is ordinal spacing: true order, no invented geometry.

Walking by house number rather than projecting onto a straight axis is what makes a
crescent, a court and a circle come out right.

### Cross streets

Placed at the address on this street that comes closest to an address on that one, and
only within **150 m**. A junction our address points do not reach draws no tick. That
is a nearest-pair estimate, not a surveyed intersection, and it is worth knowing that
before anyone reads a tick as a survey. Pine Street's eight ticks come out in the order
Charles, Maiden Lane, Commercial, Fulton, Court, Prince, Bruce, Ontario, which is the
order they are in on the ground.

A tick links only where `StreetAdjacency` already holds the pair, because every
`connectedSlug` in that table is a published street. Everything else renders as a label.
A cross street is a fact whether or not we have written its page; a link to a page that
does not exist is not.

---

## 2. What the section may carry, and what it may never

Enumerated at the top of `src/lib/streetAddresses.ts`, which is the module that decides:

| field | source | rule |
|---|---|---|
| house number | Town address points, OGL | always |
| side | parity of the number | always |
| position fraction | the build-time projection | always |
| nearest cross street | the placed ticks | street grain, stated as such |
| building form | `Listing.propertySubType`, else `propertyType` | **only** where a DB1 listing for that exact address carried one |
| live status | `status = active` **and** `permAdvertise` | a link to `/listings/<mls>`, no price |

**Never, at any k:** a sold price, a sold date, an owner, a historical listing, or a
per-address coordinate. A single address is a population of one, so no aggregate
threshold can make a transaction figure safe. This is stricter than k-anonymity on
purpose, and the absence of a price is not suppression to be relaxed later, it is the
shape of the feature.

The join is by parsed house number **and** street identity. A listing whose address
parses to a different street cannot attach to this one, whatever slug ingest filed it
under; the guard proves that with an Asleton Boulevard row in a Pine Street fixture.

---

## 3. The section

`src/components/street/v2/AddressLadder.tsx`, rendered in both shells (standard and
minimal) from one `data.addresses` field.

A vertical spine standing for the roadway, odd numbers down one edge and even down the
other, each address a mark placed at its own fraction, cross streets ruled across it
with the name on the rule. Fraunces on the numbers, JetBrains Mono on the fraction and
the cross-street labels. Signal green appears on the "listed now" mark and nowhere else
in the section.

**Not a table and not a listing list.** Every portal answers a house-number query with
a card that disappears the day the listing does. This answers it with the street's own
permanent structure, which is true whether or not anything is for sale.

**No client JS.** Every mark is an `<a href="#<number>">` onto its own `id`, so a deep
link, a tap and a keyboard focus all resolve through `:target`, `:focus-within` and
`:hover` in CSS. `:target` also fires a two-beat ring on the dot, so a deep link lands
and says so; `prefers-reduced-motion` turns that off. That keeps the whole interaction
working with scripting off, which is the state Googlebot indexes in.

**Collision handling.** Ideal position is the true fraction. Where two addresses would
land on top of each other the later one is pushed down by the minimum it needs, so the
drawn order is always the true order and the drawn spacing is the true spacing wherever
there is room for it. A street too dense to label every mark keeps every mark and drops
the labels, which is the honest degradation: the address is still there, still anchored,
and its number reappears on hover, focus or target. Cross-street ticks are interpolated
onto the same curve the marks were pushed along, so a tick never crosses a mark it
should sit above.

**DOM order is by house number**, independent of the per-side placement, so the reading
order, the screen-reader order and the `ItemList` order are one sequence.

**380 px.** The two columns are halves of the container and the detail card spans the
full track width rather than the mark's half, so it has room at any width. Verified at
380 px on the phase 1 preview.

---

## 4. SEO

`<h2>Addresses on <street></h2>`, then one data-generated sentence, then the ladder.

> The Town records 35 civic addresses on Pine Street, numbered 251–446, with Charles
> Street, Maiden Lane, Commercial Street, Fulton Street, Court Street, Prince Street,
> Bruce Street and Ontario Street meeting it in that order from the low-number end.

Count, range and cross streets in order, built by `buildSummary` from the ladder and
**never written by a model**. En-dash between the numerals, no em-dash, no superlative.
The listed cross streets stop at eight and the rest become "and N more"; the ladder
still draws them all.

`ItemList` at `@id: <SITE_URL>/streets/<slug>#addresses`, `PostalAddress` items with
`streetAddress`, `addressLocality`, `addressRegion` and a `url` that
is the in-page anchor, so the list and the DOM agree. **No `offers`, no `price`, on any
item.** Gate A proposed wrapping each address in a `Residence`; the build scope named
`PostalAddress` directly and that is what shipped.

---

## 5. The guard

`scripts/test-address-anchors.ts`, the **18th** prebuild test, 34 assertions. It runs
under `tsconfig.jsx-test.json`, which exists only to set `"jsx": "react-jsx"` — the
app's tsconfig sets `preserve` because Next's bundler owns the transform, and under
`tsx` that falls back to the classic factory and fails in a component written for the
automatic runtime.

It **renders the section and reads the ids back out of the markup**. It does not assert
that a file imports something, which is the blind spot the name guard still has
(`HANDOFF` open item 10). And it scans the emitted JSON-LD for a price-shaped key and a
price-shaped value. `offers` is the specific shape to fear: it is the one node that
would smuggle a figure onto an address and still validate.

`scripts/verify/address-anchors.mjs` is the deployed-host check — section present,
every anchor a bare house number, no price in the `ItemList`, every item a
`PostalAddress` in Milton, ON. It strips React's `<!-- -->` text separator before
matching heading text, which is the one thing that differs between the rendered page
and the local render the prebuild guard reads.

---

## 6. Rollout

**Phase 1**, `488d16e`, preview `miltonly-nc9mq48wo`: `ADDRESS_LADDER_SLUGS` held the
four Gate A streets. Verified, then opened.

**Phase 2**, `b2746c4`, preview `miltonly-bz6ldhja2`: the flag goes to null.
**442 of the 445 published pages** get a ladder, **27,130 civic addresses** across the
corpus. Three published streets have no Town address points and render exactly as they
did before: `15-side-road-side-road-milton`, `second-line-milton`, `highway-7-milton`.

The flag was never the only gate. `buildAddressLadder` returns null where the Town's
address layer carries nothing, and the component renders nothing on a null ladder, so
opening the flag cannot put an empty section on a page.

### The four Gate A streets

| street | addresses | range | ticks | forms | listed now |
|---|---|---|---|---|---|
| `mae-court-milton` | **8** | 60–105 | 1 (Crawford Crescent) | 1 | 0 |
| `mcphail-way-milton` | **6** | 3115–3185 | 2 (Inglis, Menzies) | 1 | 0 |
| `pine-street-milton` | **35** | 251–446 | 8 | 2 | 1 |
| `bell-school-line-milton` | **48** | 4361–7715 | 1 (Derry Road) | 3 | 2 |

Anchor examples on `miltonly-bz6ldhja2`:

```
/streets/pine-street-milton#262
/streets/mae-court-milton#71
/streets/mcphail-way-milton#3165
/streets/bell-school-line-milton#7295
```

All four are the true single-address house queries Gate A identified, and all four now
resolve to a mark.

---

## 7. `bell-school-line-milton` was NOT generated, and why

The scope said generate it if it passes the gate. **It passes the gate and it still has
no `StreetContent` row.**

- `makeStreetDecision` returns `build` (3 DB1 rows, 2 active).
- `getStreetStats` returns a full row, not null.
- Its `StreetQueue` row reads `failed, attempts=3,
  NoCentroidError: no NEIGHBOURHOOD_CENTROIDS match for "Rural Milton West"`. **That
  error is stale.** `resolveCentroid` now consults the street's own Town centreline
  before any neighbourhood lookup, and `roadFactsFor("bell-school-line-milton")`
  returns `43.463722, -79.875859`. The centroid is not the blocker any more.
- The blocker is the **eval half**, and it is the jasper class exactly:
  `invalid_json_shape` (3 sections where 2 are expected) plus `zero_price_faq_question`
  on every one of 5 attempts. Bell School Line has two active listings around $4M and
  **zero sold in the window**, so `inputHasNoPriceAtAnyGrain` is correctly true and the
  model keeps asking a question that has been withdrawn from the bank.
- **The Opus fallback could not run.** It fired and the API returned
  `400 invalid_request_error: Your credit balance is too low to access the Anthropic
  API`. That is an account-billing state, not a code fault, and nothing in this task
  can clear it.

Spend: three DeepSeek attempts, **$0.042** total, no Claude tokens. Generation is
fail-closed, so nothing was written and no row was degraded.

**It nonetheless returns HTTP 200 today**, on production and on both previews, and its
ladder renders with all 48 addresses. Gate A's "registry street with no page" meant no
`StreetContent` row; the route renders a profile-in-preparation page without one. So
the address query is answerable on that page now, with the prose still missing.

`scripts/create-street-page.ts` is new and is the path for this: the regen runner is a
**re**generation runner and skips any slug with no `StreetContent` row. It copies the
regen runner's provider discipline verbatim (primaries forced to DeepSeek, refuses to
start if any is aimed at Claude) and adds the entity floor as a refusal rather than a
warning.

---

## 8. Page weight

The section is real content and it is not free. Measured on the phase 2 preview against
production for the same street:

| street | addresses | raw HTML, prod → preview | **compressed, prod → preview** |
|---|---|---|---|
| `savoline-boulevard-milton` | 387 | 98 KB → 745 KB | **15.7 KB → 42.1 KB** |
| `pine-street-milton` | 35 | 78 KB → 139 KB | **13.7 KB → 17.6 KB** |

The raw number reads alarming and is the wrong number to judge on. The markup is highly
repetitive, so brotli takes it back down by roughly 18x, and 42 KB over the wire for
the longest street in Milton is ordinary. Of savoline's 745 KB raw, 447 KB is the RSC
flight payload (the same tree serialized a second time) and 101 KB is JSON-LD.

Ladder sizes across the 442 pages: **median 47, mean 61**, 59 streets at 100 or more,
15 at 200 or more, one at 387. There is no page in the corpus larger than savoline.

No cap and no pagination was added. If one is ever wanted, the number to act on is the
compressed one, and 42 KB does not justify losing an anchor.

---

## 9. Things worth knowing

1. **Directional siblings share one ladder.** `identityFromSlug` drops the direction by
   design, and a street page already unions its directional siblings, so Bronte Street
   North and Bronte Street South each render the whole of Bronte Street's addresses.
   Consistent with the rest of the system, and it should be a deliberate decision rather
   than a discovery.
2. **A tick is a nearest-pair estimate**, within 150 m, not a surveyed intersection.
3. **`src/data/streetAddresses.ts` is generated.** Re-run the generator whenever
   `townAddressPoints.ts` is re-pulled, or the ladder silently keeps the old street.
4. **Published count is 445**, not the 444 the previous handoff recorded. The battery
   still reports 444 pages; it counts a different population.
5. Building form falls back from `propertySubType` to `propertyType` where the raw
   tenure is NULL, which Gate A measured at 35% of rows. Both are the address's own
   listing; nothing is inferred from a neighbour.

## Not done

- No merge. Preview gate applies and Aamir reviews `miltonly-bz6ldhja2` first.
- `bell-school-line-milton` still has no generated prose. See section 7.

---

# Addendum, 2026-09-08 — the markup diet and the directional-siblings answer

`312478d` on the same branch.

## A. Weight

**One element per address.** A mark was six elements; it is now one tag that is
simultaneously the anchor target, the label and the popup host:

```html
<a id="71" class="s-m" data-d="0.50 along · odd side · Crawford Crescent · Detached"
   style="top:160px" href="#71">71</a>
```

The detail line lives in a single `data-d` and CSS draws it with
`content: attr(data-d)` on hover, focus or `:target`. The dot on the spine is a
`::before` rather than a shipped `<i>`. Class names are short because this selector set
repeats up to 387 times on one page, and the static words that used to repeat with it
("nearest cross street") moved into the legend, where they are written once. A mark
carrying a live listing is the one exception — a link cannot live inside CSS generated
content — so it renders a real detail element and omits `data-d`; the generated popup is
gated on `[data-d]` so it can never draw an empty box.

`addressCountry` left the `ItemList`. `addressRegion` "ON" already disambiguates Milton,
and the field cost 24 bytes 387 times over, twice.

Every address keeps its numeric `id`, its `href="#<number>"` and its `ItemList` entry.
The guard now counts mark tags against mark count, so a regression that reintroduces a
wrapper fails the build rather than showing up as a byte count nobody measures.

### Measured

| street | addresses | raw before → after | compressed before → after |
|---|---|---|---|
| `savoline-boulevard-milton` | 387 | 745,330 → **421,542** (−43%) | 42,139 → **37,161** (−12%) |
| `pine-street-milton` | 35 | 139,286 → **110,797** (−20%) | 17,609 → **16,984** (−4%) |
| `mae-court-milton` | 8 | 93,027 → **86,565** (−7%) | 15,019 → **15,019** (0%) |

Production, for the same three streets with no section at all: 97,965 / 77,822 / not
measured raw, and 15,719 / 13,721 compressed.

**The 250 KB target was not reached, and it cannot be reached under the constraints it
was given.** Here is the arithmetic, measured rather than estimated, on savoline:

| | bytes |
|---|---|
| the page without the section (production) | 97,965 |
| the addresses `ItemList`, in the markup | 87,581 |
| the same `ItemList` again, escaped, in the inlined RSC flight payload | ~96,869 |
| 387 marks in the DOM, plus ticks and section chrome | 52,192 |
| the same marks again in the flight payload | ~85,170 |
| **total** | **419,778** |

The App Router inlines the RSC flight payload into the HTML, so everything on the page
is served twice. **The `ItemList` alone now costs 184,450 bytes, and the budget between
the production baseline and 250,000 is 152,035.** The list is over budget before a single
address element is drawn.

Pushing further does not close it:

- dropping the `ListItem` wrapper and emitting bare `PostalAddress` items saves
  ~38,000 and lands at **~382,000**;
- with bare items **and 387 marks costing literally nothing**, the floor is **244,251**,
  and zero-cost marks are not a thing;
- to fit 250,000 while keeping every address element, the `ItemList` would have to be cut
  to about **40 of the 387 addresses**.

So the choice is between the full `ItemList` and a 250 KB raw page; they do not coexist.
**My recommendation is to keep the full list.** The compressed transfer is
**37 KB**, which is what a browser and a crawler actually pay, and it moved only 12%
while the raw figure moved 43% — because what was removed was highly repetitive markup
that brotli was already collapsing to nearly nothing. 37 KB of HTML for the longest
street in Milton is ordinary, and 347 of the 387 addresses are not worth trading for a
raw-byte number nobody transfers.

The diet was still worth doing: it is a real 43% cut in parse work and memory, and the
markup is simpler than what it replaced.

### What the diet cost

The detail text is now a CSS-generated string rather than DOM text. It is still in the
served HTML as an attribute value, and generated content is exposed by current screen
readers, but it is no longer selectable and no longer counts as page text. The H2, the
summary sentence and the `ItemList` carry the section's indexable weight, so this is a
small loss and a deliberate one.

## B. Directional siblings — there are none, and my earlier note was wrong

`scripts/recon-directional-siblings.ts`, read-only. **No changes made.**

**No pair of published pages maps to one registry street.** The claim in section 9 of
this report and in the handoff — that Bronte Street North and South each render the whole
of Bronte Street — was reasoning from the identity model, not from the data, and the data
does not support it. Corrected here.

Evidence, across 490 `StreetContent` rows of which 445 are published:

**Exactly one identity key carries more than one row, and it is not directional.**

| key | slug | status | template | stored name | resolves to | via |
|---|---|---|---|---|---|---|
| `jarrett\|\|crossing` | `jarrett-cross-milton` | unpublished | standard | Jarrett Cross | Jarrett Cross | fallback |
| `jarrett\|\|crossing` | `jarrett-crossing-milton` | **published** | standard | Jarrett Crossing | **Jarrett Crossing** | **registry** |

One registry street behind it, `JARRETT CROSSING`, 17 civic addresses. `jarrett-cross`
is an abbreviated-slug duplicate, it is unpublished, and it resolves through the fallback
chain rather than the registry, which is exactly what an unofficial slug should do. Only
one of the two is published, so no two live pages share a ladder.

**Groups where more than one row is published: 0.**

**The registry carries two compass-word streets, and neither has a page:**

| slug | identity key | page |
|---|---|---|
| `kennedy-circle-east-milton` | `kennedy-circle\|\|` | NONE |
| `kennedy-circle-west-milton` | `kennedy-circle\|\|` | NONE |

They collide with **each other**, not with the published `kennedy-circle-milton`, which
parses to `kennedy||circle` — "circle" is consumed as the street type there and is part
of the base in the directional forms. So the published Kennedy Circle page is unaffected,
and its 215-address ladder is its own. `kennedy-circle||` has no Town address points at
all, so neither directional street would get a ladder even if it were published.

**Bronte:** `bronte-street-milton` is the only Bronte row in `StreetContent`. There is no
North/South pair, published or otherwise.

### What this leaves

The identity model still collapses directionals by design, and a street page still unions
its directional siblings for listings and sold records. Nothing in the corpus exercises
that today on the ladder. The exposure is future: if `kennedy-circle-east-milton` and
`kennedy-circle-west-milton` were ever published, they would share one ladder, and
`jarrett-cross-milton` would share Jarrett Crossing's if it were ever published. Both are
publish decisions, not render bugs, and the recon script above reproduces the check.
