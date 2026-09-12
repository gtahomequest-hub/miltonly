# Queue

Seven items, in order. **The builder never reorders this list and never self-starts an item.** Each begins only on an explicit prompt, and is marked done in the same commit that rewrites `HANDOFF.md`.

Status: item 1 **done** (merged as `973940a`). Item 2 **done** (merged as `7c2a448`), **extended and done 2026-09-04** (merged as `243cee5`, upload run `11f877b`). Item 3 **done** (merged as `e14bfa2`, with `a6229a7` on top; production `miltonly-c25astehn`). Item 4 **done** (merged as `a7e3a7f`, with `ff70116` on top). Item 7 **DONE** (merged as `8db80da`, branch head `dce1b70`, production verified). Item 5 **DONE** (merged as `142b9a9`, branch head `b0d424b`, production battery 13/13 at `bfb78f3`). Item 6 **not started**.

**The 249-page creation programme (from item 7), and its cap.** The widened gate admits 249
registry-filtered streets with no page. They ship at **a maximum of 20 new pages a day** on the
cron (`NEW_PAGES_PER_DAY`, `/api/sync/generate`), counted over `StreetContent.createdAt`, so the
corpus grows at a reviewable rate rather than overnight. The drain runs hourly, so a
per-invocation limit would have allowed 480 a day. Regenerations are not capped and never were.
**The programme is paused after 5 pages** on a prompt/validator fault, not on the cap. Record in
`scratchpad/reports/066-rulings-and-merges.md`.

*Out-of-queue work 2026-09-05: the corpus grounding audit and its remediation, merged as `c953b9e`. Not a queue item — it was prompted directly. Record in `scratchpad/reports/058-corpus-audit.md`.*

*Out-of-queue work 2026-09-10: the guides tier and the Market Watch weekly edition, merged as `f6bbc92`. Not a queue item — it was prompted directly in the `feat/content` worktree. Records in `scratchpad/reports/062-content-gate-a.md`, `063-content-gate-a.md` and `064-content-build.md`.*

*Out-of-queue work 2026-09-10, the LEAD LAYER. **Phase 0 done**, merged as `c4a162b`: the two street forms that captured nothing, and `ALERT_EMAIL_TO`. **Phase 1 done**, merged as `3461e13`, a two-parent merge of `feat/leads`: one lead model, one guarded submission path, source-specific confirmations, watches for the alert surfaces, the alert cron, leads-per-page, and the environment tag. Not queue items — both were prompted directly. Records in `scratchpad/reports/062-leads-gate-a.md` and `063-unnotified-leads.md`, state in `HANDOFF-leads.md`. **Phase 2 done**, merged as `543ef99` (merges `26381f9`; ML-001 fast-forwarded `feat/leads` to `00e0eb1` and set `BRIEF_UNSUBSCRIBE_SECRET`): all twenty submission points on one client helper, `/api/leads` + `/api/off-market-leads` + `/api/exclusive-inquiry` deleted, a prebuild gate that walks `src/`, and the Monday-to-Friday daily-brief sender with a signed one-click unsubscribe. Record in `scratchpad/reports/067-leads-phase2.md`.*

*Out-of-queue work 2026-09-12: MC-016, the Neon egress recon. Recon only, no code. Neon's per-day consumption endpoint is Scale-plan only; measured with `pg_stat_statements` (now on DB1 and DB2) instead: ≈ 0.15 GB per battery run, `/streets`, the published-slug sets, `/rentals` and the `Neighbourhood`/`HubContent` sets are the heavy readers; ceiling proposed 16 GB/month. Record in `scratchpad/reports/MC-016-neon-egress-recon.md`. MC-017 (Vercel build cost, `fix/build-cost`) and item 6 (MC-015, `feat/video-playbook`) are next, in that order.*

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

## BUILT 2026-09-08 on `feat/address-anchors`, NOT MERGED

Gate A approved as scoped. Two commits, two previews. Detail in
`scratchpad/reports/059-address-anchors-build.md`.

Phase 1 `488d16e`, preview `miltonly-nc9mq48wo`, the four Gate A streets.
Phase 2 `b2746c4`, preview `miltonly-bz6ldhja2`, every published street.
Markup diet + directional-siblings recon `312478d`, preview `miltonly-b1rancuw3`.
Six section changes `c01a004`, **preview `miltonly-5evd895mv` — the one to review**.
Battery **`PASS · 9 checks · 444 pages · 73s`** at the full SHA on it.
Local build exit 0, zero `P2024`, **18/18 prebuild**, 546 static pages.

