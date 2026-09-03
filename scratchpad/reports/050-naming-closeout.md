# QUEUE item 1: naming close-out and hygiene

`fix/naming-closeout` @ `c01fd93` (work at `a850640`), pushed, **not merged**.
Preview `miltonly-gy10g0owg`, battery **PASS · 9 checks · 428 pages · 73s**, exit 0.

## 1. Packaging

`corepack enable` succeeded but resolved pnpm 11.25.0, which requires Node >= 22.13 while this
project declares `engines.node: "20.x"` and the machine runs v20.20.2. Pinning fixed it.

`"packageManager": "pnpm@9"` was rejected: *"Invalid package manager specification in package.json
(pnpm@9); expected a semver version"*. Corepack needs a full semver, so the pin is **`pnpm@9.15.9`**,
the latest 9.x per the registry, which is the line that supports Node 20. Deviation from the literal
instruction, same major.

- `package-lock.json` deleted, `.gitattributes` gains `* text=auto` (it already carried
  `*.sql text eol=lf`, which survives), `build.log` added to `.gitignore` because CLAUDE.md makes it
  the local gate artifact.
- `pnpm install` exit 0 and **`pnpm-lock.yaml` byte-identical**: md5 `854db35861b68d3ce2438bdd32b6e5b7`
  before and after, `git status` clean on the file.

## 2. Both upsert branches

`generateStreet.ts` create branch now writes `streetName: resolveStreetName(streetSlug, streetName).name`.

The old guard was **file-level**: it asked whether a file that reads a raw name also imports the
resolver. `generateStreet.ts` did, so it stayed green while one branch of the upsert bypassed it.
The new assertion is **branch-level and structural**: it locates `prisma.streetContent.upsert(`,
isolates each branch body by brace matching, and requires `streetName: resolveStreetName(` in both.

Proof it discriminates, same guard against both versions of the file:

```
main's generateStreet.ts   exit 1
  src/lib/generateStreet.ts: the CREATE branch of streetContent.upsert does not
      derive streetName from resolveStreetName. The registry is the naming authority on BOTH
      branches; a bare shorthand here lets whatever MLS last wrote reach the column.

branch's generateStreet.ts exit 0
  [street-name-repair] PASS - 944 registry slugs resolve to their official name, plus 26 cases.
```

### gifford repair

```
BEFORE  streetName="Gifford Cres"      updatedAt=2026-09-03T11:02:12.466Z
TARGET  resolveStreetName -> "Gifford Crescent"  source=registry
AFTER   streetName="Gifford Crescent"  updatedAt=2026-09-03T20:32:57.460Z
```

### The finding that goes beyond scope

A corpus scan says **380 of 472 rows** have a stored `streetName` that differs from the resolver:
`"Williams Ave"`, `"Winter Cres"`, `"Wilson Dr"`, and so on. The create-branch gap predates Build 1,
so nearly every row was born with whatever MLS wrote and only the regenerated ones were repaired.

Not user-visible: the renderer and `buildGeneratorInput` both resolve. But the column is wrong, and
the DEC-PH41-DUALWRITE read paths trust it. **I repaired only gifford, as scoped.** A 380-row
backfill is a decision for you.

## 3. DEC-REGEN-REVALIDATE

Call site: `generateStreet.ts`, immediately after the successful `streetContent.upsert`, inside the
`else` branch that only runs when the fail-closed path did not fire.

Paths, observed live during the parkway regeneration:

```
/streets/parkway-drive-milton
/streets
/neighbourhoods/old-milton
```

The hub is resolved through `Neighbourhood.rawStrings`, because `stats.neighbourhood` carries the raw
TREB string (`"1035 - OM Old Milton"`), not a slug, and only when `isHub` is true.

**Guarded on purpose.** `revalidatePath` needs a request-scoped incremental cache. The cron route has
one; a bulk regeneration script does not, and logged exactly that:

```
[generateStreetContent] revalidate skipped for /streets/parkway-drive-milton (no request scope):
  Invariant: static generation store missing in revalidatePath
```

A script must not die because it cannot purge a cache it was never able to reach. The path derivation
is still proven correct by that log line.

## 4. parkway-drive: a validator false positive, not a model failure

