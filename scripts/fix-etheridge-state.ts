// scripts/fix-etheridge-state.ts
// One-off: restore Etheridge's StreetGeneration row to the most-recent-passing
// state. The diag confirmed StreetContent.description is byte-identical to the
// flattened sectionsJson on StreetGeneration. The most-recent failed smoke
// run flipped status to "failed" and bumped generatedAt; this rolls both back.

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

async function main() {
  const sc = await prisma.streetContent.findUnique({ where: { streetSlug: SLUG } });
  if (!sc) {
    console.error("StreetContent missing — aborting");
    process.exit(1);
  }
  const sg = await prisma.streetGeneration.findUnique({ where: { streetSlug: SLUG } });
  if (!sg) {
    console.error("StreetGeneration missing — aborting");
    process.exit(1);
  }

  console.log("Before:");
  console.log(`  StreetGeneration.status      = ${sg.status}`);
  console.log(`  StreetGeneration.generatedAt = ${sg.generatedAt.toISOString()}`);
  console.log(`  StreetContent.generatedAt    = ${sc.generatedAt.toISOString()}  <-- target alignment`);

  await prisma.streetGeneration.update({
    where: { streetSlug: SLUG },
    data: {
      status: "succeeded",
      generatedAt: sc.generatedAt,
    },
  });

  // Clear the review row left by the failed smoke run.
  await prisma.streetGenerationReview
    .delete({ where: { streetSlug: SLUG } })
    .catch(() => undefined);

  const after = await prisma.streetGeneration.findUnique({ where: { streetSlug: SLUG } });
  console.log("\nAfter:");
  console.log(`  StreetGeneration.status      = ${after?.status}`);
  console.log(`  StreetGeneration.generatedAt = ${after?.generatedAt.toISOString()}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