- [x] `scripts/town/gen-street-addresses.ts` projects the ingest-only address table into
      `src/data/streetAddresses.ts` at build time: 901 identities, 40,826 civic addresses,
      3,048 placed cross streets, no coordinate per house
- [x] per-address house number, side, position fraction, nearest cross street, building form
      where a DB1 listing for that address carried one, and a live-listing link. No sold price,
      no sold date, no owner, no historical listing, at any k
- [x] `/streets/<slug>#<houseNumber>` on every address, `:target` highlight, no client JS
- [x] the address ladder: spine, odd and even edges, cross streets ruled across it. Verified at
      380 px. Signal green on the "listed now" mark only
- [x] H2 + a data-generated summary sentence + a `PostalAddress` `ItemList` with no `offers`
      and no `price` on any item
- [x] `scripts/test-address-anchors.ts`, 18th prebuild test, 52 assertions. It renders the
      section, reads the ids and the rendered positions back out of the markup, counts one tag
      per address, and fails on any two same-side marks closer than their hit area
- [x] rolled out to the four Gate A streets, verified, then to all 442 published streets that
      have Town address points (3 published streets have none and are unchanged)
- [ ] **`bell-school-line-milton` still has no generated prose.** It passes
      `makeStreetDecision` and `getStreetStats`; the eval half fails on DeepSeek with the jasper
      class (`invalid_json_shape` + `zero_price_faq_question`), and the Opus fallback returned
      `400: Your credit balance is too low to access the Anthropic API`. $0.042 spent, nothing
      written. Its page returns 200 and its ladder renders regardless
- [x] markup diet 2026-09-08: one tag per address, detail in one `data-d` drawn by CSS.
      savoline-boulevard 745 KB to 421 KB raw, 42.1 KB to 37.2 KB compressed
- [x] **250 KB target withdrawn 2026-09-09, the full ItemList stays.** Arithmetic in report
      059. savoline is 437 KB raw and 38 KB compressed
- [x] 2026-09-09: end padding, cross streets at the right edge and linked from the sentence,
      position in words, the exact footer sentence, two CTAs in the page's own card, and a
      14 px non-overlapping hit area for every mark whose label is suppressed. 52 assertions
- [x] **merged 2026-09-09**, approved by Aamir on preview `miltonly-jtca7e7qu` at `4810ad5`

## DONE 2026-09-09, merged as `e14bfa2`

Production `miltonly-c25astehn` serving `a6229a7`, confirmed on the apex through
`/api/build`. Battery **`PASS · 9 checks · 444 pages · 61s`**, exit 0, at the full SHA.
`scripts/verify/address-anchors.mjs` PASS on `https://miltonly.com`. All four anchor URLs
return **200 with their `id` present in the served markup**:
`/streets/pine-street-milton#262`, `/streets/mae-court-milton#71`,
`/streets/mcphail-way-milton#3165`, `/streets/bell-school-line-milton#7295`.

- [x] 380px tappability measured corpus-wide, not on one street: 442 ladders, 27,130 marks,
      13,816 labels suppressed, minimum same-side gap exactly 14 px, zero below it, minimum
      top 34 px, zero clipped ends. `scripts/measure-address-380.ts`
- [x] `scratchpad/**` excluded from the app tsconfig (`a6229a7`), after a throwaway script
      there failed a Vercel build. Proven both ways with a probe. Runnable `.ts` still
      belongs in `scripts/`
- [ ] **"Watch <Street>" points at `#street-alert`, not at a VIP signup.** There is no VIP
      signup route in this codebase. Deliberate deviation from the brief; a distinct VIP
      list is a new surface and a new decision

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

## DONE 2026-09-09, merged as `a7e3a7f`

*The population is **65 buildings, not 108**. The brief's figure does not reproduce, the same way
item 7's "46" does not. Gate A recon in `scratchpad/reports/061-condo-names-gate-a.md`.*

Production battery **`PASS · 9 checks · 444 pages · 67s`** at the full SHA. Five condo H1s
verified on production: `1050 Main Street East`, `1470 Main Street East`, `1005 Nadalin Heights`,
`174 Bronte Street South`, `490 Gordon Krantz Avenue`.

- [x] `src/lib/condoName.ts` is the only condo name source. `streetSlug` primary, address
      re-parse as a check that must agree or the row is reported (2 report, both understood)
