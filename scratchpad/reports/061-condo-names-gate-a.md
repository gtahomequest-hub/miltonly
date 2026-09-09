# 061 — QUEUE item 4, condo building names: Gate A recon

_2026-09-09. Read only. No feature code written. `scripts/recon-condo-names.ts` is the evidence._

## The headline, before the detail

**There are 65 `CondoBuilding` rows, not 108.** The brief's figure does not reproduce, the same
way item 7's "46" did not (open item 10). Everything below is against 65.

**64 of the 65 resolve cleanly through the registry.** One fails. The parse is not the hard part.

**The hard part is the direction, and it is a Gate A decision, not an implementation detail.**
36 of 65 stored strings end in a compass letter, the rule as briefed drops all 36, and roughly
half of them are feed noise while the Main Street ones are not.

**And a render-time resolver alone does not deliver the brief.** The title and the meta
description are read from **stored** `CondoContent` columns, and 57 of 59 of them carry the
abbreviation — as does the generated prose body, which no resolver can reach.

## 1. How a condo is named today

Two routes, and they name a building differently.

**Pilot route** — `isCondoPilot(slug)`, an allowlist of exactly four slugs
(`610-farmstead-drive`, `830-megson-terrace`, `480-gordon-krantz-avenue`, `139-main-street`).
`buildBuildingAttributes` → `foldName()` takes the **modal `association_name`** across the
building's sold records, rejects condo-corporation legal names through `CORP_REJECT`, and on
rejection or absence falls back to `addressFallback = displayName ?? buildingAddress ?? slug`.

| surface | expression | source |
|---|---|---|
| H1 | `BuildingAttributesPage` `<h1 className="cb-title">{name}</h1>` | `view.name` ← `buildingName.name` |
| breadcrumb | `cb-crumb` … `{name}` | same |
| title / description | `generateMetadata` | `displayName ?? buildingAddress ?? slug` — **not** `buildingName` |
| JSON-LD `name` | `generateCondoSchema({ name })` | `safe.buildingName.name` |
| JSON-LD `address` | same call | `safe.displayName` |
| JSON-LD breadcrumb | `generateBreadcrumbSchema` | `safe.buildingName.name` |

**Legacy route** — everything else, 59 published `CondoContent` rows.

| surface | expression | source |
|---|---|---|
| H1 | `sections.tsx` `<h1>{data.name}</h1>` | **stored** `CondoContent.buildingName` |
| address line | `<div className="c-addr">{data.address}</div>` | `buildingAddress ?? displayName` |
| breadcrumb | `sections.tsx` `{data.name}` | stored `buildingName` |
| title | `content.metaTitle ?? \`${content.buildingName} \| …\`` | **stored** `metaTitle` |
| description | `content.metaDescription` | **stored** `metaDescription` |
| JSON-LD `name` / breadcrumb | `generateCondoSchema`, `generateBreadcrumbSchema` | `data.name` |
| JSON-LD `address` | `generateCondoSchema` | `data.address` |

Two surfaces the brief does not list and the rule has to cover, or the corpus disagrees with
itself: the **`/condos` index card** (`nameBySlug.get(slug) ?? displayName ?? buildingAddress ??
slug`) and the **nearby-buildings list** inside `getCondoData` (`displayName ?? buildingAddress
?? slug`).

### The raw form stored

