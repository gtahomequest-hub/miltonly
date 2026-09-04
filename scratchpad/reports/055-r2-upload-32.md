# 055 — Merge, then the 32-clip R2 upload run

2026-09-04. Approved by Aamir.

## Part A: the merge

| | |
|---|---|
| merge commit | `243cee5` `Merge branch 'fix/zero-sales-tier'` (no-ff) |
| production | `miltonly-740ffuny3`, Ready, `/api/build` confirms `243cee5` |
| battery | **PASS · 9 checks · 434 pages · 64s**, exit 0, `EXPECT_SHA=243cee5` against `https://miltonly.com` |

DEC-ZERO-SALES-TIER, DEC-GROUNDING-ZERO, DEC-ZERO-CONTEXT and the generator-entry
name resolution are all on `main`.

## Part B: the upload run

### THE FINDING THAT NEEDS A DECISION

**Seven clips are live in R2 and on production street pages with
`blur_verified: false`.**

| slug | key | captured | uploaded |
|---|---|---|---|
| `chretien-street` | `streets/chretien-street-milton/night.mp4` | 2026-08-25 | 2026-09-03 |
| `clifford-point` | `streets/clifford-point-milton/night.mp4` | 2026-08-25 | 2026-09-03 |
| `frost-court` | `streets/frost-court-milton/night.mp4` | 2026-08-25 | 2026-09-03 |
| `heaven-crescent` | `streets/heaven-crescent-milton/day.mp4` | 2026-08-30 | 2026-09-03 |
| `mulroney-heights` | `streets/mulroney-heights-milton/day.mp4` | 2026-08-27 | 2026-09-03 |
| `shade-lane` | `streets/shade-lane-milton/day.mp4` | 2026-08-30 | 2026-09-03 |
| `tasker-court` | `streets/tasker-court-milton/day.mp4` | 2026-08-30 | 2026-09-03 |

All 32 clips in this run carry `blur_verified: true` **and** a `blur_signed_at`
timestamp. None of the seven has one. The likely reading is that blur verification is a
process introduced with this staging pass and the 2026-09-03 uploads predate it, so
`false` means "never verified" rather than "verified and failed". **No unverified byte was
uploaded in this run** and the refusal gate reported zero refusals, because all 32
candidates were signed.

Three of the seven were re-keyed as instructed. Re-keying moves bytes that are already
public to a more accurate key; refusing would have left night footage labelled as day
without removing anything. Whether the seven should be live at all is a decision, not a
fix.

### 2. The script, repointed at the manifest

`scripts/upload-street-videos-r2.ts` used a hardcoded nine-slug list and a `clips.csv`
under `work/`, a scratch directory. It had no notion of blur verification, no day/night
distinction in the key, and no way to know a clip had already shipped.

It now reads `D:/dashcam/manifest.json` plus `staged/<slug>/meta.json`. Candidates are
rows with status `staged` **and** `blur_verified` true. `meta.json` is the per-clip
authority and the manifest an index over it: a disagreement on `night` is reported and
meta wins, because an upload keyed off a stale index is exactly how a night clip ships as
day.

**The manifest's `r2_key` omits the `-milton` suffix** (`streets/1st-line/night.mp4`).
Every one of the 18 objects already in the bucket carries it, and so does every
`StreetContent` slug. Following the manifest literally would have created a second,
orphaned copy of every asset beside the live one instead of replacing it. The scripts use
the live layout and write the real key back into `meta.json`. Four published rows whose
`meta.json` still carried the unsuffixed key were corrected at source and the manifest
rebuilt, so no row now disagrees with the bucket.

### The dry-run plan, 32 rows

0 refused. 21 map to a `StreetContent` row (19 published, 2 draft), 11 do not.
189.3 MiB of local bytes considered.

```
slug                            var    clip bytes  poster   captured   StreetContent
1st-line-milton                 night    11266521   63464   2026-08-25 MISSING
attenborough-terrace-milton     day      10371306   71612   2026-09-01 MISSING
beasley-terrace-milton          day       3307404   66142   2026-09-01 exists (published)
britannia-road-milton           day       7756431   41146   2026-08-29 exists (published)
bronte-street-south-milton      day       7120587   37422   2026-08-30 MISSING
cavanagh-lane-milton            day       9080966   62478   2026-09-01 exists (published)
childs-drive-milton             day       5904019   50728   2026-08-27 exists (published)
costigan-road-milton            day       8838405   60502   2026-08-27 exists (published)
dalhousie-gate-milton           day       3714184   85202   2026-09-01 MISSING
diefenbaker-street-milton       day       3317968   82956   2026-09-01 exists (draft)
duignan-crescent-milton         day       7195623   93044   2026-09-01 exists (published)
etheridge-avenue-milton         day       8773564   68292   2026-09-01 exists (published)
farmstead-drive-milton          day      11128914   26618   2026-08-27 exists (published)
gillett-point-milton            day       3288137   99526   2026-09-01 exists (published)
gosford-crescent-milton         day       2984311   66832   2026-09-01 MISSING
hamman-way-milton               day       4179032   59214   2026-09-01 exists (published)
haxton-heights-milton           day       2681675  124970   2026-09-01 MISSING
leger-way-milton                day       6404415   59650   2026-08-27 exists (published)
lemieux-court-milton            day       7382005   63044   2026-09-01 exists (published)
locker-place-milton             day       6285713   78608   2026-09-01 exists (published)
louis-st-laurent-avenue-milton  day       9097178   53530   2026-09-01 MISSING
lower-base-line-west-milton     night     6417527   74962   2026-08-25 MISSING
miller-way-milton               day       5146284   67712   2026-08-27 MISSING
murlock-heights-milton          day       3105668   79826   2026-09-01 exists (draft)
nadalin-heights-milton          day       3609088  113148   2026-09-01 exists (published)
nipissing-road-milton           day      11892914   53612   2026-08-27 exists (published)
parent-place-milton             day       5738063   78240   2026-09-01 exists (published)
pharo-point-milton              day       3027993   91762   2026-09-01 exists (published)
solomon-court-milton            day       6044602   66118   2026-09-01 exists (published)
timmer-place-milton             day       3532089   76172   2026-09-01 MISSING
tock-close-milton               day       3276940   77544   2026-09-01 MISSING
whitlock-avenue-milton          day       4413210   63518   2026-08-30 exists (published)
```