- [x] **the direction is the Town's per civic address or absent.**
      `src/data/addressDirections.ts`, 1,355 civic addresses over 12 streets, 36 dropped for
      contradicting themselves. `"1050 Main St W"` is an address the Town records as MAIN
      STREET E. **There is no Main Street West condo**
- [x] `regional-road-25-milton` added to `OFF_REGISTRY_STREETS`
- [x] every surface wired: H1, title, meta description, breadcrumb, JSON-LD name and address,
      OG and Twitter on both routes, condos index, autocomplete, hero index, hub condo list,
      and `buildCondoBuildingInput` so the next generation does not undo it
- [x] `scripts/test-condo-name.ts`, 19th prebuild test, 112 assertions, renders and reads the
      H1 and breadcrumb back out of the markup. **Red on main's behaviour at 54 of 112**
- [x] backfill: 57 of 59 rows, 171 values, re-run changes 0, prose untouched
- [x] **prose regenerated**: 52 passed, 1 failed, 2 skipped, `$0.0900`, DeepSeek only, cap $2.
      All 59 condo pages revalidated, `/condos` revalidated
- [x] a real fix found by running it: the model was quoting the raw `buildingAddress` it was
      still being handed, writing a direction the Town contradicts into three bodies
- [ ] `830-megson-terrace-milton` fail-closed on its validator and keeps its old prose. Queued
      as `condo:830-megson-terrace-milton`. Its H1 and stored name columns are already correct
- [ ] `158-mill-street-milton` and `174-bronte-street-milton` are zero-data and the generator
      refuses them before any write. Same shape as `burnhamthorpe-road-milton`

---

## 5. Geometry backfill

**DONE 2026-09-11 (MC-005), merged as `142b9a9`** (branch head `b0d424b`, by SHA, full gate). Production battery at `bfb78f3`: **`PASS · 13 checks · 449 pages · 126s`**, the `geometry-facts` check among them. 447 of 449 published streets carry the Road facts card; 2,646 facts, each equal to the layer row.

Populate solar exposure, surface, lanes, sidewalk, maxspeed, length, and terminus onto all published streets from the Town and OSM layers. No camera work, and nothing derived from imagery.

**Done when** those fields are populated for every street with an OSM match, and rendered wherever the page design calls for them.

*Gate A done 2026-09-11 (MC-003), no code: coverage over the 449 published streets per layer, where each field renders, and the validator rule that keeps geometry out of the prompt. Record in `scratchpad/reports/MC-003-core-batch-2.md`. Build awaits rulings.*

*Built 2026-09-11 (MC-004) on `feat/geometry` at `b0d424b`, preview `miltonly-ra87zyzmu`, battery `PASS · 13 checks · 449 pages`. Merged 2026-09-11 (MC-005) as `142b9a9`. 447 of 449 published streets render a Road facts card; 2,646 facts, every one equal to the layer row. Record in `scratchpad/reports/MC-004-merge-queue-geometry.md`.*

*MC-014, 2026-09-12: hubs v2 merged as `05bc914` (approved), core batch 3 merged as `f01a96a`, production `PASS · 16 checks · 489 pages`. Nothing waits on a merge. Record in `scratchpad/reports/MC-014-hubs-and-batch-3-on-main.md`.*

*MC-012, 2026-09-12: three merges by SHA (`3d905a6`, `798f610`, `94ddc49`); core batch 3 on `fix/core-batch-3` `bf4f8b3` (board never family, judge non-violation labels, hub meta without em-dashes, scoped /rentals, the overflow page retired to a 301, parking and GO up-links, the `sources-fresh` check), preview 15/15, not merged. Record in `scratchpad/reports/MC-012-merges-core-batch-3.md`.*

*MC-011, 2026-09-11/12: five merges by SHA (`9ba0811`, `9c8b520`, `e71a7f6`, `625e000`, `d01787f`), production 14/14 at `2a89120`; the three judge rulings built on `fix/judge-rulings` `1b4ab5d` (investor question out, K-gated lease count in; option not resident; one retry on an unparseable judge reply), preview 14/14; 13 of the 15 judge-refused crossed streets republished ($0.1549), 21 of 23 now on the repaired sample. Record in `scratchpad/reports/MC-011-merges-judge-rulings.md`.*

