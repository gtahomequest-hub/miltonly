# 054 — QUEUE item 3, Gate A recon: address anchors

Recon only. No code. Nothing in this file has been built.

## 4a. What per-address data exists today

### House numbers and positions: the Town, not MLS

`src/data/townAddressPoints.ts` is a generated file holding **40,827 rooftop
coordinates** pulled from the Town of Milton Address Points layer on 2026-08-14,
under the Open Government Licence. Packed one record per line as

```
${number}|${base}|${direction}|${type}|${latOffset}|${lngOffset}
```

keyed by `rooftopKey(number, identity)` from `src/lib/town/identity.ts`.

This is the single most important finding for this item: **house numbers and their
positions are available for every address on every Milton street, not only for
addresses that have been listed.** An anchor section does not have to be sourced
from MLS at all. That removes the entire VOW question from the position half of the
feature.

Two constraints on the file as it stands:

- It exposes only `rooftopFor(key)`, a point lookup. Enumerating "every address on
  this street" needs a new export keyed on `identity.key`. Same data, one function.
- Its header says **"INGEST-TIME ONLY. Nothing that renders a page imports this"**,
  and it is 1.4 MB. Importing it into the street page makes it a render-time
  dependency and contradicts its own contract. The honest sourcing is a build-time
  or backfill-time projection into a small per-street structure, not a render-time
  import of the whole table.

### Per-listing data, from DB1 `Listing`

| field | what it is | coverage |
|---|---|---|
| `address` | full street address, house number included | every row |
| `townLat` / `townLng` | resolved Town rooftop, **nullable on purpose** | 2,805 / 3,247 = **86.4%** |
| `latitude` / `longitude` | the feed coordinate | useless, every row is `0/0` |
| `status` | `active` / `sold` / `rented` / `expired` | every row |
| `permAdvertise` | IDX display permission | every row |
| `propertyType` | geometry bucket: detached / semi / townhouse / condo | every row |
| `propertySubType` | raw PropTx tenure: `Detached`, `Att/Row/Townhouse`, `Condo Apartment`, … | 2,097 of 3,247; **1,150 NULL** |
| `crossStreet` | MLS-supplied cross street | nullable |
| `architecturalStyle`, `approximateAge`, `lotWidth`, `lotDepth`, `garageType` | building form detail | sparse |

Active inventory coverage is materially worse than the corpus figure:
**295 of 460** active + `permAdvertise` listings have a resolved rooftop (64%).

### Cross streets

Two sources, neither per-address: `Listing.crossStreet` (MLS, per listing) and
`StreetAdjacency`, rebuilt to 1,052 rows on 2026-09-03. Both are street-grain. A
cross street is a property of a street, or at best of a block, never of a house.
Presenting one per address would be inventing precision.

## 4b. Which fields are public-safe

**Safe, and already public on the page today.** `buildActiveInventory`
(`street-data.ts:1425`) already renders `address`, `price`, `bedrooms`, `bathrooms`,
`parking`, `propertyType` and `daysOnMarket` for every active listing, with a link
to `/listings/[mlsNumber]`. An active listing's address and asking price are IDX
display, gated on `permAdvertise`, and already shipped. An anchor that shows active
status for a house number publishes nothing new.

**Safe, and not from MLS at all.** House number and rooftop position from
`townAddressPoints`. Open Government Licence, municipal, already attributed in the
file header. It needs no k-anon reasoning because it is not transaction data.

**Safe with care.** Building form. `propertySubType` is the honest field and it is
NULL on 35% of rows; `propertyType` is fuller but coarser. Neither is per-address
truth for an address that has never been listed. Absent is the correct render for
an unlisted address, not "detached" inferred from neighbours.

**Never, at any k.** Sold price and sold date for a single address. `sold-data.ts`
gates every record-returning fetcher behind `canServeRecordsToThisRequest()`
(authenticated **and** VOW-acknowledged) before it touches DB2 or Redis. The rule in
the brief is stricter than k-anon and correctly so: k-anonymity protects a
*population*, and a single address is a population of one. No aggregate threshold
can make it safe, which is why the answer is "never regardless of k" rather than a
higher k.

Also never: `DB1.soldPrice` / `soldDate` are nulled corpus-wide since 2026-04-17, so
the only per-address sold price in the system is in DB2 behind the VOW gate. An
anchor must not reach for it.

## 4c. How an anchor section would be sourced

```
/streets/[slug]#[houseNumber]
   house number   <- townAddressPoints, enumerated by identity.key
   position       <- the same row's rooftop, expressed as an ordinal along the
                     street (nth of m, which side), never as raw lat/lng
   cross street   <- StreetAdjacency, street-grain, stated as a street fact
   building form  <- Listing.propertySubType where a listing exists, else absent
   active status  <- Listing where status=active and permAdvertise, else absent
```