### 3. The run

**A TLS drop killed the first write run after ten streets**, the same class of failure as
2026-09-03 (`sslv3 alert bad record mac`). The HEAD-size idempotency held: the resume
skipped completed work and finished cleanly on the second attempt. That is the third time
this bucket has dropped a connection mid-run, and the reason the skip check exists.

- 32 clips and 32 posters written, `Cache-Control: public, max-age=31536000, immutable`.
- `lemieux-court` and `locker-place` **replaced** both objects and both pointers; their
  captures moved from 2026-08-27 to 2026-09-01.
- 21 `StreetContent` rows pointed at a clip: `videoUrl` for a day capture,
  `nightVideoUrl` for a night one, with the matching `capturedAt` at UTC midnight of the
  shot date.
- 11 slugs have no row, so no column was set for them.
- 21 street paths plus `/streets` revalidated on production, all 200.

### `deriveVideoPoster` rewrote `/day.mp4` only

Found while planning the re-key, and **verified live on production before the fix**:

```
frost-court-milton  poster.webp in page: 0
                    night.webp  in page: 1     <- a key that has never existed
                    VideoObject in page: 1     <- shipped with a 404 thumbnail
```

Worse than the failure I expected. A night URL fell through to the legacy Blob arm, which
rewrites any `.mp4` to `.webp`, so the derivation returned a non-null but wrong URL. The
required-trio check therefore passed and the VideoObject shipped with a broken thumbnail,
which looks valid to a crawler.

There is one `poster.webp` per street and both variants share it. That is now what the
function says. `scripts/test-video-poster.ts`, 11 assertions, verified **red** (4
failures, all `night.webp`) then green, wired in as the 12th prebuild test.

### 4. The three night re-keys

`chretien-street`, `clifford-point`, `frost-court`. All three have `meta.night: true` and
always did; the 2026-09-03 script had no night key, so it wrote them to `day.mp4` and to
`videoUrl`. The page printed a daylight framing over footage shot at 20:19.

Order is copy, repoint, delete. A delete before the repoint leaves a cached page pointing
at a key that is gone, and street pages cache for an hour. The copy is server-side within
the bucket and its size is checked against the source before anything is deleted.

```
chretien-street-milton   copied 2976783B -> night.mp4, pointer moved, day deleted
clifford-point-milton    copied 4277635B -> night.mp4, pointer moved, day deleted
frost-court-milton       copied 6264706B -> night.mp4, pointer moved, day deleted
```

`videoUrl` and `videoCapturedAt` nulled, `nightVideoUrl` and `nightCapturedAt` set, all
three revalidated 200, all three `meta.json` updated with `rekeyed_at`.

### Promotion and manifest rebuild

`scripts/promote-staged-clips.ts` verifies each slug against the bucket (clip and poster
present, sizes matching local) **before** moving it out of `staged/`. Promoting on the
strength of "the upload script said so" would have blessed the half-run the TLS drop
produced twice.

`manifest.json` is rebuilt **from the directories**, not edited in place.

```
staged/    32 -> 0
published/  9 -> 39
manifest   39 total, 39 published, 0 staged
           32 blur_verified true, 7 false (all pre-dating the blur pass)
           5 night, 34 day
           0 rows whose r2_key disagrees with the bucket
```

## 5. Verification

| | |
|---|---|
| bucket | **78 objects, 223,998,294 bytes (213.6 MiB)**, from 18 and 35.8 MiB |
| `StreetContent` rows carrying a clip | **28** (26 published, 2 draft): 25 day, 3 night |
| build | exit 0, 533 pages, zero `P2024`, **12/12 prebuild** |

Three spot-checked R2 URLs, Range request:

```
streets/frost-court-milton/night.mp4      206  video/mp4
streets/nadalin-heights-milton/day.mp4    206  video/mp4
streets/1st-line-milton/poster.webp       206  image/webp
streets/frost-court-milton/day.mp4        404   <- deleted by the re-key, as intended
```

### Uploaded and pointed at a page (21)

`beasley-terrace`, `britannia-road`, `cavanagh-lane`, `childs-drive`, `costigan-road`,
`diefenbaker-street` (draft), `duignan-crescent`, `etheridge-avenue`, `farmstead-drive`,
`gillett-point`, `hamman-way`, `leger-way`, `lemieux-court`, `locker-place`,
`murlock-heights` (draft), `nadalin-heights`, `nipissing-road`, `parent-place`,
`pharo-point`, `solomon-court`, `whitlock-avenue`.

### Uploaded with no `StreetContent` row (11) — generation candidates

`1st-line`, `attenborough-terrace`, `bronte-street-south`, `dalhousie-gate`,
`gosford-crescent`, `haxton-heights`, `louis-st-laurent-avenue`, `lower-base-line-west`,
`miller-way`, `timmer-place`, `tock-close`.

Their assets are in R2 and ready. Two of them are night-only, which is now a shape the
render layer supports.
