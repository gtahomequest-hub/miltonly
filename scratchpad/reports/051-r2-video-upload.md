# QUEUE item 2, upload phase

Branch `feat/r2-video-upload` @ `fef75e0`, pushed, **not merged**. Preview `miltonly-9k72wspkw`, battery **PASS · 9 checks · 428 pages · 72s**, exit 0.

## 1. Recon

| what | where |
|---|---|
| old upload script (Vercel Blob) | `scripts/upload-street-videos.ts` |
| poster derivation | `src/lib/streetVideo.ts` `deriveVideoPoster()` |
| video columns | `StreetContent.videoUrl`, `videoCapturedAt`, `nightVideoUrl`, `nightCapturedAt` |
| poster column | **none** — the poster URL is derived from the video URL by convention |
| capture dates | `D:/dashcam/work/clips5/clips.csv`, encoded in the filename `<slug>_YYYYMMDD-HHMMSS.mp4` |

lemieux before this task:

```
videoUrl        https://exxriguxa8bampk4.public.blob.vercel-storage.com/street-videos/lemieux-court-milton.mp4
videoCapturedAt Thu Aug 27 2026 00:00:00 GMT-0400
nightVideoUrl   null
nightCapturedAt null
```

## 2. Two departures from the brief, both forced by what is actually on disk

**Poster is `.webp`, not `.jpg`.** Every staged poster in `D:/dashcam/work/posters5` is a webp; there is not one jpg. Naming the key `poster.jpg` would have been a name that lied about the bytes, and browsers would have been served `image/webp` under a `.jpg` URL. Keys are:

```
streets/<slug>/day.mp4
streets/<slug>/poster.webp
```

**`deriveVideoPoster` had to change, because there is no poster column.** It previously swapped a trailing `.mp4` for `.webp`, which under the new layout would derive `day.webp` and 404. It now maps `/day.mp4` to `/poster.webp` first, and keeps the legacy `.mp4` to `.webp` arm so any row still holding a Blob URL does not silently lose its poster, and with it the `VideoObject` that Google requires a thumbnail for.

## 3. A capture-date bug I introduced and caught

The first run wrote **2026-08-26** for `frost-court`, whose clip is `frost-court_20260825-201913.mp4`.

The filename timestamp is local. I parsed it as a local instant and stored it; `videoCapturedAt` renders **in UTC** (`streetVideo.ts`: *"Captured 27 August 2026" from *CapturedAt (UTC, no leading zero)*). Every evening capture therefore displayed a day late.

Seven of the nine are evening or late-afternoon captures, so seven of nine would have been wrong. Fixed by storing **UTC midnight of the shot date**: the claim being made is a calendar date, so it stores a calendar date. All nine were rewritten on the corrected re-run.

## 4. Upload results

18 objects, all served. `Content-Type` and `Cache-Control: public, max-age=31536000, immutable` verified on lemieux; mp4s answer Range requests (206), which is what seeking needs.

| slug | mp4 bytes | poster bytes | mp4 | poster | capturedAt | row |
|---|---:|---:|---|---|---|---|
| lemieux-court | 7,543,263 | 57,590 | 206 | 200 | 2026-08-27 | set |
| frost-court | 6,264,706 | 83,950 | 206 | 200 | 2026-08-25 | set |
| mulroney-heights | 1,960,520 | 82,766 | 206 | 200 | 2026-08-27 | set |
| locker-place | 4,377,561 | 57,562 | 206 | 200 | 2026-08-27 | set |
| shade-lane | 1,969,799 | 57,078 | 206 | 200 | 2026-08-30 | set |
| clifford-point | 4,277,635 | 65,692 | 206 | 200 | 2026-08-25 | **no row** |
| chretien-street | 2,976,783 | 68,836 | 206 | 200 | 2026-08-25 | **no row** |
| heaven-crescent | 3,061,086 | 48,850 | 206 | 200 | 2026-08-30 | **no row** |
| tasker-court | 4,498,743 | 41,520 | 206 | 200 | 2026-08-30 | **no row** |

URLs are `https://pub-7975a00b72d94caba9def0c4b5e9c388.r2.dev/streets/<slug>-milton/{day.mp4,poster.webp}`.

**Idempotence proven in the wild.** A transient TLS error (`sslv3 alert bad record mac`) killed the first full run after five streets. The re-run skipped all five on the HEAD size check and uploaded only the remaining four, then a third run skipped all nine.

### Four of the nine have no page to attach video to

`clifford-point`, `chretien-street`, `heaven-crescent` and `tasker-court` have a `ResidentialStreet` entity but **no `StreetContent` row**, so the `UPDATE` matched nothing and they are not in the sitemap. Their clips and posters are in R2 and ready; there is simply nowhere to show them yet.

Generating content for four streets is an LLM run with its own gate, and squarely outside an upload task, so I did not start it. **Item 2's "Done when" cannot be met until those four have pages.**

## 5. Verified on the preview

```
<video class="s-video-el" controls playsInline preload="metadata"
       poster="https://pub-...r2.dev/streets/lemieux-court-milton/poster.webp">
src="https://pub-...r2.dev/streets/lemieux-court-milton/day.mp4"
```

All five wired pages carry 9 `r2.dev` references each (video `src`, `poster`, and the JSON-LD `contentUrl`/`thumbnailUrl`), with `src` and `poster` both correct.

`pnpm build` **exit 0**, 9 prebuild tests, no prerender failures. Battery on the preview: **PASS · 9 checks · 428 pages · 72s**, `build fef75e0 served == expected`.

## 6. The Blob object is still there, deliberately

Production currently serves a **cached render that still points at the Blob URL** (`X-Vercel-Cache: HIT`), because the DB write happened outside `generateStreetContent` and so did not trip the DEC-REGEN-REVALIDATE purge. The street page is `revalidate = 3600`, so it self-heals to the R2 URL within an hour of the write.

Deleting the Blob object now would break the live lemieux page for up to that hour: broken video and broken poster for anyone who lands on the cached copy. So it is held. The safe order is: merge, confirm production serves the R2 URL, then delete.

**`/api/revalidate` cannot help, because it is dead code.** It compares `secret` against `process.env.REVALIDATION_SECRET`, and that variable is set neither in `.env.local` nor in any Vercel environment, so every request 401s and always has.
