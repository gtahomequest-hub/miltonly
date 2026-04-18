// Template-replace description/metaTitle/metaDescription on StreetContent
// rows whose descriptions still contain "sold price" or "sold for" after
// the force-regenerate pass. These are the streets whose active-listing
// count dropped to zero — generateStreetContent bails with "No stats
// available" and can't produce new AI copy. Rather than leaving the old
// non-compliant AI text in place, replace it with a static template that
// explains the listing drought and invites sign-up for alerts.
//
// Pure DB operation — no Claude API, no TREB, no external calls.
//
// Idempotent: the query filter (description contains "sold price" OR
// "sold for") naturally excludes templated rows once they've been
// rewritten, so re-runs are no-ops.
//
// WHEN TO RE-RUN: any time another batch of streets loses all active
// listings and regenerate can't cover them. The filter will pick them up.
// When listings return, marketDataHash = NULL forces the next cron pass
// to build fresh AI content over the template.
//
// Usage:
//   node scripts/template-no-stats-descriptions.mjs --dry-run
//   node scripts/template-no-stats-descriptions.mjs
//
// Reads DATABASE_URL from .env.local.

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// --- env loader (same as force-regenerate-streets.mjs) ---------------------
function loadEnvLocal() {
  const envPath = resolve(REPO_ROOT, ".env.local");
  let content;
  try {
    content = readFileSync(envPath, "utf8");
  } catch (e) {
    console.error(`[template] could not read ${envPath}: ${e.message}`);
    process.exit(1);
  }
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    const isDoubleQuoted = val.startsWith('"') && val.endsWith('"');
    const isSingleQuoted = val.startsWith("'") && val.endsWith("'");
    if (isDoubleQuoted || isSingleQuoted) val = val.slice(1, -1);
    if (isDoubleQuoted) {
      val = val
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();

const DRY_RUN = process.argv.includes("--dry-run");

// --- template builders -----------------------------------------------------
function buildDescription(streetName) {
  return (
    `${streetName} is a residential street in Milton, Ontario. ` +
    `No active listings are currently available on this street. ` +
    `Check back for new listings, or sign up for alerts to be notified ` +
    `when a property becomes available.`
  );
}

// Under 60 chars. Primary template overflows for long street names (e.g.
// "Downes Jackson Heights" → 63 chars), so fall back to progressively
// shorter variants. Returns the first variant that fits.
function buildMetaTitle(streetName) {
  const variants = [
    `${streetName} Milton Real Estate | No Current Listings`,
    `${streetName} Milton | No Current Listings`,
    `${streetName} | No Current Listings`,
  ];
  for (const v of variants) {
    if (v.length <= 60) return v;
  }
  // All variants overflow — truncate the street name. Rare for Milton.
  return variants[variants.length - 1].slice(0, 60);
}

// Under 155 chars. Fixed overhead ~83 chars + streetName — safe for any
// real Milton street name.
function buildMetaDescription(streetName) {
  return `No active listings on ${streetName} in Milton right now. Get alerts for new homes on this street.`;
}

// --- main ------------------------------------------------------------------
async function main() {
  const prisma = new PrismaClient();
  const started = Date.now();

  try {
    const targets = await prisma.streetContent.findMany({
      where: {
        OR: [
          { description: { contains: "sold price", mode: "insensitive" } },
          { description: { contains: "sold for", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        streetSlug: true,
        streetName: true,
        description: true,
      },
      orderBy: { streetSlug: "asc" },
    });

    console.log(`[template] mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}`);
    console.log(`[template] rows to template: ${targets.length}`);

    if (targets.length === 0) {
      console.log("[template] nothing to do — no leaking rows found.");
      return;
    }

    for (let i = 0; i < targets.length; i++) {
      const row = targets[i];
      const label = `[${i + 1}/${targets.length}]`;
      const streetName = row.streetName;
      const oldLen = (row.description || "").length;
      const newDescription = buildDescription(streetName);
      const newMetaTitle = buildMetaTitle(streetName);
      const newMetaDescription = buildMetaDescription(streetName);

      if (DRY_RUN) {
        console.log(
          `${label} WOULD TEMPLATE: ${row.streetSlug} ` +
            `(had ${oldLen} chars of leaking content) → ` +
            `metaTitle=${newMetaTitle.length}ch, ` +
            `metaDescription=${newMetaDescription.length}ch`
        );
        continue;
      }

      await prisma.streetContent.update({
        where: { id: row.id },
        data: {
          description: newDescription,
          metaTitle: newMetaTitle,
          metaDescription: newMetaDescription,
          marketDataHash: null,
          updatedAt: new Date(),
        },
      });
      console.log(
        `${label} templated: ${row.streetSlug} ` +
          `(had ${oldLen} chars of leaking content, replaced with template)`
      );
    }

    // --- verification --------------------------------------------------
    const remaining = await prisma.streetContent.count({
      where: {
        OR: [
          { description: { contains: "sold price", mode: "insensitive" } },
          { description: { contains: "sold for", mode: "insensitive" } },
        ],
      },
    });

    const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
    console.log("");
    console.log(`[template] ===== final =====`);
    console.log(`[template] elapsed:       ${elapsedSec}s`);
    console.log(`[template] processed:     ${targets.length}`);
    console.log(`[template] still leaking: ${remaining} (expected 0)`);

    if (DRY_RUN) {
      console.log(
        `[template] DRY-RUN: no writes performed. ` +
          `Still-leaking count reflects CURRENT DB state, not the post-run state.`
      );
      return;
    }

    if (remaining > 0) {
      console.error(
        `[template] FAILED: ${remaining} rows still contain leaking language ` +
          `after templating. Investigate manually.`
      );
      process.exit(1);
    }

    console.log(`[template] OK: all leaking rows templated clean.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[template] FATAL:", e);
  process.exit(1);
});