All six name columns are populated on all 65 rows, and **`displayName` is byte-identical to
`buildingAddress` on all 65** — the schema comment ("populated = buildingAddress at backfill, no
clean name source") still holds, so there is one raw string, not two.

```
buildingAddress   "1005 Nadalin Hts"    streetNumber "1005"  streetName "Nadalin Hts"   streetSlug "nadalin-heights-milton"
buildingAddress   "1050 Main St W"      streetNumber "1050"  streetName "Main St W"     streetSlug "main-street-milton"
buildingAddress   "21 Crt St N"         streetNumber "21"    streetName "Crt St N"      streetSlug "court-street-milton"
buildingAddress   "760 `whitlock Ave"   streetNumber "760"   streetName "`whitlock Ave" streetSlug "whitlock-avenue-milton"
```

`streetName` is the abbreviation. **`streetSlug` is already the expanded registry slug** — the
correct answer is in the row, unread by any naming surface. So is the building's own slug
(`1005-nadalin-heights-milton`).

## 2. The parse, measured

Two independent routes to a registry slug, run against each other rather than one trusted blind:

| | |
|---|---|
| resolve through the **registry** | **64** of 65 |
| resolve through the off-registry allowlist | 0 |
| land on the fallback chain | 0 |
| **fail** to produce "number + name" | **1** |
| stored `streetSlug` usable on its own | 64 |
| re-parse of the raw address usable | 63 |
| both present and **agree** | 63 |
| both present and **disagree** | **0** |
| parse failed, the column rescued it | 1 — `21-court-street-milton`, `"21 Crt St N"` ("Crt" is not in `canonicalType`) |
| column failed, the parse rescued it | 0 |

The two routes never contradict each other. `streetSlug` is the primary and the re-parse is a
belt, not the other way round.

### The one failure, with its raw string

```
6415-regional-road-25-milton    raw "6415 Regional Rd"    streetSlug regional-road-25-milton
```

`regional-road-25-milton` is in neither `MILTON_STREET_REGISTRY` (944 rows) nor
`OFF_REGISTRY_SET` (19 rows), and the raw string has lost the "25", so the re-parse lands on
`regional||road`, which is nothing. It needs an off-registry allowlist entry — the same
treatment `25-side-road-milton` and `nipissing-road-milton` already have — or it stays on its
raw string. It is one row and it is a decision, not a bug.

### What would change on screen

**61 H1s change, 3 are already correct.**

```
1005 Nadalin Hts      ->  1005 Nadalin Heights
100 Millside Dr S     ->  100 Millside Drive
21 Crt St N           ->  21 Court Street
760 `whitlock Ave     ->  760 Whitlock Avenue
830 Megson Terr       ->  830 Megson Terrace
1479 Maple Ave W      ->  1479 Maple Avenue
1050 Main St W        ->  1050 Main Street
```

The first five are unambiguous wins, including the stray backtick, which the rule cleans as a
side effect of never rendering the raw string again. The last two are the problem.

### The direction question — the real Gate A decision

**36 of 65 stored strings end in a compass token.** `parseAddress` pops it by design and the
registry carries only two directional streets in 944 (`kennedy-circle-east`, `-west`), so the
rule as briefed drops every one of the 36.

**Four streets carry contradictory directions across their own buildings**, which settles those:

```
gordon-krantz-avenue-milton  {E,S,W}  460 …Ave S / 470 …Ave / 480 …Ave E / 490 …Ave W
sauve-street-milton          {S,W}    620 …St W / 630 …St / 640 …St S / 650 …St
costigan-road-milton         {E,S}    1379 …Rd E / 1380 …Rd S / four with no direction
main-street-milton           {E,W}    1050 Main St W, and 16 on Main St E
```

A street cannot be East and West and South at once. Gordon Krantz, Sauve and Costigan are feed
noise and dropping them is a **correction**.

**Main Street is not.** 1050 Main Street West and 1470 Main Street East are opposite ends of
Milton, and collapsing 17 buildings onto "Main Street" makes seventeen H1s that a resident would
call wrong — and two of them, `1360 Main St E` and `1360 Costigan Rd`, only stay distinguishable
because they sit on different streets. The same doubt applies weakly to the ten streets carrying
exactly one direction (`derry-road` {W} on 2 of 2, `bronte-street` {S}, `ontario-street` {S}).

**No directional variant exists as an entity anywhere** — not in the registry, not in the
off-registry allowlist, not as a `StreetContent` row, published or draft. Checked for all 14
streets involved. So there is nothing to name and nothing to link to; inventing one is a publish
decision under the entity floor, not a rendering change.

## 3. Proposal

**The display rule.** A condo's rendered name is `${streetNumber} ${resolveStreetName(streetSlug).name}` —
the stored civic number, a single space, and the full registry name — computed once in a new
`src/lib/condoName.ts` that is the only source of a condo's name on any surface, exactly as
`resolveStreetName` is for streets, and read by the H1, the breadcrumb, the title, the meta
description, both JSON-LD nodes (`name` and `address`), the `/condos` index card and the
nearby-buildings list. It takes `streetSlug` as the primary and a `parseAddress` re-parse of
`buildingAddress` as the belt, since the two agree on all 63 rows where both answer and the belt
alone rescues none; a row that resolves through neither keeps its raw string rather than
rendering a guess, which today is one row. A real `association_name` still wins on the pilot
route, because "Bronte Meadows" is a better H1 than any address — the rule governs the address
fallback, not the name above it. **The direction is dropped only where the corpus proves it
noise**, and until Aamir rules on Main Street I propose the rule ships with a small explicit
`DIRECTIONAL_KEEP` map so that 1050 Main Street West stays West and Gordon Krantz loses its
three contradictory letters; the alternative, dropping all 36, is defensible under "the registry
is the authority" but I would not ship it without you saying so.

**Which surfaces change**: H1, breadcrumb, title, meta description, JSON-LD `name`, JSON-LD
`address`, the `/condos` index card, the nearby-buildings list. 61 of 64 resolvable buildings
render different text; 3 are already correct; 1 is unchanged pending an allowlist entry.

**The stored half, which the brief does not cover and which the render cannot fix.** 57 of 59
published `CondoContent` rows carry the abbreviation in **`buildingName`**, 57 in **`metaTitle`**,
57 in **`metaDescription`**, and 57 in the generated **prose body**. Routing the render through a
resolver fixes the H1 and the breadcrumb and the JSON-LD, and it fixes the title and description
only if those surfaces stop preferring the stored column. So this item is two pieces: a resolver,
and a backfill of `buildingName`/`metaTitle`/`metaDescription` in the shape of
`scripts/backfill-street-names.ts` from item 1 — name columns only, **no prose column touched**.
The 57 prose bodies are a regeneration question and I recommend they stay out of item 4.

**The guard.** `scripts/test-condo-name.ts`, a new prebuild test in the pattern item 3
established and open item 11 wants everywhere: it **renders** both condo routes and reads the
name back out of the markup rather than asserting that a file imports the resolver. It asserts
that no rendered H1, breadcrumb, title, meta description or JSON-LD `name` matches the
abbreviation set (`St|Rd|Dr|Ave|Blvd|Cres|Crt|Ct|Hts|Terr`) as a whole word; that the civic
number survives; that a building with no resolvable street renders its raw string rather than a
bare slug or a half-name; and that the `DIRECTIONAL_KEEP` entries survive the render. It runs
against the real 65 rows through a fixture, so a re-ingest that reintroduces an abbreviation
fails the build rather than shipping.

## Stopping here

No code until approved. The three things I need a ruling on:

1. **Main Street.** Keep the direction, or follow the registry and drop it on all 17?
2. **`6415 Regional Rd`** — add `regional-road-25-milton` to the off-registry allowlist, or leave
   the one row on its raw string?
3. **The stored backfill.** In scope for item 4, or a separate item after the resolver lands?
