# 056 — Second upload run, and pages for the orphaned clips

2026-09-05. Approved by Aamir.

## Part A: 8 staged rows

The staging pass regenerated `manifest.json` (45 rows, 37 published, 8 staged) and in doing
so overwrote the rebuild from run 1, reverting `builtAt` to 2026-09-03. All 8 staged rows
carried `blur_verified: true`; **zero refusals**.

### The plan, 8 rows

```
slug                       var   clip bytes  poster  captured   StreetContent
beam-court-milton          day      6726326   67986  2026-09-02 MISSING
chee-chee-landing-milton   day      5779565   68710  2026-09-02 MISSING
chretien-street-milton     day      9759151   93958  2026-09-02 exists (published)
hinton-terrace-milton      day      5277837   80516  2026-09-02 exists (published)
little-crescent-milton     day      4390235   15356  2026-09-04 exists (published)
mccuaig-drive-milton       day      5804255   11908  2026-09-04 exists (published)
parent-place-milton        day      5544736   58760  2026-09-02 exists (published)
scott-boulevard-milton     day     11299157   45748  2026-09-02 exists (published)

8 rows, 55024204 bytes (52.5 MiB). Present 6, missing 2.
```

### The run

A TLS drop killed the first attempt again; the HEAD-size idempotency held and the resume
finished. That is the fourth time this bucket has dropped a connection mid-run.

- 6 uploaded new, `parent-place` **replaced** both objects and both pointers, `chretien-street`
  replaced its poster and wrote a new `day.mp4`.
- 6 `StreetContent` rows pointed at the new clip; `beam-court` and `chee-chee-landing` had no
  row yet.

### chretien-street, re-keyed back to day

The 2026-09-02 capture is a 15:41 daytime run superseding the 20:19 night capture, so the
street goes back the way it came. `meta.supersedes_captured_at` records the one it replaces.

Null the pointer first, then delete, for the same reason as the forward re-key. The script
refuses unless `day.mp4` is in the bucket **and** `videoUrl` already points at it: deleting a
street's only clip because an upload silently failed is the one outcome worth guarding
against.

```
day object   : 9759151B
night object : 2976783B  -> deleted
nightVideoUrl / nightCapturedAt -> NULL
```

`staged/` emptied to `published/` (45), `manifest.json` rebuilt from the directories.

## Part B: pages for the orphaned clips

13 candidates: the 11 from run 1 plus `beam-court` and `chee-chee-landing`.

### Four could not be generated, and three of those are slug defects

| slug | entity | registry | `getStreetStats` | why |
|---|---|---|---|---|
| `1st-line-milton` | no | no | null | registry says **`first-line-milton`** ("FIRST LINE"), which is **already published** |
| `bronte-street-south-milton` | no | no | null | registry has **`bronte-street-milton`**, **already published**; `identity.ts` states N and S are one street |
| `lower-base-line-west-milton` | no | no | null | registry has **`lower-base-line-milton`**, entity exists, no page yet |
| `louis-st-laurent-avenue-milton` | yes | yes | **null** | correct slug and entity, but no data in any of the six gate sources. Same shape as `burnhamthorpe-road-milton` |

**The first three are a staging-pass slug defect, not a data absence.** Their clips are in R2
under keys no page will ever reference. I did not generate pages at those slugs: the publish
floor is entity plus registry, and both are absent, so a page there would be exactly the
`wood-close-n-a-milton` class of defect the floor exists to prevent.

I also did not re-key them onto the correct slugs. Which street a clip depicts is a claim
about the world, and "bronte-street-south" may be the south end of Bronte Street or may be a
different street the ingest mislabelled. That needs someone who saw the footage, not me.

**Recommended:** re-stage those three under `first-line`, `bronte-street` and
`lower-base-line`, confirming the footage matches, then re-run the upload. `lower-base-line`
would also need a page.

### Nine generated, on `phase41_v2` against production data

| street | attempts | cost | judge | words |
|---|---|---|---|---|
| `attenborough-terrace-milton` | 2 | $0.006 | PASS | 879 |
| `beam-court-milton` | 1 | $0.004 | PASS | 1053 |
| `chee-chee-landing-milton` | 4 | $0.009 | PASS | 852 |
| `dalhousie-gate-milton` | 5 | $0.008 | PASS | 940 |
| `gosford-crescent-milton` | 2 | $0.007 | PASS | 805 |
| `haxton-heights-milton` | 2 | $0.006 | PASS | 991 |
| `miller-way-milton` | 1, then 3 after the fix | $0.004 + $0.009 | PASS | 888 |
| `timmer-place-milton` | 1 | $0.004 | PASS | 954 |
| `tock-close-milton` | 1 | $0.004 | PASS | 1060 |