*MC-009 and MC-010, 2026-09-11: `e12b1b6` merged as `f347001`; the judge verdict persisted (`feat/judge-verdict`, migration applied), the seven clips uploaded with two re-keyed and the orphan retired (`feat/video-rekey`), 8 of the 23 k-crossed streets republished on DeepSeek ($0.2770), a validator false positive fixed (`fix/comparator-park-mask`), and the sold sync's two-cache purge proven on preview (`fix/sold-sync-purge`); four branches wait on merges. Record in `scratchpad/reports/MC-009-judge-video-regen.md`.*

*MC-005, 2026-09-11: five merges by SHA (`cbea785`, `142b9a9`, `1f0915e`, `bfb78f3`, `854ffd3`), production green at `bfb78f3` with 13 checks, `AI_PROVIDER_MARKET=deepseek` on Production and Preview, the evaluative prompt shaped to the input (`src/lib/ai/evalPromptShape.ts`), the programme re-queued and building on the cron: 14 pages today for $0.3270, 20 a day, DeepSeek first. Record in `scratchpad/reports/MC-005-merges-provider-prompt-programme.md`.*

*MC-004, 2026-09-11: MC-003 merged as `8ebb937`, production battery 12/12. The creation programme's 244 unbuilt candidates re-queued as `pending` (they were never the cron's: 167 absent, 68 `ineligible` under the old gate, 9 `failed` at attempts=3); the 18:00Z cron picked up 20 and all 20 failed on the Anthropic credit balance, so the programme needs credit or a DeepSeek market half on production before it moves. DEC-QUEUE-REEVAL on `fix/queue-reeval` at `4a65f30`, not merged. Record in `scratchpad/reports/MC-004-merge-queue-geometry.md`.*

*Out-of-queue work 2026-09-11, MC-003 on `fix/core-batch-2` at `5ebe87a`: guide up-links on every street page and hub with a 12th battery check, the dead `maintenanceFee` column retired from every read with a prebuild guard, the `sold_date` stamping reported and stopped, and the first five programme pages recorded with their judge results. Preview green, not merged. Record in `scratchpad/reports/MC-003-core-batch-2.md`.*

---

## 6. Video playbook adoptions

Six changes the 2026-09-04 upload run left open. Each is a delta against what is live now, and
each was confirmed absent before this item was written.

**Dated object keys.** Keys are `streets/<slug>-milton/day.mp4` and `night.mp4` today, with one
shared `poster.webp` — undated, so a newer capture can only replace an older one and the two
cannot coexist. Move to a dated key (`streets/<slug>-milton/<YYYY-MM-DD>-day.mp4`), which also
makes cache-busting free on an immutable object. The re-key is the same copy-repoint-delete
order the three night captures used on 2026-09-04: copy, repoint the column, verify serving,
only then delete.

**`captured_at` with an offset, plus a backfill.** `videoCapturedAt` and `nightCapturedAt` are
plain `DateTime`. A night clip's claim to be night is only checkable against a local wall clock,
so the capture offset has to travel with the timestamp rather than be inferred at render. Carry
the offset, and backfill the 42 rows already holding a clip from the `meta.json` each was
uploaded from.

**`sitemap-video.xml`.** `src/app/sitemap.ts` is the only sitemap in the app and it carries no
video entries. A `VideoObject` in page JSON-LD is not a substitute — Google's video index reads
the video sitemap. Emit one covering every row with a `videoUrl` or `nightVideoUrl`, with
thumbnail, title, description and duration.

**A coverage sentence.** The page shows a clip and says nothing about what it covers or when.
State the segment filmed and the capture date in prose, next to the player. A viewer cannot tell
a full-street pass from a fifty-metre clip, and a clip that implies more coverage than it has is
the same defect class as a figure that implies more data than it has.

**A takedown `mailto:`.** There is no route for someone who wants footage of their own property
removed. One address, on the page carrying the clip, answered by a person. This is not optional
once real streets and real houses are on camera.

**Reject an audio stream at upload.** `scripts/upload-street-videos-r2.ts` gates candidates on
`status: staged` and `blur_verified: true` and does not look at the streams at all. A dashcam
clip carrying audio can carry a recorded conversation, which is a consent problem no blur pass
addresses. Probe the file and refuse any candidate with an audio stream, reported the way the
blur refusal is.

**Done when** all six are live, the 42 clip-carrying rows are backfilled, and
`sitemap-video.xml` validates.

---

## 7. `makeStreetDecision`'s minimum-data gate

