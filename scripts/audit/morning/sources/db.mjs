// MA-008. DB1 and DB2, read-only, through the Neon HTTP driver: leads by source and landing
// page, the 28-day lead table by landing page (joined to GSC clicks for the conversion rate), and
// the streets with recent sales and no published page. Counts only; no sold price leaves DB2.
import path from 'node:path';
import { createRequire } from 'node:module';
import { calls, redact, REPO, YESTERDAY, daysAgo } from '../lib.mjs';

function driver() {
  const deps = process.env.AUDIT_DEPS ? path.resolve(process.env.AUDIT_DEPS) : null;
  const req = createRequire(deps ? path.join(deps, 'package.json') : path.join(REPO, 'package.json'));
  return req('@neondatabase/serverless').neon;
}
const counted = (sql) => async (...a) => { calls.n++; calls.byHost['neon-sql'] = (calls.byHost['neon-sql'] || 0) + 1; return sql(...a); };

export async function gatherDb() {
  const url = process.env.DATABASE_URL; const sold = process.env.SOLD_DATABASE_URL;
  if (!url) return { ok: false, error: 'DATABASE_URL unset' };
  try {
    const neon = driver();
    const db1 = counted(neon(url));
    // Toronto days, in UTC bounds.
    const dayStart = `${YESTERDAY}T00:00:00-04:00`, dayEnd = `${daysAgo(0)}T00:00:00-04:00`;
    const leadsYesterday = await db1`SELECT source, COALESCE("landingPage", '') AS landing, intent, COUNT(*)::int AS n FROM public."Lead" WHERE "createdAt" >= ${dayStart}::timestamptz AND "createdAt" < ${dayEnd}::timestamptz GROUP BY 1, 2, 3 ORDER BY 4 DESC`;
    const leads7 = await db1`SELECT COUNT(*)::int AS n FROM public."Lead" WHERE "createdAt" >= ${daysAgo(7)}::date`;
    const leads28ByPage = await db1`SELECT COALESCE("landingPage", '') AS landing, COUNT(*)::int AS n FROM public."Lead" WHERE "createdAt" >= ${daysAgo(28)}::date GROUP BY 1`;
    const leads28Unpaid = await db1`SELECT COUNT(*)::int AS n FROM public."Lead" WHERE "createdAt" >= ${daysAgo(28)}::date AND gclid IS NULL AND "gclidLast" IS NULL AND "utmSource" IS NULL`;
    const leadsMtd = await db1`SELECT COUNT(*)::int AS n FROM public."Lead" WHERE "createdAt" >= date_trunc('month', now() AT TIME ZONE 'America/Toronto')`;
    const published = new Set((await db1`SELECT "streetSlug" FROM public."StreetContent" WHERE status = 'published'`).map((r) => r.streetSlug));
    const registry = new Map((await db1`SELECT slug, name FROM public."ResidentialStreet"`).map((r) => [r.slug, r.name]));
    let streetsWithoutPage = [];
    if (sold) {
      const db2 = counted(neon(sold));
      const rows = await db2`SELECT street_slug AS slug, COUNT(*)::int AS sales90 FROM sold.sold_records WHERE perm_advertise = TRUE AND transaction_type = 'For Sale' AND sold_date >= NOW() - INTERVAL '90 days' AND sold_date <= NOW() AND street_slug IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`;
      streetsWithoutPage = rows.filter((r) => registry.has(r.slug) && !published.has(r.slug)).map((r) => ({ slug: r.slug, street: registry.get(r.slug), sales90: r.sales90 }));
    }
    const normalise = (u) => { try { const x = new URL(u, 'https://miltonly.com'); return x.pathname.replace(/\/$/, '') || '/'; } catch { return String(u || ''); } };
    return { ok: true, leadsYesterday: leadsYesterday.map((r) => ({ source: r.source, landing: normalise(r.landing), intent: r.intent, n: r.n })), leadsYesterdayTotal: leadsYesterday.reduce((a, r) => a + r.n, 0), leads7: leads7[0].n, leadsMtd: leadsMtd[0].n, leads28ByPath: Object.fromEntries(leads28ByPage.map((r) => [normalise(r.landing), r.n])), leads28: leads28ByPage.reduce((a, r) => a + r.n, 0), leads28Unpaid: leads28Unpaid[0].n, publishedStreets: published.size, streetsWithoutPage, soldRead: !!sold };
  } catch (e) {
    return { ok: false, error: redact(e.message) };
  }
}
