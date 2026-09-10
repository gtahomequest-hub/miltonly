// scripts/read-ads-leads.ts
// Phase 0, ruling 2. Read-only census of ads.leads on production.
//
// Local DATABASE_URL and the production DATABASE_URL resolve to the SAME Neon host
// (ep-patient-paper-aebh7f93-pooler), verified 2026-09-10 by comparing the pulled
// production value against .env.local. So this reads production data.
//
// WHAT "NO NOTIFICATION RECORD" MEANS. ads.leads carries no notification column and
// /api/leads/create writes none — the only notification that route can produce is the
// ops alert email to ALERT_EMAIL_TO (subject "New ads lead — <source>"). There is no
// realtor email, no SMS and no CRM call on that path at all. So a row's notification
// state is not in the database; it is reconstructed from the mailbox. The flag emitted
// here is therefore structural, not evidential: it reports what the route COULD have
// sent, and the mailbox search is what settles whether it did.
//
// Emits nothing but the fields ruling 2 asks for: name, contact, source page, timestamp.
// No notes, no utm, no ip, no user agent, no meta blob.
import { readFileSync } from "node:fs";

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
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
loadEnvLocal();

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const total = await prisma.adsLead.count();
    console.log(`TOTAL ${total}`);

    const bySource = await prisma.adsLead.groupBy({
      by: ["source"],
      _count: { _all: true },
      orderBy: { _count: { source: "desc" } },
    });
    for (const r of bySource) console.log(`SOURCE\t${r.source}\t${r._count._all}`);

    const byStatus = await prisma.adsLead.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    for (const r of byStatus) console.log(`STATUS\t${r.status}\t${r._count._all}`);

    const rows = await prisma.adsLead.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, name: true, email: true, phone: true, source: true, meta: true },
    });
    for (const r of rows) {
      const meta = (r.meta ?? {}) as Record<string, unknown>;
      const page = (typeof meta.event_source_url === "string" && meta.event_source_url)
        || (typeof meta.referer === "string" && meta.referer)
        || "";
      const contact = [r.email, r.phone].filter(Boolean).join(" / ") || "(none)";
      console.log(`ROW\t${r.id}\t${r.createdAt.toISOString()}\t${r.name ?? "(no name)"}\t${contact}\t${r.source}\t${page}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("read-ads-leads failed:", err);
  process.exit(1);
});
