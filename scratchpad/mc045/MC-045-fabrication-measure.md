# MC-045

CORE · D:\miltonly · main

**The fabrication is corpus-wide, and it is mostly build-era.**

- **Class 1, build-era:** **521 of the 707 served street pages** that carry generated text (74%), in **1,173 sentences**.
- **Class 2, compass or position:** plainly **WRONG on 56 pages** (60 claims), plus 107 more that point well off the claimed direction.
- **Class 3, self-contradiction:** **38 pages**, almost all in FAQ answers (which are also JSON-LD).
- **Overlap:** 543 pages carry at least one class, and 67 carry more than one. Together they hold **63% of street clicks and 67% of impressions** over 28 days.
- **Hubs and condos share the defect**, hubs worst: 17 of 22 hubs, mostly in the hero and JSON-LD.

Measured only. Nothing on production was changed, regenerated or unpublished. Every count below is reproducible from `scratchpad/mc045/method/`, and every flagged sentence is listed in `scratchpad/mc045/out/`.

1. **What was read: the served HTML, not the stored text.**
   - **Crawl:** all 719 sitemap street pages, fetched at 19:42Z on build `5f8cdb0`, 719 × 200 (560 prerendered, 126 stale, 33 hit).
   - **Validity checks:** no published row changed after the build. The 126 stale pages were fetched again and their generated text and data were identical.
   - **The three generated surfaces a reader sees:**
     - the profile, after the render-time numeric strip;
     - the FAQ, where the visible copy equals JSON-LD FAQPage on 719 of 719 pages;
     - the hero subtitle, which equals JSON-LD `Place.description`; the meta description is a template lead plus a truncated tail of it.
   - Template and data strings are never counted as claims.
   - **Unit of count:** one unique sentence per page, split with the repo's own splitter, tagged with every surface it appears on.
   - 707 pages carry generated text. 24 minimal and 17 placeholder pages carry little or none.
2. **Class 1, build-era claims (ungrounded by construction; the premise was verified).**
   - **The premise:** the generator input has no year or era field, and builder, style and lot fields are absent from all 663 stored inputs. The prompts ask for era framing anyway:
     - `01-system-prompt.md:136` ("established with mature trees");
     - `03-evaluative-prompt.md:147-150`;
     - the FAQ bank's "Is {street} new construction or established?" (`validateStreetGeneration.ts:2409`), which is never withdrawn.
   - **Count:** **521 pages, 1,173 sentences** (lexicon v2, `class1.mjs`).
     - Where they appear: profile 749, FAQ 405, hero 148, JSON-LD 149, the truncated meta on 16 pages.
     - 74 sentences are about somewhere else (other streets offered as alternatives).
   - **Precision: 89.9%.**
     - Two independent labellers per sentence: a 120-row stride sample of v1, which gave 89.2% (95% CI 82.3–93.6), and all 113 rows v2 added, which gave 96.5%.
     - 80.9% are about this street or its own area.
   - **Recall: 84.1%** (CI 73.7–90.9), from a fresh 40-page sample read end to end. At page level the sweep caught 28 of 30 pages.
     - Estimated true total: 1,173 × 0.899 / 0.841 ≈ **1,250 sentences**.
   - **The FAQ's share:**
     - It holds 405 of the 1,173 sentences (34.5%), and is the only carrier on 73 pages.
     - The build-era question is served on **179 pages**; **168 answers say "established"** (146 outright, 22 after admitting there is no build data), 5 only disclaim, 1 says new, 5 other.
     - Most repeated sentence: "The surrounding area has been built out for some time." (7 pages).
   - Files: `class1-sentences.csv`, `class1-faq-question.csv`.