**The flagged string is `Brian Best Park`.**

```
- superlative in section "market":  ...its position near Brian Best Park and 16 Mile Creek Park North...
- superlative in section "about":   ...close to the core, with Brian Best Park just a short stroll away...
- superlative in section "amenities": ...close at hand. Brian Best Park is a two-minute walk...
```

**Origin: a grounded input token, echoed back correctly.**

```
src/data/townPlaces.ts:82
  { name: "Brian Best Park", classification: "DISTRICT", address: "320 Parkway Drive W", ... }
```

The park's address is *on Parkway Drive*. It is therefore in this street's amenity input every time,
the model names it every time, and `wordBoundaryRegex("best")` matched inside the proper noun every
time. That is why the failure was deterministic at 20 of 20 rather than stochastic: the validator was
punishing the model for using the input it was handed, and no number of retries could ever clear it.

One attempt also produced a genuine idiomatic hit (*"the pace of activity is best understood"*), which
the rule is right to catch.

### Fix, at the source

`maskGroundedProperNouns(text, input)` masks names the generator was **given** before the banned-word
test: `nearby.parks`, `schoolsPublic`, `schoolsCatholic`, `mosques`, `grocery`, `hospital`, `goStation`,
`highway`, `crossStreets[].name`, and the street's own name. Longest-first, so a shorter overlapping
name cannot split a longer one and re-expose the banned word. Applied at **both** superlative sites
(sections and the FAQ subset validator). A superlative the model invents is untouched.

### Result

```
[Phase41/market] attempt 1: 0 violations (clean)
[Phase41/aha]    attempt 1: 0 violations (clean)
[Phase41/eval]   attempt 1: 0 violations (clean)
[Phase41] combined: 911 words, total $0.00402, PASS
[Phase41/judge]  round=1 PASS

AFTER name="Parkway Drive"  judge=PASS  attempts=1  cost=$0.0040
"Parkway Drive West" occurrences: 0
"Brian Best Park" present (grounded, expected): 2
```

First attempt clean, after 20 consecutive failures.

## 5. burnhamthorpe-road: not a keying defect

Checked all three databases and the entity layer:

```
DB1 Listing by streetSlug   burnhamthorpe-road-milton  status=expired  n=1
DB1 Listing by address      3029 Burnhamthorpe Road W  -> same slug, so no split keying
DB1 ResidentialStreet       slug=burnhamthorpe-road-milton  name="Burnhamthorpe Rd W"
DB2 sold.sold_records       by street_slug: none · by address ILIKE: 0 rows
DB3 street_sold_stats       no row
```

The slug is consistent everywhere; there is no registry mismatch and no missing entity row. The street
has **one listing and it is expired**, nothing sold, nothing leased, no analytics row. All five sources
in `getStreetStats`'s gate are legitimately empty, so returning null is correct behaviour.

**Nothing to fix, so nothing regenerated.** The real question is whether a published page should exist
for a street with no data behind it. That is a decision, and I did not unpublish a live page on my own.

## 6. Build

**`pnpm build` exit 0.** 9 prebuild tests PASS, 0 `Failed to compile`, route table emitted with
`ƒ /api/build`.

Run 1 exited **1**, failing 5 of 530 prerenders on
`Timed out fetching a new connection from the connection pool (timeout: 10, connection limit: 1)`.
Run 2, identical code, exited **0** with zero failures. `DATABASE_URL` carries `connection_limit=1`
and `pgbouncer=true`, and `getOrGenerateStreetContent` is not called by the street page, so the
revalidation added here is not in that stack. It is a flaky local pool, not a defect, but it makes the
mandated gate non-deterministic and the local limit is worth raising.

## 7. Battery on preview

```
build       a850640 served == expected
sitemap     428 published street pages (derived, not a literal)
crawled     428 pages · 428 × 200 · 0 other
═══ PASS · 9 checks · 428 pages · 73s ═══   exit 0
```

## Not merged

Preview gate applies and the branch is untouched on `main`. Three decisions are waiting: merge or not,
the 380-row backfill, and what to do with `burnhamthorpe-road`. QUEUE item 1's "Done when" cannot be
satisfied as written, because it requires `burnhamthorpe-road` to regenerate clean and there is no data
to regenerate from.
