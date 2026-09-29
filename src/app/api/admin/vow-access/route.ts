// GET /api/admin/vow-access: the audit trail, for Aamir and, on request, for PropTx (MP-006,
// VOW Policy 19, PropTx items 28 and 30).
//
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD            the window (to exclusive; defaults: last 30 days)
//   &format=csv                               the CSV PropTx would receive; JSON otherwise
//   ?view=suspicious&days=N                   the review list (R-8.09(b)(iii)): people past a
//                                             threshold in the last N days, or carrying a flag
//
// Behind the admin cookie (src/lib/adminAuth.ts), the same one the rest of /api/admin uses.
// Never cached. This is also how PropTx gets the trail: Aamir runs the export for the window
// they name and sends the file; scripts/export-vow-access-log.ts does the same from a shell.

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookieValue } from "@/lib/adminAuth";
import { exportVowAccess, accessCsv, suspiciousVowAccess } from "@/lib/vow-audit";
import { consumerReport } from "@/lib/vow/consumer-report-db";
import { consumerReportCsv } from "@/lib/vow/consumer-report";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest): boolean {
  return verifyAdminCookieValue(req.cookies.get("miltonly_admin")?.value);
}

function day(raw: string | null, fallback: Date): Date {
  if (!raw) return fallback;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const p = req.nextUrl.searchParams;
  const noStore = { "Cache-Control": "no-store" };

  if (p.get("view") === "suspicious") {
    const days = Math.min(90, Math.max(1, parseInt(p.get("days") || "1", 10) || 1));
    const rows = await suspiciousVowAccess(days);
    return NextResponse.json({ days, count: rows.length, rows }, { headers: noStore });
  }

  // The per-consumer record and trail (MP-007, Appendix B(b), item 28), aligned to Homesly's
  // shape: ?consumer=<email|userId>[&from&to][&format=csv]. This is what PropTx receives when it
  // names a consumer suspected of a breach (R-8.08); the whole-window export below is the trail.
  const consumer = p.get("consumer");
  if (consumer) {
    const nowC = new Date();
    const toC = p.get("to") ? day(p.get("to"), nowC) : undefined;
    const fromC = p.get("from") ? day(p.get("from"), nowC) : undefined;
    const who = consumer.includes("@") ? { email: consumer } : { userId: consumer };
    const report = await consumerReport(who, { from: fromC, to: toC });
    if (!report) return NextResponse.json({ error: "No such consumer" }, { status: 404, headers: noStore });
    if (p.get("format") === "csv") {
      const name = `vow-consumer-${report.consumer.email.replace(/[^a-z0-9]+/gi, "-")}.csv`;
      return new NextResponse(consumerReportCsv(report), {
        headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
      });
    }
    return NextResponse.json(report, { headers: noStore });
  }

  const now = new Date();
  const to = day(p.get("to"), new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const from = day(p.get("from"), new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  const rows = await exportVowAccess(from, to);

  if (p.get("format") === "csv") {
    const name = `vow-access-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv`;
    return new NextResponse(accessCsv(rows), {
      headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
    });
  }
  return NextResponse.json({ from, to, count: rows.length, rows }, { headers: noStore });
}
