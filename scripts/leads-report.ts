// scripts/leads-report.ts
// Leads per page, last 7 and last 28 days. This is what the Brain reads.
//
// The numbers come from the view public.lead_daily_by_page, created by the Phase 1
// migration. A view rather than a table: there is nothing to write that Lead does not
// already hold, and a second copy of the same fact is a second thing that can be wrong.
//
// THE VIEW EXCLUDES PREVIEW AND DEVELOPMENT ROWS. Preview deployments write to the
// production database, so without that filter every test submission would inflate the page
// it was tested against. The filter lives in the view so no caller can forget it.
//
// THIS IS A COUNT, NOT A RATE. There is no page-view denominator anywhere in this codebase,
// so nothing here divides by traffic and nothing here should be read as a conversion rate.
//
// Usage: npx tsx scripts/leads-report.ts [--json]
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

const AS_JSON = process.argv.includes("--json");

interface Row { page: string; source: string; leads7: number; leads28: number }

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ page: string; source: string; leads7: bigint; leads28: bigint }>>(`
      SELECT page,
             source,
             COALESCE(SUM(leads) FILTER (WHERE day >= (CURRENT_DATE - INTERVAL '7 days')),  0) AS "leads7",
             COALESCE(SUM(leads) FILTER (WHERE day >= (CURRENT_DATE - INTERVAL '28 days')), 0) AS "leads28"
      FROM public.lead_daily_by_page
      GROUP BY page, source
      HAVING COALESCE(SUM(leads) FILTER (WHERE day >= (CURRENT_DATE - INTERVAL '28 days')), 0) > 0
      ORDER BY "leads28" DESC, page ASC
    `);

    const data: Row[] = rows.map((r) => ({
      page: r.page,
      source: r.source,
      leads7: Number(r.leads7),
      leads28: Number(r.leads28),
    }));

    if (AS_JSON) {
      console.log(JSON.stringify({ generatedAt: new Date().toISOString(), windowDays: [7, 28], rows: data }, null, 2));
      return;
    }

    const t7 = data.reduce((a, r) => a + r.leads7, 0);
    const t28 = data.reduce((a, r) => a + r.leads28, 0);

    console.log("LEADS PER PAGE — production rows only, counts not rates");
    console.log(`generated ${new Date().toISOString()}`);
    console.log("");
    if (data.length === 0) {
      console.log("No production leads in the last 28 days.");
    } else {
      const w = Math.min(56, Math.max(12, ...data.map((r) => r.page.length)));
      console.log(`${"page".padEnd(w)}  ${"source".padEnd(28)}  ${"7d".padStart(5)}  ${"28d".padStart(5)}`);
      console.log("-".repeat(w + 46));
      for (const r of data) {
        console.log(`${r.page.slice(0, w).padEnd(w)}  ${r.source.slice(0, 28).padEnd(28)}  ${String(r.leads7).padStart(5)}  ${String(r.leads28).padStart(5)}`);
      }
      console.log("-".repeat(w + 46));
      console.log(`${"TOTAL".padEnd(w)}  ${"".padEnd(28)}  ${String(t7).padStart(5)}  ${String(t28).padStart(5)}`);
    }

    // The share of rows that can be attributed to a page at all. Before Phase 1 only 3 of
    // 14 rows carried a landingPage, because only the surfaces calling attributionPayload()
    // set it. Every lead written through the one path sets it now, and this line is how the
    // coverage gap closing gets watched rather than assumed.
    const coverage = await prisma.lead.groupBy({
      by: ["env"],
      _count: { _all: true },
      where: { landingPage: { not: null } },
    });
    const totals = await prisma.lead.groupBy({ by: ["env"], _count: { _all: true } });
    console.log("");
    for (const t of totals) {
      const c = coverage.find((x) => x.env === t.env)?._count._all ?? 0;
      console.log(`env=${t.env}: ${c} of ${t._count._all} rows carry a page`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("leads-report failed:", err);
  process.exit(1);
});
