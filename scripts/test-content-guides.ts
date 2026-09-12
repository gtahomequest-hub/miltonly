// The two source-grounded guides pass the content validator, both directions. Prebuild test.
//
// WHY THIS EXISTS. /guides/parking-in-milton is built from the Town's fetched pages and
// /guides/milton-go-train-to-toronto from a stored GTFS feed. Neither carries a generated
// paragraph, so nothing runs the content validator over them at request time. This test
// builds both without a database, walks every string that reaches the page (title, dek,
// takeaways, paragraphs, tips, cited sentences, table captions, heads and cells, FAQ
// questions and answers) and runs validateContentProse against the guide's own figure bundle.
// A number that is not in the fact list, a proper noun that is not in the entity list, a
// superlative, or an em-dash fails the build.
//
// It also asserts the provenance contract the task set: every cited sentence carries an
// https URL and a read date written as "11 September 2026", every FAQ carries a source, every
// parking takeaway names its URL and date, and every GO figure sentence names the feed
// version. And it proves the gate can fail: a weakened bundle and a planted sentence must
// each produce a violation, or the green above means nothing.

import { GUIDE_DEFS } from "../src/lib/guides/guides";
import { buildParking } from "../src/lib/guides/parking";
import { buildGoTrain } from "../src/lib/guides/goTransit";
import { validateContentProse } from "../src/lib/content/validateContentProse";
import type { GroundedFigures } from "../src/lib/content/groundedFigures";
import type { GuideArticleData } from "../src/components/guides/types";
import { GO_GTFS_MILTON } from "../src/data/sources/goGtfsMilton";
import { PARKING_FETCHED_ON, PARKING_SOURCES } from "../src/data/sources/miltonParking";

const failures: string[] = [];
let assertions = 0;
function check(cond: boolean, msg: string) {
  assertions++;
  if (!cond) failures.push(`  ${msg}`);
}

const DATE_RE = /^\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;

// A fixed hub map so the builders do not touch Prisma. Slugs are the ones the polygon map
// can produce for the pilot parks and the station; names are what the page would render.
const HUBS = new Map(
  ["timberlea", "dorset-park", "clarke", "dempsey", "old-milton", "beaty", "coates", "cobban", "ford", "willmott", "harrison", "scott", "bronte-meadows"].map((slug) => [
    slug,
    { slug, name: slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") },
  ]),
);

/** Every string a reader can see on the article. */
function surfaces(d: GuideArticleData): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = [
    { where: "title", text: d.title },
    { where: "dek", text: d.dek },
    ...d.takeaways.map((t, i) => ({ where: `takeaway ${i}`, text: t })),
  ];
  d.sections.forEach((s, i) => {
    out.push({ where: `s${i} heading`, text: s.heading });
    s.paragraphs.forEach((p, j) => out.push({ where: `s${i} p${j}`, text: p }));
    if (s.tip) out.push({ where: `s${i} tip`, text: s.tip });
    (s.cited ?? []).forEach((c, j) => out.push({ where: `s${i} cited ${j}`, text: c.text }));
    if (s.table) {
      out.push({ where: `s${i} table caption`, text: s.table.caption });
      s.table.head.forEach((h, j) => out.push({ where: `s${i} table head ${j}`, text: h }));
      s.table.rows.forEach((r, j) => r.forEach((cell, k) => out.push({ where: `s${i} table r${j}c${k}`, text: cell })));
    }
  });
  d.faqs.forEach((f, i) => {
    out.push({ where: `faq ${i} q`, text: f.question });
    out.push({ where: `faq ${i} a`, text: f.answer });
  });
  return out;
}

function validateAll(slug: string, d: GuideArticleData, g: GroundedFigures) {
  let n = 0;
  for (const s of surfaces(d)) {
    const r = validateContentProse(s.text, g);
    n++;
    check(!/\.\.\s*$/.test(s.text), `${slug} · ${s.where} ends with a double period`);
    for (const v of r.violations) {
      failures.push(`  ${slug} · ${s.where} · ${v.rule}: ${v.detail}\n      "${v.excerpt}"`);
    }
    assertions++;
  }
  return n;
}