**Total generation cost: $0.061.**

All nine are `kAnonLevel: "thin"`, so DEC-ZERO-CONTEXT did not apply; each has a real
`neighbourhoodComparable` from the per-type lookup.

### THE STOP: a fabricated rent range on the thin tier

The first audit found 4 apparently ungrounded figures. Two were an **audit and validator
parsing gap** and two were a **real fabrication**, and they had to be separated before
either could be fixed.

**The fabrication.** `miller-way-milton` states "Homes in Clarke typically rent in the range
of $3,000 to $3,500 per month". Its payload:

```
aggregates : {"salesCount":1,"leasesCount":2,"typicalPrice":null,"priceRange":null,"kAnonLevel":"thin"}
leaseActivity : null
collectInputRents() : []
```

No rent of any kind, anywhere. `kAnonLevel` is `"thin"`, not `"zero"`, so neither
DEC-GROUNDING-ZERO arm looked, and `numeric_ungrounded` is market-scoped while this sat in
the FAQ. **This is the gap recorded as HANDOFF open item 4**, and it produced a fabricated
figure on a page about to be published.

Not isolated and not pre-existing-and-contained: it is the same structural hole one tier
up. I held `miller-way` as draft, purged it, and fixed the rule before continuing.

**The parsing gap.** `$1.05 million` was extracted as `$1.05` and parsed as **one dollar and
five cents**, so a grounded figure (Ford's typical is $1,050,152) looked ungrounded. In the
market section that is a false rejection; outside it, nothing looked at all. Both arms had
to be fixed together: extending to the thin tier without the parser fix would have rejected
every honest "$1.05 million" and produced a retry storm.

**A control character in the source.** My first attempt at the parser fix wrote a literal
backspace (`0x08`) into the regex where `\b` was intended, because a Python escape ran before
the file was written. The regex silently matched nothing. `SyntaxWarning: invalid escape
sequence` in the tool output was the signal and I read past it twice. Repaired, and the
whole of `src/` and `scripts/` swept for other control characters: none.

**The fix.** The second arm now covers `kAnonLevel !== "full"` rather than `=== "zero"`, and
the extractor and parser understand a spelled magnitude. `scripts/test-grounding-zero.ts`
grew to **30 assertions**, including the fabricated rent verbatim, the grounded
"$1.1 million" that must pass, and the two parser cases.

On regeneration the rule fired on `$2,500`/`$3,000` twice and the model dropped the claim on
the third attempt. Working as designed: the retry budget did the work.

### Final audit: 0 ungrounded across all nine

54 dollar figures, every one traced to a named input field. `audit-figure-grounding.ts` exits
0.

## Wiring, and the state at the end

`scripts/wire-video-from-published.ts` is new: it sets the video columns from
`D:/dashcam/published` for streets whose clip is in R2 but whose row did not exist when the
upload ran. The upload script can only write to a row that exists, so a slug uploaded before
its page was generated has assets and nothing pointing at them. That was 11 slugs after run 1
and 2 after run 2.

```
wired: 9   already correct: 32   no StreetContent row: 4
```

All nine revalidated on production and confirmed serving:

```
attenborough-terrace-milton    http=200 mp4=1 poster=1 VideoObject=1
beam-court-milton              http=200 mp4=1 poster=1 VideoObject=1
chee-chee-landing-milton       http=200 mp4=1 poster=1 VideoObject=1
dalhousie-gate-milton          http=200 mp4=1 poster=1 VideoObject=1
gosford-crescent-milton        http=200 mp4=1 poster=1 VideoObject=1
haxton-heights-milton          http=200 mp4=1 poster=1 VideoObject=1
miller-way-milton              http=200 mp4=1 poster=1 VideoObject=1
timmer-place-milton            http=200 mp4=1 poster=1 VideoObject=1
tock-close-milton              http=200 mp4=1 poster=1 VideoObject=1
```

| | |
|---|---|
| **sitemap** | **434 -> 443**, all nine present |
| published `StreetContent` | 444 (443 in the sitemap; `15-side-road-side-road-milton` is still floored) |
| R2 | **90 objects, 270,160,576 bytes (257.6 MiB)** |
| rows carrying a clip | **41** — 39 day, 2 night; 39 published, 2 draft |
| generation cost | **$0.061** |
