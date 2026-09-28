// scripts/content/strip-compass.mjs — MC-048 step 1: remove MC-045's WRONG compass sentences.
//
//   npx tsx --tsconfig tsconfig.test.json --require ./scripts/_server-only-shim.cjs scripts/content/strip-compass.mjs --dry-run
//   npx tsx --tsconfig tsconfig.test.json --require ./scripts/_server-only-shim.cjs scripts/content/strip-compass.mjs --apply
//
// INPUT. scratchpad/mc045/out/class2-wrong-verified.csv: 60 sentences on 56 pages, each a compass or
// position claim that every vertex of the street's Town geometry contradicts by 700 m or more, in
// both the true and the Town-grid frame, confirmed by two skeptics (MC-045).
//
// WHAT IT DOES, per sentence, by EXACT match of the CSV's `text` in the stored content:
//   - StreetGeneration.sectionsJson: the sentence is cut from its paragraph; the paragraph is tidied
//     (one space where the sentence was, no double spaces); a paragraph left empty is dropped.
//   - StreetContent.description: the generator writes it as the section paragraphs joined by a blank
//     line (DEC-PH41-DUALWRITE). Where that holds, it is rebuilt from the stripped sections, so the
//     two stay byte-identical; where the sentence lives only in the description (a needsReview row,
//     whose generation is not rendered), it is cut there, paragraph by paragraph, the same way.
//   - wordCounts / totalWords are recomputed with the generator's own formula for edited sections.
//   Nothing else changes: no FAQ, no heading, no other paragraph, no regeneration, no model call.
//
// IT REFUSES a page, and says why, when: the sentence is not found; it occurs more than once in a
// field; the match is not a whole sentence (a letter touches either end); or a section would be left
// with no paragraph.
//
// THE VALIDATORS. validateStreetGeneration(output, input) runs on the stored output before and after,
// with the generation's stored inputJson. The strip reports every violation the cut ADDS (a rule
// present after and not before); violations already present are the page's own and are counted.
//
// --apply WRITES, per page, in one transaction, guarded: the generation row only if generatedAt and
// sectionsJson are still what was read, the content row only if description still is. A regeneration
// that lands between the read and the write therefore rolls the page back instead of being overwritten.
// Then the invariant (CLAUDE.md): every StreetContent write revalidates its page, /streets and its hub,
// through /api/revalidate on production.
//
// OUTPUT. scratchpad/mc048/strip-report.md (before and after per page) and strip-report.json.
import fs from "node:fs";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*?)\r?$/);
    if (!m || process.env[m[1]] != null) continue;
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}
loadEnvLocal();

const APPLY = process.argv.includes("--apply");
const DRY = process.argv.includes("--dry-run");
if (APPLY === DRY) { console.error("pass exactly one of --dry-run or --apply"); process.exit(2); }
const CSV = "scratchpad/mc045/out/class2-wrong-verified.csv";
const BASE = process.env.MC048_BASE || "https://miltonly.com";

function parseCsv(t) {
  const rows = []; let f = "", row = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...b] = rows;
  return b.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, j) => [k, r[j]])));
}

