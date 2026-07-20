// scripts/export-batch.ts
// Export street pages to the external-audit batch format (miltonly-cowork).
// Content is taken through loadStreetGeneration — the SAME loader the page
// renderer uses, including the render-time compliance filter and the
// needsReview gate — so the exported file matches what actually publishes.
// Meta fields come from StreetContent (the deterministic streetMeta values).
//
// Run: npx tsx --tsconfig tsconfig.test.json scripts/export-batch.ts --out <dir> [--slugs-from-dir] [slug ...]
//   --out           target directory (created if missing)
//   --slugs-from-dir  derive the slug list from the *.md files already in --out
//   otherwise pass slugs as arguments.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

function loadEnvLocal(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(file, "utf-8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m && !process.env[m[1]]) {
          let v = m[2].replace(/\r$/, "");
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
          process.env[m[1]] = v;
        }
      }
    } catch {}
  }
}
loadEnvLocal();

import { prisma } from "../src/lib/prisma";
import { loadStreetGeneration } from "../src/lib/ai/loadStreetGeneration";

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  if (outIdx < 0 || !args[outIdx + 1]) {
    console.error("Usage: export-batch.ts --out <dir> [--slugs-from-dir] [slug ...]");
    process.exit(1);
  }
  const outDir = args[outIdx + 1];
  const fromDir = args.includes("--slugs-from-dir");

  let slugs: string[] = args.filter((a, i) => !a.startsWith("--") && i !== outIdx + 1);
  if (fromDir) {
    slugs = readdirSync(outDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => basename(f, ".md"));
  }
  if (slugs.length === 0) {
    console.error("No slugs to export.");
    process.exit(1);
  }
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log(`Exporting ${slugs.length} pages to ${outDir}`);
  let ok = 0;
  let failed = 0;

  for (const slug of slugs.sort()) {
    const [gen, genRow, content] = await Promise.all([
      loadStreetGeneration(slug),
      prisma.streetGeneration.findUnique({
        where: { streetSlug: slug },
        select: { generatedAt: true },
      }),
      prisma.streetContent.findUnique({
        where: { streetSlug: slug },
        select: { streetName: true, neighbourhood: true, metaTitle: true, metaDescription: true },
      }),
    ]);
    if (!gen || !content) {
      console.log(`  FAIL ${slug}: ${!gen ? "no renderable generation (missing row or needsReview)" : "no StreetContent row"} - not exported`);
      failed++;
      continue;
    }

    const totalWords = gen.sections
      .flatMap((s) => s.paragraphs)
      .join(" ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    const lines: string[] = [
      "---",
      `slug: ${slug}`,
      `street: "${content.streetName}"`,
      `neighbourhood: "${content.neighbourhood ?? ""}"`,
      `generatedAt: ${(genRow?.generatedAt ?? new Date()).toISOString()}`,
      `totalWords: ${totalWords}`,
      `metaTitle: "${content.metaTitle ?? ""}"`,
      `metaDescription: "${content.metaDescription ?? ""}"`,
      "---",
      "",
      `# ${content.streetName}`,
      "",
    ];
    for (const s of gen.sections) {
      lines.push(`## ${s.heading}`, "");
      for (const p of s.paragraphs) lines.push(p, "");
    }
    if (gen.faq.length > 0) {
      lines.push("## FAQ", "");
      for (const f of gen.faq) {
        lines.push(`### ${f.question}`, "", f.answer, "");
      }
    }

    writeFileSync(join(outDir, `${slug}.md`), lines.join("\n").replace(/\n+$/, "\n"), "utf-8");
    console.log(`  ok   ${slug} (${gen.sections.length} sections, ${gen.faq.length} FAQ, ${totalWords}w)`);
    ok++;
  }

  console.log(`\ndone: ${ok} exported, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
