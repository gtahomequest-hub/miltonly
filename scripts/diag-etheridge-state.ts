// scripts/diag-etheridge-state.ts
// Inspect Etheridge's StreetContent + StreetGeneration state. Reports whether
// the published page content (StreetContent.description) still matches the
// stale-but-present sectionsJson on the failed StreetGeneration row, so the
// caller can decide between (a) clear-content-on-failed-row and (b) roll-row-
// back-to-succeeded.

import { readFileSync } from "node:fs";

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let value = m[2].replace(/\\n$/, "");
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[m[1]] = value;
      }
    }
  } catch {}
}
loadEnvLocal();

import { prisma } from "@/lib/prisma";

const SLUG = "etheridge-avenue-milton";

interface SectionShape { id: string; heading: string; paragraphs: string[] }

async function main() {
  const sc = await prisma.streetContent.findUnique({ where: { streetSlug: SLUG } });
  const sg = await prisma.streetGeneration.findUnique({ where: { streetSlug: SLUG } });

  console.log("=== StreetContent ===");
  if (sc) {
    console.log(`status:        ${sc.status}`);
    console.log(`generatedAt:   ${sc.generatedAt.toISOString()}`);
    console.log(`publishedAt:   ${sc.publishedAt?.toISOString() ?? "(null)"}`);
    console.log(`needsReview:   ${sc.needsReview}`);
    console.log(`description.length: ${sc.description.length}`);
    console.log(`description (first 300 chars):\n  "${sc.description.slice(0, 300)}..."`);
    console.log(`description (last 300 chars):\n  "...${sc.description.slice(-300)}"`);
  } else {
    console.log("(missing)");
  }

  console.log("\n=== StreetGeneration ===");
  if (sg) {
    console.log(`status:        ${sg.status}`);
    console.log(`generatedAt:   ${sg.generatedAt.toISOString()}`);
    console.log(`attemptCount:  ${sg.attemptCount}`);
    console.log(`totalWords:    ${sg.totalWords}`);
    const sections = sg.sectionsJson as unknown as SectionShape[];
    if (Array.isArray(sections) && sections.length > 0) {
      console.log(`sectionsJson:  ${sections.length} sections`);
      for (const s of sections) {
        const wc = s.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
        console.log(`  ${s.id.padEnd(22)} ${wc}w  paragraphs=${s.paragraphs.length}  heading="${s.heading}"`);
      }
    } else {
      console.log(`sectionsJson:  (empty)`);
    }
  } else {
    console.log("(missing)");
  }

  // Cross-reference: does StreetContent.description text appear in StreetGeneration.sectionsJson?
  if (sc && sg) {
    const sections = sg.sectionsJson as unknown as SectionShape[];
    const expectedFlat = Array.isArray(sections)
      ? sections.flatMap(s => s.paragraphs).join("\n\n")
      : "";
    const sliceMatch =
      expectedFlat.length > 200 &&
      sc.description.includes(expectedFlat.slice(50, 250));
    console.log("\n=== Cross-reference ===");
    console.log(`Expected description from sectionsJson (length): ${expectedFlat.length}`);
    console.log(`StreetContent.description length:                ${sc.description.length}`);
    console.log(`Does StreetContent.description contain a 200-char chunk of the rebuilt sectionsJson flat? ${sliceMatch}`);
    if (sliceMatch) {
      console.log(`=> StreetContent appears to mirror the prior succeeded sectionsJson content.`);
      console.log(`   Recommendation: (b) restore StreetGeneration.status = succeeded.`);
    } else {
      console.log(`=> StreetContent does NOT match sectionsJson content. The published page may be from a different run or a legacy source.`);
      console.log(`   Recommendation: (a) clear sectionsJson/faqJson/totalWords on StreetGeneration.`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