`DEC-ZERO-SALES-TIER` added DB2 record existence as a sixth activity source, but only inside
`getStreetStats()`'s `hasStreetActivity` check. `makeStreetDecision` has its own earlier gate —
`totalListings === 0 || (soldCount < 1 && activeCount < 1)` returns `skip_low_data` and marks the
queue row `ineligible` — and it reads DB1 `Listing` only. So the sixth source is never consulted
for exactly the streets it was added to admit. Manual generation works; the cron cannot reach
them.

Extend that clause with the same DB2 existence probe (`countRecordedTransactions`, which is
already written, sibling-slug-unioned and `perm_advertise`-filtered) so the two gates agree.

**Measure the population first — the brief's figure of 46 does not reproduce.** Counted
2026-09-05 against DB2 and DB1: **831 slugs carry DB2 records; 419 of them are skipped as
low-data by this gate; 103 of those already have a `StreetContent` row** (so the cron cannot
refresh them) **and 316 have no page at all** (so they are creation candidates, which is a
different and much larger decision). That count is unfiltered for the registry and includes
unit-level artifacts such as `whitlock-ave-sw-712-milton`, so the real number is lower. Pinning
it against the Town registry is step one, and the build scope follows from it — not from 46.

**Done when** the two gates consult the same sources, the registry-filtered population is
reported, and the streets that already have pages refresh on the cron without a manual run.

## DONE 2026-09-10, merged as `8db80da`

Pulled forward into a directly prompted CORE batch ahead of item 5, not self-started. Record in
`scratchpad/reports/065-core-batch.md` and `scratchpad/reports/066-rulings-and-merges.md`.

**NOT marked done, and the reason matters.** This item's own "Done when" requires that the
streets which already have pages refresh on the cron. That needs the merge, and the merge is
blocked: production's battery is red on two stale hub checks that came in with `feat/homepage`.
The work is finished; the criterion is not met yet.

- [x] the two gates consult the same sources. `makeStreetDecision` calls the same
      `countRecordedTransactions`, and only when the DB1 clause has already failed, so a street
      that already passes costs the cron exactly what it cost before
- [x] **the registry-filtered population reported: 355.** 832 slugs carry DB2 records, 422 are
      skipped by the old gate, 355 survive the entity floor, 67 do not
- [x] `StreetQueue` view of the same change: `skip_low_data` **256 to 78**, 178 rescued
- [x] the DB2 branch is floored on the registry. 14 of the slugs it would otherwise rescue are
      ingest debris (`derry-rd-road-milton` at 236 rows, `nipissing-rd-milton-road-milton`,
      `bessy-trail-trail-milton`, `nipising-road-milton`). Verified safe first: 0 of the then-445
      published streets were off the floor
- [x] `scripts/dryrun-street-decision-gate.ts` measures without writing
- [x] **RULED: the programme ships with a daily cap of 20 new pages on the cron.**
      `NEW_PAGES_PER_DAY = 20`, counted over `StreetContent.createdAt` — `generatedAt` and
      `publishedAt` are both rewritten by every regeneration and would have counted refreshes as
      creations. A street over budget stays **pending**, not ineligible, and the cap is reported
      in the route's JSON so it cannot be mistaken for a stalled queue
- [x] first batch: **5 of 23 published**, halted by the runner's own five-consecutive-failure
      guard, $0.2624 of a $3 cap, DeepSeek only.
      `scripts/create-street-pages-local.ts` — `regen-058-local.ts` could not have done it, it
      skips any slug with no `StreetContent` row, which is all 249
- [x] **merged** as `8db80da` (branch head `dce1b70`, by SHA). Preview `miltonly-j6va7trjl`
      green, production battery `PASS · 11 checks · 449 pages · 97s`, `prisma migrate status` clean
- [ ] **THE PROGRAMME IS PAUSED.** The 18 failures are one systemic fault, not 18 bad streets:
      the prompt offers `differentPriorities` on inputs where `dropsDifferentPriorities(input)`
      is true, so the validator expects 2 sections and gets 3, through all 5 attempts with the
      retry feedback in front of it. Every one of the 249 candidates is this same thin-data
      shape, which is why the pass rate is 22%. **226 unattempted.** Fix the prompt first
- [ ] **the DB1 branch still has no entity floor**, and `/api/sync/generate` has no floor check
      at all — only `scripts/create-street-page.ts` enforces it

---

## Out of queue, 2026-09-10: the homepage, the header and the footer — **DONE**