3. **Class 2, compass and position claims, grounded in Town geometry.**
   - **Reference:** downtown is **Main St E × Martin St, 43.513465, −79.882820**. It is a vertex shared by both roads in the Town road layer, 325 m from Town Hall and 69 m from the Old Milton polygon centre.
   - **Tolerance: a 700 m margin.** It covers every other defensible downtown point, the farthest being Main × Bronte at 690 m, so no verdict depends on that choice.
   - **The test** (`class2-verdict.mjs`):
     - **What counts:** a claim is WRONG only if **every vertex** of the street's Town centreline (or of the named neighbourhood's Town polygon) lies at least 700 m on the opposite side.
     - **Both frames:** it must fail in the true frame and in the Town grid frame, which is rotated about 45°.
     - **Whole-town claims** ("west Milton") must also fail against the urban centroid, 43.512202, −79.858943, which is 1.93 km east of downtown.
     - **"North of \<road\>":** tested against that road's polyline, with a 100 m band.
     - **"Close to downtown":** WRONG beyond 2 km; "central" must be beyond 2 km from both points.
   - **Parsing:** 768 candidate sentences on 526 pages; two independent agents parsed each into subject, relation, direction and anchor, and only claims both agreed on were judged.
   - **Result: 380 pages carry a checkable claim, and 56 pages are WRONG (60 claims).**
     - Every WRONG reading went to two skeptics: 53 of 56 confirmed, 3 dropped. All 7 one-parser WRONG claims were confirmed by a tie-breaker.
     - By test: 32 whole-town, 21 relative to downtown, 7 relative to a road.
     - By surface: profile 49 pages, hero 33, JSON-LD 36, meta 2.
     - A further **107 pages are MISPLACED**: the claim points outside ±45° of where the street is, but not across the line.
   - **Sensitivity** (pages WRONG, before the reading check): 98 at a 0 m margin, 82 at 350, 54 at 700, 47 at 1,000, 41 at 1,500 (both frames); 102 with the true frame alone.
   - **Worst by distance error:**
     - `grey-landing` "the northern part of town": 2.67 km on the wrong side.
     - `norris-circle` "this far west": 2.49 km.
     - `muskoka-heights` "the town's western half": 2.29 km.
     - `watson-terrace` "the western edge of the town's built-up area": 2.22 km.
     - `manitou-way` "a west-end address": 2.14 km.
     - Ten Harrison streets say "north of the older grid/core" in the hero and JSON-LD; even Harrison's northernmost polygon vertex is 1.95 km south of downtown.
   - **Left out, not objectively checkable:**
     - the escarpment (159 claims; there is no geometry in the repo);
     - "the commercial spine" (83);
     - edge or outskirts of town (12; no urban boundary polygon exists);
     - between, bordering, orientation, and the rail line.
   - The candidate net's recall was 83.7% on the fresh sample. No miss was a compass claim; one was a centrality claim ("the settled middle of Milton"), and the rest were the forms left out above.
   - Files: `class2-wrong-verified.csv`, `class2-all-claims.csv`, `class2-summary.json`.
