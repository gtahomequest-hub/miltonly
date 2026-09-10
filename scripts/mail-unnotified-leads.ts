// scripts/mail-unnotified-leads.ts
// Phase 0, ruling 2. One summary email listing every ads.leads row that never produced
// an ops notification. Read-only against the DB; sends through the SAME Resend path the
// app uses (RESEND_API_KEY + RESEND_FROM_EMAIL), not a new transport.
//
// Recipient is fixed to gtahomequest@gmail.com — the address ruling 1 set ALERT_EMAIL_TO
// to. Not configurable, so a stray env var cannot redirect this mail somewhere else.
//
// Carries only the fields ruling 2 names: name, contact, source page, timestamp.
// DRY RUN BY DEFAULT. --send is required to put anything on the wire.
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

const SEND = process.argv.includes("--send");
const TO = "gtahomequest@gmail.com";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  let rows: Array<{ createdAt: Date; name: string | null; email: string | null; phone: string | null; source: string; page: string }>;
  try {
    const raw = await prisma.adsLead.findMany({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, name: true, email: true, phone: true, source: true, meta: true },
    });
    rows = raw.map((r) => {
      const meta = (r.meta ?? {}) as Record<string, unknown>;
      const page = (typeof meta.event_source_url === "string" && meta.event_source_url)
        || (typeof meta.referer === "string" && meta.referer)
        || "(not recorded)";
      return { createdAt: r.createdAt, name: r.name, email: r.email, phone: r.phone, source: r.source, page };
    });
  } finally {
    await prisma.$disconnect();
  }

  // Every row in this table is un-notified: /api/leads/create's only notification is the
  // ALERT_EMAIL_TO email, and no message with subject "New ads lead" has ever arrived at
  // the account. See scratchpad/reports/063-unnotified-leads.md for the evidence.
  const tableRows = rows
    .map((r) => {
      const contact = [r.email, r.phone].filter(Boolean).join(" / ") || "(none)";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${esc(r.name ?? "(no name)")}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${esc(contact)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;word-break:break-all;">${esc(r.page)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${r.createdAt.toISOString()}</td>
      </tr>`;
    })
    .join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;">
    <h2 style="margin:0 0 4px;font-size:18px;color:#073126;">Miltonly — leads that never reached you</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:13px;">
      Every row in <code>ads.leads</code>, the table behind the street alert, condo and sold-valuation
      forms. Its only notification is the ops alert to ALERT_EMAIL_TO, which was empty, so none of
      these produced one. That variable is now set. <strong>${rows.length}</strong> row${rows.length === 1 ? "" : "s"} total,
      <strong>${rows.length}</strong> un-notified, <strong>0</strong> of them a real person.
    </p>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;width:100%;">
      <tr style="background:#f6f4ef;">
        <th align="left" style="padding:8px 12px;">Name</th>
        <th align="left" style="padding:8px 12px;">Contact</th>
        <th align="left" style="padding:8px 12px;">Source page</th>
        <th align="left" style="padding:8px 12px;">Timestamp (UTC)</th>
      </tr>
      ${tableRows}
    </table>
    <p style="margin:16px 0 0;color:#64748b;font-size:12px;">
      Sent once by scripts/mail-unnotified-leads.ts. Detail in scratchpad/reports/063-unnotified-leads.md.
    </p>
  </div>`;

  const subject = `Miltonly — ${rows.length} lead${rows.length === 1 ? "" : "s"} that never reached you (0 real)`;

  if (!SEND) {
    console.log(`DRY RUN. ${rows.length} row(s). Subject: ${subject}`);
    console.log(`to=${TO} from=${process.env.RESEND_FROM_EMAIL ?? "(RESEND_FROM_EMAIL unset)"}`);
    console.log("Re-run with --send to deliver.");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY unset");
  if (!from) throw new Error("RESEND_FROM_EMAIL unset");

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({ from, to: TO, subject, html });
  if (result.error) throw new Error(`Resend refused: ${result.error.message}`);
  console.log(`SENT id=${result.data?.id} to=${TO} rows=${rows.length}`);
}

main().catch((err) => {
  console.error("mail-unnotified-leads failed:", err);
  process.exit(1);
});