/** Cut `s` from paragraph `p`. Returns { ok, text } where text "" means the paragraph is now empty. */
function cut(p, s) {
  const i = p.indexOf(s);
  if (i < 0) return { ok: false, why: "not found" };
  if (p.indexOf(s, i + 1) >= 0) return { ok: false, why: "occurs more than once" };
  const before = p.slice(0, i), after = p.slice(i + s.length);
  if (before && !/\s$/.test(before)) return { ok: false, why: `not a whole sentence (…${before.slice(-12)}|)` };
  if (after && !/^\s/.test(after)) return { ok: false, why: `not a whole sentence (|${after.slice(0, 12)}…)` };
  const joined = before.trim() && after.trim() ? `${before.trimEnd()} ${after.trimStart()}` : `${before}${after}`.trim();
  return { ok: true, text: joined.replace(/ {2,}/g, " ").trim() };
}
const words = (paras) => paras.join(" ").trim().split(/\s+/).filter(Boolean).length; // generateStreet.ts:499
const joinSections = (sections) => sections.map((s) => s.paragraphs.join("\n\n")).join("\n\n");

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { validateStreetGeneration } = await import("../../src/lib/ai/validateStreetGeneration");
  const { firstSentence } = await import("../../src/lib/prose/sentences");
  const prisma = new PrismaClient();
  const wrong = parseCsv(fs.readFileSync(CSV, "utf8"));
  const bySlug = new Map();
  for (const w of wrong) bySlug.set(w.slug, [...(bySlug.get(w.slug) || []), w]);

  const pages = [];
  for (const [slug, claims] of bySlug) {
    const content = await prisma.streetContent.findUnique({ where: { streetSlug: slug }, select: { description: true, needsReview: true, status: true, template: true, neighbourhood: true } });
    const gen = await prisma.streetGeneration.findUnique({ where: { streetSlug: slug }, select: { sectionsJson: true, faqJson: true, inputJson: true, wordCounts: true, totalWords: true, generatedAt: true } });
    const page = { slug, status: content?.status, template: content?.template, needsReview: content?.needsReview, claims: [], refused: null, changed: false };
    pages.push(page);
    if (!content) { page.refused = "no StreetContent row"; continue; }
    const sectionsBefore = Array.isArray(gen?.sectionsJson) ? gen.sectionsJson : null;
    const dualWrite = sectionsBefore ? content.description === joinSections(sectionsBefore) : false;
    let sections = sectionsBefore ? JSON.parse(JSON.stringify(sectionsBefore)) : null;
    let descParas = content.description.split("\n\n");
    const editedSections = new Set();

    for (const w of claims) {
      const c = { text: w.text, quote: w.quote, test: w.test, where: [], before: [], after: [], status: "cut" };
      page.claims.push(c);
      // Two claims can sit in one sentence (MC-045 parsed claims, not sentences): the sentence is cut once.
      const earlier = page.claims.find((x) => x !== c && x.text === c.text);
      if (earlier) { c.status = "same sentence as an earlier claim, cut once"; c.where = [...earlier.where]; continue; }
      // the generation
      if (sections) {
        for (const s of sections) {
          for (let pi = 0; pi < s.paragraphs.length; pi++) {
            if (!s.paragraphs[pi].includes(w.text)) continue;
            const r = cut(s.paragraphs[pi], w.text);
            if (!r.ok) { page.refused = `${s.id} p${pi}: ${r.why}`; break; }
            c.where.push(`StreetGeneration.sections[${s.id}].p${pi}`);
            c.before.push(s.paragraphs[pi]); c.after.push(r.text || "(paragraph removed: it held only this sentence)");
            if (r.text) s.paragraphs[pi] = r.text; else s.paragraphs.splice(pi, 1);
            editedSections.add(s.id);
            if (s.paragraphs.length === 0) page.refused = `section ${s.id} would be left with no paragraph`;
            break;
          }
          if (page.refused) break;
        }
      }
      // the description, on its own when it is not the dual-written join
      if (!dualWrite || !c.where.length) {
        for (let pi = 0; pi < descParas.length; pi++) {
          if (!descParas[pi].includes(w.text)) continue;
          const r = cut(descParas[pi], w.text);
          if (!r.ok) { page.refused = `description p${pi}: ${r.why}`; break; }
          c.where.push(`StreetContent.description.p${pi}`);
          if (!c.before.length) { c.before.push(descParas[pi]); c.after.push(r.text || "(paragraph removed: it held only this sentence)"); }
          if (r.text) descParas[pi] = r.text; else descParas.splice(pi, 1);
          break;
        }
      }
      if (!c.where.length) { c.status = "not found in stored content"; }
      if (page.refused) break;
    }
    if (page.refused) continue;
    const cutCount = page.claims.filter((c) => c.status === "cut").length;
    if (!cutCount) continue;

    const newDescription = dualWrite && sections ? joinSections(sections) : descParas.join("\n\n");
    if (dualWrite && sections) {
      // the join must equal the description with the same cuts made directly: the dual write holds
      let check = content.description.split("\n\n");
      for (const c of page.claims.filter((x) => x.status === "cut")) {
        const pi = check.findIndex((p) => p.includes(c.text));
        const r = cut(check[pi], c.text);
        if (r.text) check[pi] = r.text; else check.splice(pi, 1);
      }
      if (check.join("\n\n") !== newDescription) { page.refused = "the rebuilt description differs from the description cut directly"; continue; }
      c_markDesc(page);
    }
    page.changed = true;
    page.dualWrite = dualWrite;
    page.descriptionBefore = content.description;
    page.descriptionAfter = newDescription;
    page.heroBefore = firstSentence(content.description);
    page.heroAfter = firstSentence(newDescription);
    page.charsRemoved = content.description.length - newDescription.length;
    if (sections) {
      const wc = { ...(gen.wordCounts || {}) };
      for (const id of editedSections) wc[id] = words(sections.find((s) => s.id === id).paragraphs);
      page.wordCounts = wc;
      page.totalWords = Object.values(wc).reduce((a, n) => a + n, 0);
      page.totalWordsBefore = gen.totalWords;
      page.editedSections = [...editedSections];
      // the validators, before and after, on the stored input
      if (gen.inputJson && Array.isArray(gen.faqJson)) {
        const key = (v) => `${v.rule}`;
        const vb = validateStreetGeneration({ sections: sectionsBefore, faq: gen.faqJson }, gen.inputJson);
        const va = validateStreetGeneration({ sections, faq: gen.faqJson }, gen.inputJson);
        const beforeRules = new Map(); for (const v of vb) beforeRules.set(key(v), (beforeRules.get(key(v)) || 0) + 1);
        const added = []; const seen = new Map();
        for (const v of va) { const k = key(v); seen.set(k, (seen.get(k) || 0) + 1); if (seen.get(k) > (beforeRules.get(k) || 0)) added.push(v); }
        page.validator = { before: vb.length, after: va.length, beforeHard: vb.filter((v) => v.severity === "hard").length, afterHard: va.filter((v) => v.severity === "hard").length, added: added.map((v) => ({ rule: v.rule, severity: v.severity, excerpt: String(v.excerpt || "").slice(0, 140) })) };
      } else page.validator = { skipped: gen.inputJson ? "no FAQ array" : "no stored inputJson" };
    } else page.validator = { skipped: "no generation row; the description is the only rendered prose" };
    page._write = { sections: editedSections.size ? sections : null, wordCounts: page.wordCounts, totalWords: page.totalWords, readGeneratedAt: gen?.generatedAt ?? null, readSections: sectionsBefore, readDescription: content.description, newDescription, neighbourhood: content.neighbourhood };
  }
  function c_markDesc(page) { for (const c of page.claims) if (c.status === "cut" && !c.where.some((w) => w.startsWith("StreetContent"))) c.where.push("StreetContent.description (rebuilt from the sections)"); }

  // ── apply ──────────────────────────────────────────────────────────────────────────────────
  const revalidated = [];
  if (APPLY) {
    const hubPaths = new Set();
    for (const page of pages.filter((p) => p.changed)) {
      const w = page._write;
      try {
        await prisma.$transaction(async (tx) => {
          if (w.sections) {
            const g = await tx.streetGeneration.updateMany({
              where: { streetSlug: page.slug, generatedAt: w.readGeneratedAt },
              data: { sectionsJson: w.sections, wordCounts: w.wordCounts, totalWords: w.totalWords },
            });
            if (g.count !== 1) throw new Error("the generation row changed since it was read");
            const now = await tx.streetGeneration.findUnique({ where: { streetSlug: page.slug }, select: { sectionsJson: true } });
            if (JSON.stringify(now.sectionsJson) !== JSON.stringify(w.sections)) throw new Error("the generation row did not take the write");
          }
          const c = await tx.streetContent.updateMany({ where: { streetSlug: page.slug, description: w.readDescription }, data: { description: w.newDescription } });
          if (c.count !== 1) throw new Error("the content row changed since it was read");
        });
        page.applied = true;
      } catch (e) {
        page.applied = false; page.applyError = e.message;
        continue;
      }
      if (w.neighbourhood) {
        const hub = await prisma.neighbourhood.findFirst({ where: { rawStrings: { has: w.neighbourhood }, isHub: true }, select: { slug: true } }).catch(() => null);
        if (hub) { hubPaths.add(`/neighbourhoods/${hub.slug}`); page.hub = `/neighbourhoods/${hub.slug}`; }
      }
    }
    const paths = [...pages.filter((p) => p.applied).map((p) => `/streets/${p.slug}`), "/streets", ...hubPaths];
    for (const path of paths) {
      try {
        const r = await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(process.env.REVALIDATION_SECRET || "")}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) });
        revalidated.push({ path, status: r.status });
      } catch (e) { revalidated.push({ path, status: `error ${e.message}` }); }
    }
  }
  await prisma.$disconnect();

  // ── report ─────────────────────────────────────────────────────────────────────────────────
  const changed = pages.filter((p) => p.changed);
  const cutClaims = changed.flatMap((p) => p.claims.filter((c) => c.status === "cut"));
  const notFound = pages.flatMap((p) => p.claims.filter((c) => c.status.startsWith("not found")).map((c) => ({ slug: p.slug, text: c.text, status: c.status })));
  const sameSentence = pages.flatMap((p) => p.claims.filter((c) => c.status.startsWith("same sentence")).map((c) => ({ slug: p.slug, quote: c.quote })));
  const refused = pages.filter((p) => p.refused);
  const added = changed.filter((p) => p.validator?.added?.length);
  const summary = {
    mode: APPLY ? "apply" : "dry-run", at: new Date().toISOString(), csv: CSV,
    csvSentences: wrong.length, csvPages: bySlug.size,
    pagesChanged: changed.length, sentencesCut: cutClaims.length, claimsSharingACutSentence: sameSentence, notFound, refused: refused.map((p) => ({ slug: p.slug, why: p.refused })),
    validator: { pagesRun: changed.filter((p) => p.validator && !p.validator.skipped).length, skipped: changed.filter((p) => p.validator?.skipped).map((p) => ({ slug: p.slug, why: p.validator.skipped })), pagesWithAddedViolations: added.map((p) => ({ slug: p.slug, added: p.validator.added })) },
    applied: APPLY ? { ok: pages.filter((p) => p.applied).length, failed: pages.filter((p) => p.applied === false).map((p) => ({ slug: p.slug, why: p.applyError })) } : null,
    revalidated,
  };
  fs.mkdirSync("scratchpad/mc048", { recursive: true });
  fs.writeFileSync(`scratchpad/mc048/strip-report${APPLY ? "" : "-dry-run"}.json`, JSON.stringify({ summary, pages: pages.map(({ _write, descriptionBefore, descriptionAfter, ...p }) => p) }, null, 1));

  const L = [];
  L.push(`# MC-048 strip report (${summary.mode})`, "");
  L.push(`${summary.at}. Input \`${CSV}\`: ${wrong.length} sentences on ${bySlug.size} pages. Exact match in the stored street content.`, "");
  L.push(`- **Pages changed:** ${changed.length}. **Sentences cut:** ${cutClaims.length}.`);
  L.push(`- **Claims that shared a sentence already cut:** ${sameSentence.length}${sameSentence.length ? ": " + sameSentence.map((x) => `\`${x.slug}\` (\"${x.quote}\")`).join(", ") : ""}.`);
  L.push(`- **Not found in stored content:** ${notFound.length}${notFound.length ? ": " + notFound.map((n) => `\`${n.slug}\``).join(", ") : ""}.`);
  L.push(`- **Refused:** ${refused.length}${refused.length ? ": " + refused.map((p) => `\`${p.slug}\` (${p.refused})`).join("; ") : ""}.`);
  L.push(`- **Validators** (\`validateStreetGeneration\`, stored input, before and after): run on ${summary.validator.pagesRun} pages; violations the cut ADDED: ${added.length ? added.map((p) => `\`${p.slug}\` ${p.validator.added.map((a) => `${a.rule} (${a.severity})`).join(", ")}`).join("; ") : "none"}.${summary.validator.skipped.length ? ` Skipped: ${summary.validator.skipped.map((s) => `\`${s.slug}\` (${s.why})`).join("; ")}.` : ""}`);
  if (APPLY) {
    L.push(`- **Written:** ${summary.applied.ok} pages${summary.applied.failed.length ? `; failed ${summary.applied.failed.map((f) => `\`${f.slug}\` (${f.why})`).join("; ")}` : ""}.`);
    const bad = revalidated.filter((r) => r.status !== 200);
    L.push(`- **Revalidated** on ${BASE}: ${revalidated.length} paths (${revalidated.filter((r) => r.status === 200).length} answered 200${bad.length ? `; not 200: ${bad.map((b) => `${b.path} ${b.status}`).join(", ")}` : ""}).`);
  }
  L.push("");
  for (const p of pages) {
    L.push(`## ${p.slug}`, "");
    L.push(`${p.status}/${p.template}${p.needsReview ? ", needsReview (the generation is not rendered)" : ""}${p.refused ? `. **REFUSED: ${p.refused}**` : ""}${p.changed ? `. ${p.charsRemoved} characters removed; hero sentence ${p.heroBefore === p.heroAfter ? "unchanged" : "changed"}.` : ""}`, "");
    for (const c of p.claims) {
      L.push(`- **${c.status}** (${c.test}, "${c.quote}"): ${c.where.join(", ") || "nowhere"}`);
      for (let i = 0; i < c.before.length; i++) {
        L.push(`  - before: ${c.before[i]}`);
        L.push(`  - after: ${c.after[i]}`);
      }
    }
    if (p.changed && p.heroBefore !== p.heroAfter) { L.push(`- hero, before: ${p.heroBefore}`); L.push(`- hero, after: ${p.heroAfter}`); }
    if (p.validator && !p.validator.skipped) L.push(`- validators: ${p.validator.before} violations before (${p.validator.beforeHard} hard), ${p.validator.after} after (${p.validator.afterHard} hard); added by the cut: ${p.validator.added.length ? p.validator.added.map((a) => `${a.rule} (${a.severity}): ${a.excerpt}`).join("; ") : "none"}`);
    else if (p.validator) L.push(`- validators: skipped (${p.validator.skipped})`);
    if (p.wordCounts) L.push(`- words: ${p.totalWordsBefore} → ${p.totalWords} (sections ${p.editedSections.join(", ")})`);
    if (APPLY) L.push(`- written: ${p.applied === true ? "yes" : p.applied === false ? `NO (${p.applyError})` : "no change"}${p.hub ? `; hub ${p.hub}` : ""}`);
    L.push("");
  }
  fs.writeFileSync(`scratchpad/mc048/strip-report${APPLY ? "" : "-dry-run"}.md`, L.join("\n"));
  console.log(`[strip-compass] ${summary.mode}: ${changed.length} pages, ${cutClaims.length} sentences cut, ${notFound.length} not found, ${refused.length} refused, ${added.length} pages with validator violations added${APPLY ? `; written ${summary.applied.ok}, failed ${summary.applied.failed.length}; revalidated ${revalidated.filter((r) => r.status === 200).length}/${revalidated.length}` : ""}`);
  if (APPLY && (summary.applied.failed.length || revalidated.some((r) => r.status !== 200))) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
