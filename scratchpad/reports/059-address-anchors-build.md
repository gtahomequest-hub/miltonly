# 059 — QUEUE item 3, address anchors: build

Branch `feat/address-anchors`. Two commits, two previews, no merge.

| | |
|---|---|
| phase 1 (four Gate A streets) | `488d16e`, preview `miltonly-nc9mq48wo` |
| phase 2 (every published street) | `b2746c4`, preview `miltonly-bz6ldhja2` |
| local build | exit 0, zero `P2024`, **18/18 prebuild**, 546 static pages |
| battery on the phase 2 preview | **`PASS · 9 checks · 444 pages · 61s`**, at `b2746c4c6658b67b082fe008e63709be562ef84d` |
| anchor verifier on both previews | `address-anchors PASS`, four streets each |

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
`streetAddress`, `addressLocality`, `addressRegion`, `addressCountry` and a `url` that
is the in-page anchor, so the list and the DOM agree. **No `offers`, no `price`, on any
item.** Gate A proposed wrapping each address in a `Residence`; the build scope named
`PostalAddress` directly and that is what shipped.

---

## 5. The guard

`scripts/test-address-anchors.ts`, the **18th** prebuild test, 30 assertions. It runs
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
