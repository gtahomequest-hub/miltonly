# Queue

Five items, in order. **The builder never reorders this list and never self-starts an item.** Each begins only on an explicit prompt, and is marked done in the same commit that rewrites `HANDOFF.md`.

Status: item 1 **done** (merged as `973940a`). Item 2 **done** (merged as `7c2a448`), **extended and done 2026-09-04** (merged as `243cee5`, upload run `11f877b`). Item 3 **Gate A reported 2026-09-04, awaiting approval**. Items 4 and 5 **not started**.

---

## 1. Naming close-out and hygiene

Close the gap DEC-NAME-SOURCE left open and clear the debris around it. The create branch of the `StreetContent` upsert in `generateStreet.ts` writes `streetName` from `resolveStreetName` the way the update branch already does, and the prebuild guard is rewritten to assert **both** upsert branches rather than merely that the file imports the resolver. Repair `gifford-crescent-milton`'s stored name, which the cron wrote as `Gifford Cres` on 2026-09-03. Wire `revalidatePath` on every successful `StreetContent` write, covering the street page, `/streets`, and the street's hub. Run recon on `parkway-drive-milton`: report which token trips the `superlative` validator on 20 of 20 attempts, then fix it and regenerate. Resolve `burnhamthorpe-road-milton`, whose `getStreetStats()` returns null because all five activity sources are empty. Finally, pin the package manager: add `"packageManager": "pnpm@..."` to `package.json`, delete `package-lock.json`, and `corepack enable`. Pin line endings in the same pass: add a `.gitattributes` carrying `* text=auto` and `*.sql text eol=lf`, so a second machine writing here cannot churn the diff.

**Done when** the battery reports 9/9 on production, `parkway-drive` regenerates clean, and no npm lockfile remains in the repo. *Amended 2026-09-03: regeneration is required only where data exists. `burnhamthorpe-road-milton` is exempt — the street has one expired listing, zero DB2 rows under any key and no DB3 row, so `getStreetStats()` correctly returns null and there is nothing to regenerate from.*

## DONE 2026-09-03, merged as `973940a`

Production `miltonly-81x82cqig` serving `973940a`; battery **PASS · 9 checks · 428 pages**, exit 0, run twice (before and after the backfill).

- [x] create branch derives `streetName` from `resolveStreetName`
- [x] guard asserts **both** upsert branches; verified red on main's file, green on the branch
- [x] `gifford-crescent-milton` repaired to "Gifford Crescent"
- [x] DEC-REGEN-REVALIDATE wired for page, `/streets`, and hub
- [x] `parkway-drive` recon and fix: the validator was flagging "Brian Best Park", a Town park at 320 Parkway Drive W, so every faithful attempt named it and every attempt was rejected. Grounded proper nouns are masked before the banned-word test; regenerated clean on the first attempt
- [x] `packageManager: pnpm@9.15.9`, `package-lock.json` deleted, `.gitattributes` and `build.log` handled
- [x] **stored names backfilled corpus-wide**: `scripts/backfill-street-names.ts`, 378 rows repaired, rerun reports 0. `streetName` only; no prose column touched
- [x] battery 9/9 on production
- [n/a] `burnhamthorpe-road` regeneration, exempt under the amended criterion above. Whether a page should exist for a street with no data remains an open question, tracked in `HANDOFF.md`
---

## 2. Video hosting on Cloudflare R2

Move street video off Vercel Blob and onto R2. Repoint the upload script at R2 with idempotent pathnames so a re-run cannot create duplicates, migrate `lemieux-court` off Blob, upload the eight other staged clips, and set `videoUrl` on all nine streets.

**Done when** nine street pages serve their video from the R2 host and the Vercel Blob object is deleted.

**Setup phase done 2026-09-03.** Bucket `miltonly-video` (ENAM) created; public access via `https://pub-7975a00b72d94caba9def0c4b5e9c388.r2.dev`; `R2_*` credentials in `.env.local` and Vercel Production and Preview; S3 PUT / public GET / DELETE all proven against a 1 KB object. `video.miltonly.com` could not be attached because `miltonly.com` is not a Cloudflare zone, so the custom domain remains an open decision. ## DONE 2026-09-03, merged as `7c2a448`

Eight of the nine street pages serve video from R2, verified on production; the Vercel Blob objects are deleted and the old URL 404s. Battery 9/9 on production over 431 pages.

- [x] upload script repointed at R2, idempotent on a HEAD size check
- [x] 18 objects uploaded, immutable and Range-capable
- [x] `lemieux-court` migrated off Vercel Blob; both Blob objects deleted, store otherwise untouched
- [x] `videoUrl` and `videoCapturedAt` set on eight streets
- [x] three pages generated so their clips had somewhere to land (`clifford-point`, `chretien-street`, `heaven-crescent`), $0.0223
- [n/a] `tasker-court-milton` has no page and cannot have one: its four DB2 sales all predate the 12-month window, so `getStreetStats()` correctly returns null. Its clip sits in R2 unused. Same shape as `burnhamthorpe-road-milton`
  - *Amended 2026-09-04: that conclusion was wrong. `getStreetStats()` returned null because the gate never consulted DB2, not because the street had nothing. `fix/zero-sales-tier` adds DB2 record existence as a sixth source. **`tasker-court-milton` is now generated and published, and serves its R2 video, poster and `VideoObject`. All nine of the nine staged clips have a page.** The branch is not merged.*
