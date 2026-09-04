# Handoff

_Last rewritten 2026-09-05._

## READ THIS FIRST

Two things need a decision, neither is a bug to fix:

1. **Seven clips are live in R2 with `blur_verified: false`**, all from the 2026-09-03 run.
2. **Three clips are staged under slugs that do not exist**, so their R2 objects can never be
   referenced by a page. Which street a clip depicts is a claim about the world, so I did not
   re-map them.

Detail in `scratchpad/reports/056-upload-run-2-and-pages.md`.

## Where things stand

| | |
|---|---|
| `main` | see `git log`; the last code change is the thin-tier grounding fix |
| production | serving `main`, confirmed via `/api/build` |
| battery | `PASS · 9 checks · 434 pages`, exit 0, on production at `EXPECT_SHA=d032f13`. **Not re-run since the sitemap moved to 443** |
| local build | exit 0, zero `P2024`, **12/12 prebuild** |
| published street pages | **443** (was 434) |
| published `StreetContent` | 444; `15-side-road-side-road-milton` is floored out of the sitemap |
| R2 | **90 objects, 257.6 MiB** |
| rows carrying a clip | **41** — 39 day, 2 night; 39 published, 2 draft |
| dashcam pipeline | `staged/` empty, `published/` 45, manifest rebuilt |
| QUEUE | 1, 2 (extended twice) done; 3 **Gate A reported, awaiting approval**; 4, 5 not started |

## What shipped 2026-09-05

**Second upload run, 8 staged rows, all `blur_verified: true`, zero refusals.** 6 new,
`parent-place` replaced, `chretien-street` re-keyed **back to day** because its 2026-09-02
15:41 capture supersedes the 20:19 night one. Null the pointer first, then delete; the script
refuses unless `day.mp4` is in the bucket and `videoUrl` already points at it. A TLS drop
killed the first attempt again, the fourth time for this bucket; the HEAD-size idempotency
held.

**Nine pages generated** for orphaned clips, `phase41_v2`, **$0.061 total**, all judge PASS,
all wired, published, revalidated and confirmed serving video, poster and `VideoObject` on
production: `attenborough-terrace`, `beam-court`, `chee-chee-landing`, `dalhousie-gate`,
`gosford-crescent`, `haxton-heights`, `miller-way`, `timmer-place`, `tock-close`.

**`scripts/wire-video-from-published.ts` is new.** The upload script can only write columns on
a row that exists, so a slug uploaded before its page was generated has assets in R2 and
nothing pointing at them. This closes that gap from `D:/dashcam/published` without
re-uploading a byte.

### The stop: a fabricated rent range on the thin tier

`miller-way-milton` stated "Homes in Clarke typically rent in the range of $3,000 to $3,500
per month" against a payload whose `collectInputRents()` is `[]`. `kAnonLevel` was `"thin"`,
not `"zero"`, so neither DEC-GROUNDING-ZERO arm looked, and `numeric_ungrounded` is
market-scoped while this sat in the FAQ. **That was open item 4 from yesterday, and it
produced a fabricated figure on a page about to publish.** Held as draft, fixed, regenerated.

Two fixes, which had to land together:

- The second arm now covers `kAnonLevel !== "full"`, not just `"zero"`.
- `$1.05 million` was extracted as `$1.05` and parsed as **one dollar five cents**, so a
  grounded figure looked ungrounded. Extending to thin without this would have rejected every
  honest spelled magnitude and produced a retry storm.

On regeneration the rule fired twice and the model dropped the claim on the third attempt.
Guard is now **30 assertions**. Final audit across all nine: **0 ungrounded**, 54 figures all
traced to a named input field.

**A control character got into the source.** My first attempt at the parser fix wrote a
literal backspace (`0x08`) where `\b` was intended, because a Python escape ran before the file
was written; the regex then matched nothing. `SyntaxWarning: invalid escape sequence` was the
signal and I read past it twice. Repaired, and `src/` and `scripts/` swept clean of control
characters. Worth remembering when patching regexes through a script rather than an editor.

## Four clips still have no page

| slug | why |
|---|---|
| `1st-line` | registry says `first-line-milton`, **already published**. Slug defect |
| `bronte-street-south` | registry has `bronte-street-milton`, **already published**; N and S are one street. Slug defect |
| `lower-base-line-west` | registry has `lower-base-line-milton`, entity exists, **no page yet**. Slug defect |
| `louis-st-laurent-avenue` | correct slug and entity, but **no data in any of the six gate sources**. Same shape as `burnhamthorpe-road-milton` |

The first three are a staging-pass slug defect, not a data absence, and their objects sit at
keys no page will reference. I did not generate pages at those slugs (the publish floor is
entity plus registry and both are absent) and did not re-map them onto the correct slugs,
because which street a clip depicts needs someone who saw the footage.

**Recommended:** re-stage those three under the registry slugs, confirming the footage, then
re-run the upload. `lower-base-line` would also need a page.

## Open items

1. **Seven live clips carry `blur_verified: false`** (`chretien-street`, `clifford-point`,
   `frost-court`, `heaven-crescent`, `mulroney-heights`, `shade-lane`, `tasker-court`). Note
   `chretien-street`'s **new** 2026-09-02 clip IS signed; the flag now refers to a capture no
   longer in the bucket, so the manifest row is stale in its favour. The other six are
   unchanged. Decision: verify or pull.
2. **Three mis-slugged clips**, above.
3. **Run the battery.** It has not run since the sitemap moved 434 to 443.
4. **`makeStreetDecision`'s minimum-data gate** still requires a DB1 listing, so the cron
   returns `skip_low_data` for the streets the sixth gate source admits. Manual generation
   works; automated refresh does not.
5. **The name guard has a blind spot**: it asserts a file *imports* the resolver, not that
   every consumer inside it uses the resolved value.
6. **Grounding is now enforced on zero and thin, dollars only.** Counts, percentages, days and
   quarter labels remain market-scoped on every tier. That is the next place this class of
   defect will surface.
7. `burnhamthorpe-road-milton` and `louis-st-laurent-avenue-milton` are entity-real with no
   data behind them.
8. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity guard.
9. Condo H1s still render abbreviations such as `Nadalin Hts`. QUEUE item 4.
10. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs. Cleanup.
11. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and
    `mcdougall-crossing-milton`.
12. `video.miltonly.com` still unattached. `r2.dev` is rate-limited and not intended for
    production traffic at volume, and the bucket is now 257.6 MiB across 39 live pages. This
    is the most load-bearing unresolved item after the blur question.
13. Two draft rows carry a clip: `diefenbaker-street-milton`, `murlock-heights-milton`.

## Next expected task

A decision on open items 1 or 2, or running the battery, or QUEUE item 3 build scope once
Gate A is approved. Do not self-start any of them.
