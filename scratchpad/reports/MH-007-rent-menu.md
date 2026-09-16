# MH-007
HOME · D:\miltonly-home · feat/rent-menu

**Rent is the fourth menu, previewed, NOT merged.** First head `b1a2bc3be2876019995697a746d50a02ae549e92` (superseded by the addendum below), preview `https://miltonly-lq7sb2evu-gtahomequest-hubs-projects.vercel.app` (CLI deploy, `VERCEL_GIT_COMMIT_SHA` passed as env so `/api/build` reports the head), `--only=nav,homepage,hub-meta` on it `PASS · 3 checks · 529 pages · 289s`. Local build exit 0, zero `P2024`, prebuild green.

- **Branch base.** MC-022 has not landed on `origin/main` (head `60780ca`, MC-015), so `feat/rent-menu` branches from `feat/nav-v3@3b56020` (the chrome, itself not merged) with `origin/main@60780ca` merged in (`c3b936d`, one conflict: `run.mjs` runs footer, catchment and video, 19 checks). If MC-022 is the nav-v3 merge, this branch is a superset of it.
- **The Rent menu** (`SiteNav.tsx`, `megaLive.ts` `composeRent`, `rentSignals.ts`): available now (1,143; on a hub or street page the hub's own count and CTA `/rentals?neighbourhood=<hub>`), by neighbourhood (every published hub, 22, with its live lease count, each a scoped `/rentals` link), typical rent by home type (DB2 closed leases, 12 months, midpoint, gated at `K_ANON_PRICE` on each type's own sample, "Sample too small" below; all four clear today: detached $3,200, semi $3,200, townhouse $3,000, condo $2,250), new this week (40), and Landlords: one sentence (2,047 leased, 43 days, 99.4% of asking), three proof points, `LandlordSignup` posting through `postLead` as source `landlord`, intent `sell`, carrying the street or hub. Rentals left the Buy rail. A fourth strip, most for rent right now.
- **Figures** all through `figureFormat` (`formatRent` added); `menu-rent-*` keys declared in `nav.mjs`; the hubs block takes a label, a figure key and a link per hub; the figures block keys on its menu, not on Sell.
- **Gates.** `nav.mjs`: four menus at 380, 390 (new), 1024 and 1440; the Rent contract in the served HTML (22 scoped hub links and counts, four typical rents, the landlord form as the CTA, Rentals gone from Buy, the scoped CTA and hub count on hub and street pages); the phone accordion's 10 figures; and **MH-006 change 5 verified present**: the bar search on the page variant at 1024 and 1440 was already visible and now asserted (input width, four triggers and the CTA beside it, no overflow). `homepage.mjs` reads `menu-rent-now` and `/rentals` as a trigger index.
- **Outside Home's files, each one line and flagged:** `src/lib/lead/sources.ts` (source `landlord`), `src/lib/lead/notify.ts` (its confirmation line and subject), `src/lib/soldCachePurge.ts` (`home:lease-market:*` joins the sold sync's purge; `test-sold-cache-purge.ts` asserts it).
- **Layout.** At 1024 four triggers, the search and the CTA share the bar: the wrap gained a 16px gap, the search gives way first (`flex: 0 1 380px`, min 170px), the CTA no longer wraps; four figures fit the narrow column at 26px.

Core merges by SHA on approval.

## Addendum, 2026-09-15: the lease samples by unit type

**Head `91f8ef0b063b4114b2bbbc42e335b9becd11a783`, preview `https://miltonly-hwz0nkjza-gtahomequest-hubs-projects.vercel.app`, `--only=nav,homepage,hub-meta` `PASS · 3 checks · 567 pages · 284s`.** Local build exit 0, zero `P2024`.

**Composition of the 12-month lease pool (2,019 leases), classed from the feed's unit field (`unit_number`: "Bsmt", "Lower", "Upper", "Main & Upper") and the opening 120 characters of the remarks ("basement apartment", "lower-level unit"; "upper level only", "basement not included"):**

| type | leases | whole home | basement unit | upper floors only |
|---|---|---|---|---|
| detached | 568 | 308, typical $3,500 | 191, typical $1,750 | 69, typical $3,250 |
| semi-detached | 141 | 107, $3,300 | 19, $1,500 | 15, $3,000 |
| townhouse | 620 | 605, $3,000 | 5, $1,550 | 10, $3,050 |
| condo | 690 | 690, $2,250 (a suite is one unit; not classed) | 0 | 0 |

- **Detached mixes unit types: a third of its leases are basement units.** The blended $3,200 sat between the whole home ($3,500) and the basement ($1,750) and described neither. The panel now states **Detached, whole home $3,500/mo · 308 leases** and **Detached, basement unit $1,750/mo · 191 leases**.
- **Semi mixes too** (19 basements, 15 upper-only): **whole home $3,300 · 107** and **basement unit $1,500 · 19**, both clear k5.
- **Townhouse: 5 basement units, exactly k5, so the split is stated:** **whole home $3,000 · 605** (unchanged from the blended figure) and **basement unit $1,550 · 5**. Ten upper-only leases are in the count and in neither figure.
- **Condo does not mix:** every lease is a suite; the figure stays **Condo $2,250 · 690**.
- The Milton-wide blended typical ($2,750) is gone from the lead and the sub-label: one number over houses, basements and suites describes none of them. The landlord panel's days-to-lease and leased-to-ask remain pool-wide, which is what they claim to be.
- **Method, in `src/lib/rentSignals.ts`:** the class is computed in SQL (`CASE ... ~*` on `unit_number` and `LEFT(public_remarks, 120)`), a basement marker wins over an upper one, a condo is `whole`. Two remarks patterns were dropped after inspection: "legal basement" and "main and second floor" without "only" classed whole townhomes as units. The sync itself does not classify units; `canonicalizeResidential.ts` only strips these markers from street names, so the markers live here. The basis sentence states the exclusion.
- **Gates:** `nav.mjs` accepts `menu-rent-<type>(-whole|-basement)`, requires a whole-home figure under a label that says so wherever a basement figure appears, and matches the phone accordions' figure count to the desktop band's (now 13) instead of a constant.
- **Trap found:** Upstash is shared across builds; the first re-preview served the old shape from `home:lease-market:<day>` for an hour. The key is versioned (`v3`) and stays under the sold sync's `home:lease-market:*` purge.

Core merges by SHA on approval.
