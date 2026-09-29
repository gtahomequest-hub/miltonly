# MC-050

CORE · D:\miltonly · main

**Production serves `a75feeb` (`miltonly-atfzfypb2`, built in 3 min). One production build. Production battery: `PASS · 24 checks · 719 pages · 559s`, `a75feeb served == expected`.** Four branches merged by SHA with no conflicts. MH-009 was already on main. The eight canonicals are report-only; the proposal is in section 4. Working files are in `scratchpad/mc050/`.

## 1. The merges

| order | task | SHA merged | merge commit | what it brought |
|---|---|---|---|---|
| 1 | MA-011 | `3c8add8` (feat/audit) | `6eb1ef6` | `scripts/audit/*` and one workflow step; nothing under `src/` |
| 2 | MH-010 | `12dc3f72e7582b649feddb2584d798ddfe33c419` (feat/home-voice) | `96a606c` | em-dashes out of the bio sentence, the condo cost notes and 29 non-street titles and metas; `.pl-badge` |
| 3 | ML-014 | `af0da549f539b18a7eab99964024a138486b8524` (feat/leads) | `30dd588` | `/book`, the lead ingress's ref rule (`src/lib/lead/refPath.ts`), seven retired sources, the `path` prop on `PlaceDetail` |
| 4 | MP-007 | `cd2eed1` (feat/portal) | `a75feeb` | the VOW at the PropTx standard: the reviewer path, the hard throttle, the erasure marker, terms v5, `/admin/vow` |

- **MH-009 `7cfa4a2` was not merged:** `git merge-base --is-ancestor 7cfa4a2 main` succeeds. It went in as `f1d4080` in MC-038.
- **MP-007 was in this batch** because its report was in before I started. It was merged last, after the order you gave.
- **Conflicts: none.** Git merged `src/app/mosques/[slug]/page.tsx` (MH-010 and ML-014) and `saved`, `signin` and `sold` pages (MH-010 and MP-007) cleanly. ML-014 touched `src/lib/lead` and `src/components/places`, with no conflict in either.
- **MP-007's migration** `20260927120000_portal_vow_reviewer_throttle_erasure` was already applied: `prisma migrate status` reports 33 migrations and "Database schema is up to date!".
- **MP-007 adds 7 em-dashes, all in `//` code comments.** None renders.

## 2. The gate, the preview and the deploy

- **Local gate:** `pnpm build` exit **0**, with the fetch cache cleared first. `vow-best-practices` passed with 304 assertions and `vow-fields` with 111.
- **Local battery** against `next start` at `a75feeb`: `PASS · 24 checks · 719 pages · 391s`.
- **One preview:** `miltonly-i7f9g7a3u`, Ready.
- **Production:** pushed `a75feeb` to `main` at 04:06:35Z. `miltonly-atfzfypb2` is Ready, built at 2026-09-29T04:07:17Z in 3 min. `npx vercel ls --prod` lists it first.

## 3. Proofs on production

- **Battery:** `═══ PASS · 24 checks · 719 pages · 559s ═══`, `build a75feeb served == expected`, EXIT 0.
- **`curl -I https://miltonly.com/book`:** `HTTP/1.1 200 OK`.
- **`/listings/W13832806`:** 200. The bio sentence now reads "far more than price. It is about finding the right fit, the right protection, and the right outcome." with no dash.
  - The page still has one em-dash, which is not the bio. It is the nav's A–Z count for the letter X (`<span>—</span>`, `aria-label="X: no street pages"`). It appears on every page, and the nightly has carried it as S3 since at least 09-25. It belongs to the nav's owner.
- **Nightly against production** (`BASE=https://miltonly.com node scripts/audit/nightly/run.mjs --no-email`, with `AUDIT_DEPS` a lean `lighthouse@12` and `puppeteer-core@24`): **exit 0**.
  - Guards: "banned sentences **0 of 58** on the 56 stripped pages", positive controls 55 of 55, street head 0 findings on 64 pages, "www twins **20 of 20** answer 308 to the apex (enforced)".
  - There is **no npm script** for the nightly. `package.json` has none, and the workflow runs this same `node` command, so I ran that.
  - It found one S2: `/schools/bishop-pf-reding-catholic-secondary-school` is a 404, linked from `/listings`.
    - The real page is `/schools/bishop-pf-reding-catholic-ss`.
    - The wrong slug is at `src/lib/listingsV2Data.ts:73` and dates from `f44edde` (2026-06-12). It is isolated and pre-existing; this batch did not touch it.
  - The run counts "new 607" because a fresh `--out` folder has no earlier state to compare against. The committed nightly state was not touched.

## 4. The eight street pages Google canonicalised to www.747live.bet (report-only)

Sources: MA-011's URL Inspection output (`D:\miltonly-audit\scratchpad\ma011\index-coverage.*`), the database, and each page fetched from production today (`scratchpad/mc050/eight.json`, from `eight.mjs`).

**What each page serves today, and when it changed**