Not a numbered item. Prompted directly in the `feat/homepage` worktree (`D:\miltonly-home`),
Gate A first, built after rulings, reviewed on preview by Aamir, merged.

Records: `scratchpad/reports/062-homepage-gate-a.md` (recon),
`063-homepage-build.md` (build), `064-homepage-figure-defects.md` (title/H1 + two figure fixes).

*Report numbering collided with the leads worktree, which used 062 and 063 on the same days.
Both sets are in the repo under different slugs. Numbers are no longer unique across worktrees.*

- [x] **THE MEGA MENU, DONE 2026-09-11 (MH-002, merged as `d01787f`, branch head `3ec8b51`, approved by Aamir).** The left rail is a tablist driving one live panel per item (Buy / Streets / Sell), every panel server-rendered from `src/lib/megaLive.ts`, gated in a browser at three widths; on a phone each item is a nested `<details>`. Record in `scratchpad/reports/MH-002-menu-v2.md`.
- [x] **The header emits crawlable links.** Three menus (Buy / Streets / Sell), every trigger a
      real `<a href>`, every panel server-rendered and closed with `hidden`. The popover is
      progressive enhancement; below 820px the same links are native `<details>` accordions.
      **Site-wide**: the page variant had no mega menu at all before.
- [x] **The footer is a live link graph** — every published hub, the in-demand streets, the
      tools — instead of three hubs and two streets.
- [x] **Five sections**: 01 streets on film, 02 newest on the market, 03 the neighbourhood
      ladder, 04 valuation with three live proof points, 05 the daily brief. THE BOARD
      unchanged. The TrustBand is retired.
- [x] **24 unique internal links -> 66** on the homepage (nav 0 -> 34, hubs 3 -> 22, street
      pages 2 -> 17); 302 visible words -> 1,146.
- [x] **Title and H1 set on the page**, not inherited: `Milton Homes for Sale, Street by Street`
      (39 chars, was an inherited 101) and `What Milton homes actually sell for, street by
      street`. Canonical for `/` is declared rather than inherited.
- [x] **A 10th battery check**, `scripts/verify/checks/homepage.mjs`. Link floor (stated, 50),
      header links present as anchors in served HTML, every neighbourhood figure equal to its
      DB2 record with suppression asserted both ways, every Milton-wide figure equal to its
      source query **by value and by format**, and WebSite + Organization + SearchAction parsed
      per node. The homepage had no automated coverage of any kind before this.
- [x] **`publishedStreetPageSlugs()`** is the one definition of the sitemap's street-page set.
      `sitemap.ts`, `/streets` and the homepage all read it and all say 444. Three surfaces had
      been counting three different sets under one word (444 / 445 / 738).
- [x] **`getNeighbourhoodCards()`** is the one source of a neighbourhood card. The homepage and
      `/neighbourhoods` both carry the hub's own k-gated typical sold price; the list-price
      average is gone.
- [x] **No price-drop section, and the two claims that faked one are deleted**:
      `listingsV2Data`'s `priceReduced` flag with its badge, and `stats.ts
      getFeaturedListings`, whose `priceDrops` returned the cheapest actives. A drop is not
      derivable — `lastPriceChangeAt` records that a price changed, never from what.
- [x] **Address to anchor**: `505 Farmstead Drive` -> `/streets/farmstead-drive-milton#505`,
      confirmed against the Town's 40,826-address projection; an unknown number degrades to
      the street page rather than linking an id that is not there.
- [x] **Daily-brief consent is sent but not persisted.** Closed by leads Phase 2. There is no
      generic path any more: `/api/leads` is deleted and the one ingest path persists
      `consentText` / `consentTimestamp` for every source, phone or no phone. Proven on preview,
      row `cmtvgsx5b0000dp8f0j217cxp`. Record in `scratchpad/reports/067-leads-phase2.md`.
- [ ] **`on-market` counts more than its label implies.** `buildMiltonWideContext` counts
      `permAdvertise AND status='active'` with no city and no transaction-type filter. Exactly
      right today (448 either way), so latent rather than wrong. Needs a decision.
- [ ] **380px is sized for, not visually verified.**

---

## Out of queue, 2026-09-11: the neighbourhood hub rebuild (MH-004), DONE

**Merged 2026-09-12 (MC-014) as `05bc914`, branch head `26af26b`, approved by Aamir, full gate exit 0.**

