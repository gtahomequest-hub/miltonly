# Queue

Five items, in order. **The builder never reorders this list and never self-starts an item.** Each begins only on an explicit prompt, and is marked done in the same commit that rewrites `HANDOFF.md`.

Status: all five **not started**.

---

## 1. Naming close-out and hygiene

Close the gap DEC-NAME-SOURCE left open and clear the debris around it. The create branch of the `StreetContent` upsert in `generateStreet.ts` writes `streetName` from `resolveStreetName` the way the update branch already does, and the prebuild guard is rewritten to assert **both** upsert branches rather than merely that the file imports the resolver. Repair `gifford-crescent-milton`'s stored name, which the cron wrote as `Gifford Cres` on 2026-09-03. Wire `revalidatePath` on every successful `StreetContent` write, covering the street page, `/streets`, and the street's hub. Run recon on `parkway-drive-milton`: report which token trips the `superlative` validator on 20 of 20 attempts, then fix it and regenerate. Resolve `burnhamthorpe-road-milton`, whose `getStreetStats()` returns null because all five activity sources are empty. Finally, pin the package manager: add `"packageManager": "pnpm@..."` to `package.json`, delete `package-lock.json`, and `corepack enable`.

**Done when** the battery reports 9/9 on production, `parkway-drive` and `burnhamthorpe-road` are both regenerated clean, and no npm lockfile remains in the repo.

---

## 2. Video hosting on Cloudflare R2

Move street video off Vercel Blob and onto R2. Repoint the upload script at R2 with idempotent pathnames so a re-run cannot create duplicates, migrate `lemieux-court` off Blob, upload the eight other staged clips, and set `videoUrl` on all nine streets.

**Done when** nine street pages serve their video from the R2 host and the Vercel Blob object is deleted.

---

## 3. Address anchors

Add `/streets/[slug]#[houseNumber]` sections to street pages. **Gate A recon first**, with no code until the map is approved. An anchor shows position on the street, the cross street, building form, and active listing status. It never shows a sold price for a single address, which the VOW rules forbid.

**Done when** Gate A is approved. Build scope is set at that point, not before.

---

## 4. Condo building names

Route the street component of every `CondoBuilding` address through `resolveStreetName`, preserving the house number, so the naming authority covers condo surfaces as it already covers streets. Applies to the H1, the title, the meta description, the JSON-LD, and the breadcrumb.

**Done when** all 108 buildings render full street names and the name guard's coverage extends to condo surfaces.

---

## 5. Geometry backfill

Populate solar exposure, surface, lanes, sidewalk, maxspeed, length, and terminus onto all published streets from the Town and OSM layers. No camera work, and nothing derived from imagery.

**Done when** those fields are populated for every street with an OSM match, and rendered wherever the page design calls for them.