| street page | Google's crawl | today | its canonical | robots | body written (`generatedAt`) | `StreetContent` row created |
|---|---|---|---|---|---|---|
| 14-side-road | 09-05 03:03Z | full page, 200, 3,645 words | self | index, follow | 09-19 | 09-19 |
| bell-street | 09-03 23:42Z | full page, 200, 4,013 words | self | index, follow | 09-13 | 04-22 |
| cedric-terrace | 09-05 03:28Z | full page, 200, 3,931 words | self | index, follow | 09-11 | 09-11 |
| connaught-terrace | 07-24 23:33Z | full page, 200, 3,954 words | self | index, follow | 09-21 | 04-22 |
| lobelia-crescent | 09-02 12:23Z | full page, 200, 3,871 words | self | index, follow | 09-12 | 09-12 |
| lower-base-line | 09-02 12:25Z | full page, 200, 4,363 words | self | index, follow | 09-04 | 09-04 |
| rowe-terrace | 09-18 18:27Z | full page, 200, 3,949 words | self | index, follow | 09-13 | 04-22 |
| whetham-heights | 09-06 18:14Z | full page, 200, 3,961 words | self | index, follow | 09-13 | 04-22 |

- **None of the eight is a placeholder today.** Each has a published `StreetContent` row and a succeeded `StreetGeneration`. None contains "747live" anywhere in its HTML.
- **Head changes:** the street head (title and meta) last changed for all eight with MC-048's deploy on 2026-09-28. The sitemap's street `lastmod` is floored at that date.
- **Crawl timing:** Google crawled seven of the eight before their current body was written. Four of them had no `StreetContent` row at all when crawled. rowe-terrace is the exception: crawled 09-18, five days after its body was written.

**The one common thread: no canonical at crawl**

- **Of the 256 crawled street pages, 244 declared our canonical to Google and 12 did not.**
  - The 12 are these eight, `bronte-street` (a redirect error, June), and three pages Google crawled but did not index: `ruddy-crescent` (09-17), `urell-way` (09-22) and `sauble-court` (09-27).
  - All three now carry a self canonical and had a published row before their crawl. sauble-court's row dates from 09-19.
- **So the missing canonical was intermittent,** not a matter of pages that did not exist yet.
- **In today's code, one path emits no canonical:** `generateMetadata`'s `if (!data) return { title: "Street Not Found" }` in `src/app/streets/[slug]/page.tsx`. I can't show that this path is what Google got.
- **Today's head is clean.** As Googlebot, sauble-court's `<head>` holds only `meta`, `link`, `script` and `title` before the canonical, so the head does not break before it.
- **Street pages have carried `alternates.canonical` since April** (`1976381`, `052a5a4`).

**The gambling site's homepage** (one `curl`, headers kept in `747-home-headers.txt`, body not kept):

- 200, served by Cloudflare, `x-powered-by: Next.js`, 293 KB.
- Title: "747 Live | Sports Betting ,Casino Games, eSports and More - 747 Live".
- It carries its own canonical, `https://www.747live.bet/`.
- **It is a working casino site, not an empty shell. It does not mirror our content:** the words "Milton" and "miltonly" do not appear in it.
- Whether it serves anything at our street paths is untested, because the brief allowed one fetch.

**Proposal** (not done in this task):

1. **Do nothing page by page.** The eight now serve full pages with a self canonical, and MC-048's `lastmod` floor already asks Google to recrawl every street. No reindex requests, per MC-048's rule.
2. **Close the one canonical-less path.** Give `generateMetadata`'s `!data` branch `robots: { index: false, follow: true }`. Then a response with no data can never be indexable without a canonical. This is not a street title, meta or H1 change, so the MC-048 freeze does not block it. It still needs its own commit and a test.
3. **Audit:**
   - Re-inspect the eight weekly (8 calls of the 2,000 daily quota).
   - Make an off-domain `googleCanonical` on any inspected page an S1 in the morning report.
   - Add a nightly guard: every sampled street page's head carries its own canonical.
4. **If any of the eight still names www.747live.bet after 2026-10-26** (the same window as MC-048's re-read):
   - fetch 747live.bet at one of our street paths, to see whether it proxies us;
   - then file Search Console's spam report.

## 5. Open

- **MC-049's 12:00 UTC checks** are still open: 2026-09-29 12:00 UTC (not yet reached) and 2026-10-04 12:00 UTC.
- **The PropTx PDF (your message during this task):**
  - `docs/compliance/PROPTX_VOW_Best_Practices.pdf` has been tracked on `main` since MC-036 (`1cb431e`, 2026-09-21).
  - The copy you placed today is byte-identical to it (blob `c4258bb`), so there was nothing to commit.
  - I re-read items 10, 22 and 31; they still leave MC-047's two wording questions open:
    - **Item 31** says only "display copyright notices in favour of PropTx and update these notices as published by PropTx". It gives no text.
    - **Item 10** says only "branded only to that Member". It asks for no name, title or brokerage in a header.
  - MC-047's Step 0 is still on `core/mc047`, unmerged.

Report: scratchpad/reports/MC-050-merge-batch.md