function provenance(slug: string, d: GuideArticleData) {
  for (const [i, s] of d.sections.entries()) {
    for (const [j, c] of (s.cited ?? []).entries()) {
      check(/^https:\/\//.test(c.source.url), `${slug} s${i} cited ${j}: source url is not https (${c.source.url})`);
      check(DATE_RE.test(c.source.fetchedOn), `${slug} s${i} cited ${j}: fetchedOn "${c.source.fetchedOn}" is not a written date`);
      check(c.source.label.length > 0, `${slug} s${i} cited ${j}: empty source label`);
      check(c.text.trim().length > 0, `${slug} s${i} cited ${j}: empty text`);
    }
    if (s.table) {
      check(!!s.table.source, `${slug} s${i}: table has no source`);
      check(s.table.rows.every((r) => r.length === s.table!.head.length), `${slug} s${i}: table rows do not match the head`);
    }
  }
  for (const [i, f] of d.faqs.entries()) {
    check(!!f.source && /^https:\/\//.test(f.source.url), `${slug} faq ${i}: no https source`);
    check(!!f.source && DATE_RE.test(f.source.fetchedOn), `${slug} faq ${i}: fetchedOn is not a written date`);
  }
  check(d.takeaways.length >= 3, `${slug}: fewer than three takeaways`);
}

async function main() {
  const parkingDef = GUIDE_DEFS.find((g) => g.slug === "parking-in-milton")!;
  const goDef = GUIDE_DEFS.find((g) => g.slug === "milton-go-train-to-toronto")!;
  check(!!parkingDef, "parking-in-milton is in GUIDE_DEFS");
  check(!!goDef, "milton-go-train-to-toronto is in GUIDE_DEFS");

  const parking = await buildParking(parkingDef, { hubs: HUBS });
  const go = await buildGoTrain(goDef, { hubs: HUBS });

  // ── the validator, over every surface ───────────────────────────────────
  const nP = validateAll("parking", parking.data, parking.figures);
  const nG = validateAll("go", go.data, go.figures);

  // ── provenance ──────────────────────────────────────────────────────────
  provenance("parking", parking.data);
  provenance("go", go.data);

  // Parking: every section except Sources carries cited rules; every cited source is one of
  // the seven fetched pages; every takeaway names a milton.ca URL and the read date; the
  // Sources section links all seven URLs.
  const urls = new Set(Object.values(PARKING_SOURCES).map((s) => s.url));
  for (const [i, s] of parking.data.sections.entries()) {
    if (s.heading === "Sources") {
      check(urls.size === 7 && Array.from(urls).every((u) => (s.links ?? []).some((l) => l.href === u)), "parking Sources section links all seven Town URLs");
      continue;
    }
    check((s.cited ?? []).length > 0, `parking s${i} "${s.heading}" has no cited sentence`);
    for (const c of s.cited ?? []) check(urls.has(c.source.url), `parking s${i}: cited URL ${c.source.url} is not a fetched page`);
  }
  for (const [i, t] of parking.data.takeaways.entries()) {
    check(t.includes(`read ${PARKING_FETCHED_ON}`), `parking takeaway ${i} does not carry the read date`);
    check(/www\.milton\.ca\/en\//.test(t), `parking takeaway ${i} does not name its milton.ca URL`);
  }
  check(parking.data.sections.some((s) => (s.links ?? []).some((l) => l.href.startsWith("/neighbourhoods/"))), "parking links down to at least one hub");
  check(parking.data.sections.some((s) => (s.links ?? []).some((l) => l.href.includes("gtechna.com"))), "parking links to the ticket portal");
  check(!!parking.data.sections.find((s) => s.table)?.table && parking.data.sections.find((s) => s.table)!.table!.rows.length === 13, "parking survey table has 13 rows");

  // GO: every cited source is the feed, named by version; the validity dates render; the
  // weekday table has as many rows as the feed has weekday trains; hubs near the station
  // are linked, nearest first, and the station's own hub is named in prose.
  const feed = GO_GTFS_MILTON.feed;
  const goText = surfaces(go.data).map((s) => s.text).join("\n");
  for (const [i, s] of go.data.sections.entries()) {
    for (const c of s.cited ?? []) check(c.source.label.includes(feed.version), `go s${i}: cited source does not name feed ${feed.version}`);
    if (s.table) check(s.table.source!.label.includes(feed.version), `go s${i}: table source does not name the feed`);
  }
  check(goText.includes(feed.version), "go page carries the feed version");
  check(goText.includes("10 September 2026") && goText.includes("27 November 2026"), "go page carries the feed validity dates");
  const wkTable = go.data.sections[0].table!;
  check(wkTable.rows.length === GO_GTFS_MILTON.weekday.trainsToUnion.n, `go weekday table has ${wkTable.rows.length} rows, feed has ${GO_GTFS_MILTON.weekday.trainsToUnion.n}`);
  check(wkTable.rows[0][0] === "6:00 a.m." && wkTable.rows[0][1] === "7:03 a.m.", `go first train renders as 6:00 a.m. to 7:03 a.m., got ${wkTable.rows[0].join(" / ")}`);
  check(goText.includes("12:25 a.m. (after midnight)"), "go renders a post-midnight bus as after midnight");
  const near = go.data.sections.find((s) => s.heading === "Living near the station")!;
  check((near.links ?? []).length >= 3 && near.links![0].href === "/neighbourhoods/timberlea", `go links hubs nearest first (got ${(near.links ?? []).map((l) => l.href).join(", ")})`);
  check(near.paragraphs[0].includes("Timberlea"), "go names the station's hub in prose");
  check(!go.data.sections.some((s) => (s.cited ?? []).some((c) => /\b\d{1,2}:\d{2}\b(?! [ap]\.m\.)/.test(c.text))), "go never renders a raw 24-hour GTFS time");

  // ── the gate can fail ───────────────────────────────────────────────────
  // 1. A parking sentence against a bundle missing the 50-metre fact: ungrounded_number.
  const weakened: GroundedFigures = { ...parking.figures, figures: parking.figures.figures.filter((f) => f.key !== "boulevard.intersectionMetres") };
  const boulevard = parking.data.sections[1].cited!.find((c) => c.text.includes("50 metres"))!.text;
  check(validateContentProse(boulevard, weakened).violations.some((v) => v.rule === "ungrounded_number"), "weakened parking bundle: the 50-metre sentence is caught");
  check(validateContentProse(boulevard, parking.figures).ok, "full parking bundle: the 50-metre sentence passes");
  // 2. A planted place on the GO page: invented_entity.
  const planted = "The 21 also calls at Hornby Junction on the way to Union.";
  check(validateContentProse(planted, go.figures).violations.some((v) => v.rule === "invented_entity"), "planted place on the GO page is caught");
  // 3. A superlative and an em-dash: caught on either bundle.
  check(validateContentProse("Milton GO is the best station on the line — by far.", go.figures).violations.length >= 2, "superlative and em-dash are caught");
  // 4. A fabricated departure count: ungrounded_number.
  check(!validateContentProse("There are 14 weekday trains to Union.", go.figures).ok, "a fabricated train count is caught");

  console.log(`content-guides: ${nP + nG} surfaces validated (${nP} parking, ${nG} go), ${assertions} assertions`);
  if (failures.length) {
    console.error(`FAIL ${failures.length}:\n${failures.join("\n")}`);
    process.exit(1);
  }
  console.log("content-guides: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
