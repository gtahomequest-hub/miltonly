// scripts/read-leads.ts
// Phase 1, step 0. Read-only census of public.Lead on production (local DATABASE_URL and the
// production one resolve to the same Neon host).
//
// "Real person" is a judgement, so the heuristic is stated rather than hidden: a row is counted
// SYNTHETIC when its email or phone matches a test pattern, its name is a placeholder, or its
// notes/address say so. Everything else counts as real and is listed by source so the call can
// be checked by eye rather than trusted.
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

const SYNTH_EMAIL = /(^|@)(test|example|foo|bar|dummy|fake|probe|noreply)\b|@(test|example)\.(com|org|net)$|\+(test|probe|prodcheck|exitintent|cornerwidget|seller-menu|verification|smoke)[^@]*@/i;
const SYNTH_NAME = /^(test|tester|asdf|qwerty|aaa+|xxx+|lead \d{4}|unknown|off-market subscriber|alert subscriber|resend verification|seller menu test)$/i;
const SYNTH_TEXT = /\b(test|smoke|probe|verification|live email test)\b/i;
const REPEAT_DIGITS = /^(\d)\1{9,}$/; // 1111111111, 0000000000

function isSynthetic(r: {
  firstName: string; email: string | null; phone: string | null;
  notes: string | null; yourHomeAddress: string | null; street: string | null;
}): string | null {
  if (r.email && SYNTH_EMAIL.test(r.email)) return "email pattern";
  if (SYNTH_NAME.test(r.firstName.trim())) return "placeholder name";
  if (r.phone && REPEAT_DIGITS.test(r.phone.replace(/\D/g, ""))) return "repeated-digit phone";
  for (const t of [r.notes, r.yourHomeAddress, r.street]) {
    if (t && SYNTH_TEXT.test(t)) return "test wording in a field";
  }
  return null;
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const total = await prisma.lead.count();
    console.log(`TOTAL ${total}`);

    const rows = await prisma.lead.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true, createdAt: true, firstName: true, email: true, phone: true, source: true,
        intent: true, notes: true, yourHomeAddress: true, street: true, landingPage: true,
      },
    });

    const bySource = new Map<string, { real: number; synth: number }>();
    let real = 0;
    let synth = 0;
    for (const r of rows) {
      const why = isSynthetic(r);
      const b = bySource.get(r.source) ?? { real: 0, synth: 0 };
      if (why) { b.synth++; synth++; } else { b.real++; real++; }
      bySource.set(r.source, b);
    }

    console.log(`REAL ${real}`);
    console.log(`SYNTHETIC ${synth}`);
    for (const [source, b] of [...bySource].sort((a, b2) => (b2[1].real + b2[1].synth) - (a[1].real + a[1].synth))) {
      console.log(`SOURCE\t${source}\t${b.real + b.synth}\treal=${b.real}\tsynthetic=${b.synth}`);
    }

    console.log("--- rows judged REAL ---");
    for (const r of rows) {
      if (isSynthetic(r)) continue;
      const contact = [r.email, r.phone].filter(Boolean).join(" / ") || "(none)";
      console.log(`REALROW\t${r.createdAt.toISOString().slice(0, 10)}\t${r.source}\t${r.intent}\t${r.firstName}\t${contact}\t${r.landingPage ?? ""}`);
    }

    console.log("--- landingPage coverage ---");
    const withPage = rows.filter((r) => r.landingPage).length;
    console.log(`landingPage set on ${withPage} of ${total}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("read-leads failed:", err);
  process.exit(1);
});