- [ ] `video.miltonly.com` still unattached; `r2.dev` is rate-limited and not a permanent answer. Requires moving `miltonly.com` nameservers to Cloudflare, which moves DNS for the whole site

## EXTENDED 2026-09-04, merged as `243cee5`, upload run `11f877b`

The corpus outgrew the nine-clip pilot. **78 objects, 213.6 MiB in R2**, up from 18 and
35.8 MiB; **28 `StreetContent` rows carry a clip**, 25 day and 3 night. Detail in
`scratchpad/reports/055-r2-upload-32.md`.

- [x] upload script repointed at `D:/dashcam/manifest.json` + `staged/<slug>/meta.json`; candidates are `status: staged` **and** `blur_verified: true`, anything else refused and reported. Zero refusals: all 32 staged rows were signed
- [x] 32 clips and 32 posters uploaded, immutable, Range-capable. A TLS drop killed the first run after ten streets; the HEAD-size idempotency held and the resume finished cleanly
- [x] `lemieux-court` and `locker-place` replaced both objects and both pointers with newer captures
- [x] day/night keys: `streets/<slug>-milton/day.mp4` or `night.mp4` per `meta.night`, one shared `poster.webp`
- [x] three night captures re-keyed off the day key (`chretien-street`, `clifford-point`, `frost-court`): copy, repoint, delete, in that order
- [x] `deriveVideoPoster` taught about `/night.mp4`. It had rewritten `/day.mp4` only, so a night URL produced `night.webp` and shipped a **VideoObject with a 404 thumbnail**. Verified live on production before the fix. 12th prebuild test, 11 assertions, red then green
- [x] `staged/` emptied to `published/` (39), every `meta.json` stamped, `manifest.json` rebuilt from the directories
- [x] 24 street paths revalidated on production, all 200
- [ ] **11 slugs uploaded with no `StreetContent` row**, assets ready and unused: `1st-line`, `attenborough-terrace`, `bronte-street-south`, `dalhousie-gate`, `gosford-crescent`, `haxton-heights`, `louis-st-laurent-avenue`, `lower-base-line-west`, `miller-way`, `timmer-place`, `tock-close`. Generation candidates
- [ ] **seven live clips carry `blur_verified: false`**, all from the 2026-09-03 run. Decision needed: verify or pull
- [ ] `video.miltonly.com` still unattached, and the bucket just grew six-fold. `r2.dev` is rate-limited and not intended for production traffic at volume

---

## 3. Address anchors

Add `/streets/[slug]#[houseNumber]` sections to street pages. **Gate A recon first**, with no code until the map is approved. An anchor shows position on the street, the cross street, building form, and active listing status. It never shows a sold price for a single address, which the VOW rules forbid.

**Done when** Gate A is approved. Build scope is set at that point, not before.

### Gate A reported 2026-09-04, not yet approved

`scratchpad/reports/054-address-anchors-gate-a.md`. No code written.

- **Position needs no MLS data.** `src/data/townAddressPoints.ts` carries 40,827 OGL-licensed Town rooftop points covering every Milton address, listed or not, so the VOW question does not arise for the position half. It exposes only a point lookup today and declares itself ingest-time only, so a render surface needs a per-street projection rather than a 1.4 MB import.
- **Of the eight GSC queries listed** (the brief says nine; one is missing from the list): `5995 Avebury Road` is **not a Milton address**; `1419 Costigan`, `8020 Derry` and `1105 Leger` are **condo towers** carrying 11, 40 and 52 DB1 rows, which is item 4's surface, not a street anchor. Four are genuine single-address house queries: `71 Mae Court`, `3165 McPhail Way`, `262 Pine Street`, `7295 Bell School Line`. Only `262 Pine` has a live active listing; `7295 Bell School Line` is a registry street with **no page**.
- Sold price and sold date for a single address stay out at any k, per the rule above. A single address is a population of one, so no aggregate threshold can make it safe.
- Proposed section and its `ItemList` JSON-LD shape are in the report. **Awaiting approval before any code.**

---

## 4. Condo building names

Route the street component of every `CondoBuilding` address through `resolveStreetName`, preserving the house number, so the naming authority covers condo surfaces as it already covers streets. Applies to the H1, the title, the meta description, the JSON-LD, and the breadcrumb.

**Done when** all 108 buildings render full street names and the name guard's coverage extends to condo surfaces.

---

## 5. Geometry backfill

Populate solar exposure, surface, lanes, sidewalk, maxspeed, length, and terminus onto all published streets from the Town and OSM layers. No camera work, and nothing derived from imagery.

**Done when** those fields are populated for every street with an OSM match, and rendered wherever the page design calls for them.