Position expressed as an ordinal rather than a coordinate is the design choice that
matters. The rooftop is a public municipal fact, but printing lat/lng per house
turns a street page into a machine-readable address-point export, which is a
different product with a different licence conversation. An ordinal answers the
buyer's actual question, "where on the street is it", and carries no reusable
precision.

## 4d. The GSC address queries from 09-02

The brief names nine and lists eight. **One is missing from the list**; I answered
the eight given.

| query | Town rooftop | DB1 | street page | answerable |
|---|---|---|---|---|
| 1419 Costigan Road | yes | 11 rows, all Condo Apartment | `costigan-road-milton` published | **no, wrong surface** |
| 5995 Avebury Road | **none** | 0 | no street | **no, not a Milton address** |
| 71 Mae Court | yes | 1, expired, detached | `mae-court-milton` published | **yes** |
| 3165 McPhail Way | yes | 2, both expired, Detached | `mcphail-way-milton` published | **yes** |
| 262 Pine Street | yes | 3, one **active** Detached | `pine-street-milton` published | **yes, and richest** |
| 7295 Bell School Line | yes | 1, **active** Detached | in registry, **no page** | **yes, once the street has a page** |
| 8020 Derry Road | yes | 40 rows, Condo Apartment | `derry-road-milton` published | **no, wrong surface** |
| 1105 Leger Way | yes | 52 rows, Condo Apartment | `leger-way-milton` published | **no, wrong surface** |

Three findings worth more than the tally:

1. **5995 Avebury Road is not in Milton.** No Town address point, no registry entry,
   no listing, no street. Avebury Road is in Mississauga. The correct product answer
   is that this query is not ours to win, and an anchor scheme that "answers" it
   would be fabricating a Milton address.
2. **Three of the eight are condo towers, not houses.** 1419 Costigan, 8020 Derry and
   1105 Leger carry 11, 40 and 52 DB1 rows respectively, all Condo Apartment. Those
   are *building* queries. They belong to `CondoBuilding`, which is QUEUE item 4, and
   routing them to a street anchor would put 52 units behind one house number.
3. **7295 Bell School Line is a registry street with no page.** It has an active
   detached listing and a Town rooftop. The address query cannot be answered because
   the street has no page to anchor into. That is the publish-floor question, not an
   anchor question.

So of eight queries, **four are true single-address house queries** (71 Mae, 3165
McPhail, 262 Pine, 7295 Bell School Line), three of which have a published street
page today. 262 Pine is the only one with a live active listing, which makes it the
one that would render a complete anchor rather than a position-and-form stub.

Note the overlap with Task A: `mae-court-milton` and `mcphail-way-milton` are both in
the 8-street blast radius of the zero-sales gate fix, and both currently return null
from `getStreetStats`. The addresses people search are on the streets the corpus is
thinnest about.

## 5. The smallest anchor section that passes THE THREE RULES

One section per street, rendered only where the Town has address points for that
street identity, listing every house number on the street as an `<li id="[number]">`
carrying three things and no more: its ordinal position along the street with the
side it sits on ("14th of 31, north side"), the cross street at that end of the
street, and, where and only where a current `permAdvertise` listing exists, an active
badge linking to the existing `/listings/[mlsNumber]` detail page, with building form
shown from `propertySubType` when a listing has ever supplied it and simply absent
otherwise. It carries no price of any kind, no sold price or sold date at any k, no
per-address coordinate, and no inferred attribute for an address that has never been
listed, so the honest failure mode is a short line rather than a fabricated one. It
earns **SEO** because it turns one page into an entity that answers a house-number
query with a real municipal fact and a stable in-page anchor rather than a keyword
echo, and it does so from an OGL-licensed source no competitor bothers to join to.
It earns **conversion** because a buyer scanning for a specific house lands on the
exact line and finds the one CTA that matters there, an alert on that address, which
is a far sharper intent signal than a street-level alert. It is **unlike industry
norms** because every portal answers an address query with a listing card that
disappears the day the listing does, whereas this answers it with the street's own
permanent structure, which is true whether or not anything is for sale.

**JSON-LD it would emit:** one `ItemList` at
`@id: {SITE_URL}/streets/{slug}#addresses`, alongside the existing `#alternatives`
and `#nearby-places` lists in `src/lib/schema/street-schema.ts`, whose
`itemListElement` entries are `ListItem` wrapping a `Residence` (or
`SingleFamilyResidence` where `propertySubType` says detached, `Apartment` never,
since those belong to `CondoBuilding`) with `name`, a `PostalAddress` carrying
`streetAddress`, `addressLocality`, `addressRegion` and `addressCountry`, and a
`url` of the page anchor. **No `offers`, no `AggregateOffer`, and no `price` on any
address item** — an `offers` node on a single residence is exactly the shape that
would smuggle a per-address figure into structured data, and it is the one thing this
section must never emit.