4. **Class 3, self-contradiction: 38 pages.**
   - **Method:** agents read all 707 pages (claim fields against the page's own FAQ and data island, positive evidence only, scopes matched); 148 findings, two skeptics each. Result: 42 confirmed, 32 split, 74 refuted.
   - **In generated fields: 39 findings on 37 pages,** plus `thomas-street` from the deterministic pass.
   - **Where:** FAQ/JSON-LD 34, hero/`Place.description` 4, meta tail 1.
   - **Types:**
     - an exclusivity claim against the page's own records (9), e.g. `schreyer-crescent` "every recorded sale … a detached home" while a townhouse is listed live on the page;
     - counts, ratios or "no type breakdown" claims against the page's own tiles (12), e.g. `bessborough-drive` "detached homes dominate" against 5 detached and 5 semi sales;
     - "no recent sales" against a displayed sale (6);
     - housing type (3), and rent or price against a displayed figure (3);
     - "loop" against a Cul-de-sac fact (`kennedy-circle`), and the wrong neighbourhood (2);
     - hero against FAQ: `labine-point` (northwest against eastern) and `parent-place` (mature against newer).
   - **The Jempson pattern** (the hero's housing mix refuted by the FAQ) occurs on **0** of the served 719.
   - **Template, not fabrication:** 3 template meta leads promise "current listings" while 0 are active.
   - File: `class3-confirmed.csv`, with every finding and its votes in `class3-all-findings.json`.
5. **Overlap and traffic weight** (GSC `sc-domain:miltonly.com`, 28 days to 2026-09-22, joined on the path across apex and www).
   - All published streets: 101 clicks, 5,796 impressions.
   - **Any class: 543 pages, 64 clicks, 3,872 impressions.**
     - Class 1: 58 clicks, 3,681 impressions.
     - Class 2 WRONG: 6 clicks, 328 impressions.
     - Class 3: 4 clicks, 394 impressions.
   - **More than one class: 67 pages.** Class 1+2 on 36, 1+3 on 26, all three on 5.
   - **Counting only traffic since each page's current text was generated:** 41 clicks and 2,099 impressions on affected pages. Most pages were regenerated inside the window.
   - **Heaviest affected pages:**
     - `dent-terrace` 4 clicks / 85 impressions (class 1);
     - `hobbs-crescent` 4/41 (1);
     - `holdsworth-crescent` 3/44 (1);
     - `etheridge-avenue` 2/143 (1, misplaced);
     - `fourth-line` 2/20 (class 2 WRONG);
     - `nairn-circle` 1/93 (1+3).
   - **The 11-click page, `zilio-terrace`, carries none of the three.** It is a minimal page with no generated text.
   - 87 unpublished street paths hold 10 clicks and are not attributed to any page.
   - File: `pages.csv`, per page.
6. **Hubs and condos share the defect.**
   - **Why:** neither pipeline strips anything at render, their validators check only numbers, and the inputs carry no era or position. `CondoBuilding.yearBuilt` is null on 65 of 65. The hub prompts ask for "north/south/established/newer-growth" framing (`hub/urban/01-opening-identity.md:14-16`).
   - **Hubs:**
     - Class 1: **17 of 22 hubs**, 148 sentences, precision 100% (CI 97.5–100). 16 carry it in the hero and JSON-LD. Timberlea's hand-written meta says "established central pocket".
     - Class 2: 2 WRONG. Dempsey "close to the town's core" (nearest vertex 2.06 km) and Harrison "central" (2.19 km); both readings confirmed, both borderline.
   - **Condos:**
     - Class 1: **40 of 56** model-written pages, 79 sentences, precision 89.9%, 18 in the hero.
     - Class 2: 0 WRONG and 5 MISPLACED: Cobban, Beaty and Clarke buildings called "western", which lie east or north-east.
     - All 59 condo pages serve JSON-LD `geo` 0,0.
   - Class 3 was not run on hubs or condos.
7. **Where to challenge the method.**
   - **Class 1:** the lexicon's reach, about 16% of claims missed. Estimate the true count, or read the page-level figure.
   - **Class 2:** the 700 m margin and the two-frame rule are deliberately conservative; the sensitivity table shows what they cost.
   - **Class 3:** it rests on agent readers plus two skeptics, so **38 pages is a floor**. The first recall pass found 7 on 40 pages; 2 fall outside the method (a profile section, and "short" against a length). The corpus pass raised 4 of the other 5 (3 confirmed, 1 split) and missed `stoutt-crescent`.
   - **Traffic:** clicks are sparse, so impressions are the steadier weight.
8. **Also fixed, reported separately:** the CRLF `loadEnvLocal` (2 of 83 assignments became 83 of 83) and a latent defect in MC-040's ignore test that fails every branch preview.
   - It is held for the next batch on `fix/env-loader-crlf @ 4cf16e4`; preview `miltonly-iay9zu9eo` is READY.
   - Details: `scratchpad/mc045/MC-045-env-loader-fix.md`.
9. **A credential exposure, on me.**
   - While locating the GSC key, a shell check I wrote mis-branched and printed the `ih-gsc-reader@homesly-490018` service-account private key into this session's transcript.
   - It is in no file, commit or report.
   - **Rotate that key.** It is read-only (webmasters.readonly), but it should be treated as exposed.

Report: scratchpad/mc045/MC-045-fabrication-measure.md