Not a numbered item. Prompted directly in the home worktree (`D:\miltonly-home`) on
`feat/hubs-v2`, per the rulings on report 065. Record in
`scratchpad/reports/MH-004-hub-rebuild.md` (preview URL, three hub URLs, head SHA, battery).
The branch stacks on `feat/menu-v2@3ec8b51`; merging its SHA lands the menu too.

- [x] **Static glance claims replaced with derived facts or dropped.** Typical with basis and
      count, streets with a page, streets filmed, schools inside the Town polygon, homes for
      sale today, dominant housing form as a share of sales. Each carries its basis under the
      figure and links to the rows behind it. `suits`, `commute`, `schools` prose is gone.
- [x] **The ladder is every published street** at the street page's own k-gated typical,
      "sample too small to publish" below k, sold count always. Pooled on `deriveIdentity`,
      graduated 12mo then full record, rounded the same way; the gate asserts the rendered
      strings equal the street page's, row by row (468 rows, 0 differ).
- [x] **Intent squares with real destinations**: the filtered feed, `/value/<slug>`,
      `/rentals`, `/sold?nbhd=<slug>`, two of them carrying live counts.
- [x] **Three rungs, video first**: the film strip (every filmed street in the hub), the
      ladder (marks filmed streets), the A-to-Z index.
