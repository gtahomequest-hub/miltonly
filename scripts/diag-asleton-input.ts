// scripts/diag-asleton-input.ts
// Quick: dump Asleton's input.crossStreets[] and surrounding fields the
// model is being given, to see what valid names the model has access to
// vs what it's inventing.

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

import { buildGeneratorInput } from "@/lib/ai/buildGeneratorInput";
import { prisma } from "@/lib/prisma";

async function main() {
  const input = await buildGeneratorInput("asleton-boulevard-milton");
  console.log("=== Asleton input ===");
  console.log("street.name:        ", input.street.name);
  console.log("street.shortName:   ", input.street.shortName);
  console.log("neighbourhoods:     ", input.neighbourhoods);
  console.log("crossStreets count: ", input.crossStreets.length);
  if (input.crossStreets.length === 0) {
    console.log("  (empty — model has NO valid cross-street names to use)");
  } else {
    for (const cs of input.crossStreets) {
      console.log(`  - shortName: "${cs.shortName}", slug: ${cs.slug}, distinctivePattern: "${cs.distinctivePattern}", typicalPrice: ${cs.typicalPrice}`);
    }
  }
  console.log("aggregates.kAnonLevel:", input.aggregates.kAnonLevel);
  console.log("aggregates.salesCount:", input.aggregates.salesCount);
  console.log("aggregates.txCount:   ", input.aggregates.txCount);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(2); });