- [x] **Guides linked up** (MC-003's block, kept).
- [x] **Nearest neighbourhoods by position**, distance printed, from the Town polygons.
- [x] **The hub gate**: `scripts/verify/checks/hub-page.mjs`, 18 assertions. Every figure
      declares source/format/tolerance, every link resolves (699 targets), ladder == published
      set, JSON-LD present and mirroring the ladder.
- [x] **The homepage footer's two redirecting links are replaced** (`/map`, `/book`).
- [ ] **Merge**, on Aamir's approval of the preview. Core merges the SHA.
- [ ] **The overflow page** `/neighbourhoods/<slug>/streets` is now a sorted duplicate of the
      hub's own ladder above the cap. Keep as the A-to-Z rung, or retire: Core's call.
- [ ] **`/rentals` takes no neighbourhood filter**, so "I'm renting" is Milton-wide.

---

## Out of queue, 2026-09-10: the guides tier and Market Watch — **DONE**

Not a numbered item. Prompted directly in the `feat/content` worktree
(`D:\miltonly-content`), Gate A first, then ten rulings, then build.
Records: `scratchpad/reports/062-content-gate-a.md` (recon),
`063-content-gate-a.md` (the volume measured), `064-content-build.md` (build).

Merged as **`f6bbc92`**, two parents. Production **`miltonly-kqtcnrve4`** serving it,
confirmed on the apex. Battery **`PASS · 10 checks · 444 pages · 67s`** at the full SHA.
Local gate on the merged tree: exit 0, zero `P2024`, **20/20 prebuild**, 548 static pages.

- [x] **The guides seam is filled.** `src/components/guides/types.ts` named
      `getGuidesIndexData()` and `getGuideArticle(slug)` and nothing implemented them.
      `/guides` and `/guides/[slug]` are live, in the sitemap, with breadcrumb, Article and
      FAQ JSON-LD. Dynamic on purpose: the figures are read live and an SSG guide would
      freeze them at build time
- [x] **Six guides, ordered by the brief's GSC evidence**: neighbourhood costs, how to read a
      sold price, is it a good time to sell, condo fees and parking, first home, schools.
      Template-authored structure, live k-gated figures, at most one generated paragraph
- [x] **`parking` is held.** The Town bylaw is not in this repo and a model would invent it.
      A tenure guide is also held: four live indexable pages already own that axis
- [x] **`MarketEdition` + `MarketEditionGeneration`**, migration
      `20260910120000_market_edition`. An edition is **immutable once published**; both routes
      render the stored row and recompute nothing
- [x] **The first edition**, `/market-watch/2026-08-31`: 40 sales against 43 the week before,
      typical $920,000, middle half $750,000 to $1,180,000, 76 days, 97.5% of asking, four
      housing forms over 28 days, 12 neighbourhoods, 32 streets with a page. `$0.0003`
- [x] **A Content-owned validator.** None of the four street rules extracts unchanged: each
      takes `StreetGeneratorInput` and reads `.aggregates`/`.nearby`, and `SUPERLATIVE_PHRASES`
      is module-private. `validateStreetGeneration.ts` is **not touched**.
      `src/lib/content/validateContentProse.ts` implements five rules against a minimal
      `GroundedFigures` interface. **20th prebuild test, 55 assertions, both directions on
      every rule, proven red on a weakened validator**
- [x] **The weekly window was wrong and is fixed.** `sold_date` is a calendar date stamped at
      **UTC midnight**, so a Toronto-midnight window dropped the whole Monday: the week of
      2026-08-31 read 18 where the day-by-day count is 40. A week now carries two named bases
      and each query uses the one matching its column. Reads 40 and 43, matching report 063
- [x] **The daily brief had the same defect (ML-002).** `src/lib/brief/compose.ts` bounded
      `sold_date` with the Toronto instants, so the 2026-09-09 edition read 3 sales where the
      day holds 8, and the 3 were the 10th's. `BriefWindow` now carries `dateStartUtc` and
      `dateEndExclusiveUtc` on the Market Watch pattern, the sold read uses them plus the
      `NOW()` bound, and a fixture-day prebuild case pins it. Dry run reads 8
- [x] **A page was publishing an absence that was not real.** `Listing.maintenanceFee` (Int)
      is 0 on all 73 active Milton condo listings while `maintenanceFeeAmt` (Float) carries
      the figure on all 73. The guide said no condo states a fee. 24 now render, each linked
- [x] **A raw TREB string reached prose** ("in 1032 - FO Ford").
      `src/lib/content/neighbourhoodName.ts` is the tier's single resolver; an unmapped string
      returns null and the clause is dropped, never a fallback to the feed
- [x] **`src/data/policyRate.ts`**, the only rate in this codebase: 2.25% observed 2026-09-08,
      BoC Valet V39079, rendered with its date, and the guide states a policy rate is not a
      mortgage rate
- [x] Verified on production: nine URLs 200, nine in the live sitemap, **zero em-dashes and
      zero raw TREB strings** across all seven content pages
- [ ] **Schools ship board, level and grades, NOT address or distance.** Neither exists:
      `schools.ts` has no street address, the school page's own `PostalAddress` carries
      locality only, and the lat/lng is a ±300 m neighbourhood centroid. Deliberate deviation
      from the ruling, stated on the page. Sourcing them is a separate decision
- [ ] **"Open this weekend" is not in v1.** Open houses are read live and expire; an edition is
      immutable. The live block belongs on the index page as its own piece of work
- [x] **The cron is wired, Monday 08:00 America/Toronto**, `0 12 * * 1` and `0 13 * * 1` with
      an hour guard of 8. **08:00 and not 06:00 because both firings must sit after the 11:00
      UTC sold sync in both offsets**; the old 10:00/11:00 pair ran before it in EDT and level
      with it in EST. Any change to the sold sync hour must move these two. Held on the merge:
      Vercel only invokes crons on production, so nothing fires until Core merges `feat/content`
- [x] **A published edition can be corrected once, and only with a note that renders on the
      page.** `generateEdition` throws on a published row unless `correctionNote` is passed;
      there is no `--force`. The note rides inside `sectionsJson`, no column and no migration.
      `publishedAt` is preserved on a rewrite and `dateModified` now reads `updatedAt`
- [x] **The 2026-08-31 edition is CORRECTED on production.** Run once, after Core reported the
      battery green at `31a9ab0`. 40 sales became 62, $920,000 became $975,000, 97.5% became
      97.3%, 76 days became 85; new listings held at 56, which is the proof the cause was DB2
      and not DB1. The stamp renders above every figure, `datePublished` is unmoved and
      `dateModified` carries the rewrite. **The correction is spent; do not run it again**
- [x] **192 For Sale and 53 For Lease rows with a future `sold_date`: CLOSED.** Core backfilled
      255 rows from `CloseDate` to the contract date, 0 future-dated of 8,578 remain. The
      `sold_date <= NOW()` bound on every DB2 window stays; it was never a workaround for this
- [ ] **17 streets crossed k5 and 9 crossed k10 in the backfill.** They can now publish a
      typical price they were suppressing, but only after regeneration, since those figures
      live in stored `StreetContent` prose. **Core's tier, Core's call.** Flagged, not actioned
- [ ] **Up-links from hubs and streets back to the current edition are Core's.** This worktree
      does not make those writes, and without them the archive sits instead of compounding
- [ ] **192 For Sale and 53 For Lease rows carry a future `sold_date`**, furthest 2027-01-29.
      A Core data bug, logged not fixed. Every Content window is bounded, so nothing in this
      tier publishes them
