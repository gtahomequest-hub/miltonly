// Purge the surfaces a DB2 backfill moves.
//
// WHY THIS IS NEEDED AT ALL. DEC-REGEN-REVALIDATE fires on a successful StreetContent write,
// which covers every generated page. The sold-date backfill writes no StreetContent row - it
// changes sold.sold_records - so it moves published figures corpus-wide and purges nothing.
// The 2026-09-10 battery caught it: the homepage still rendered sold-mtd 23 against a live
// source of 51, and proof-sales-12mo 1,531 against 1,728, because those pages were prerendered
// before the backfill ran.
//
// The surfaces that read DB2 aggregates rather than stored prose:
//   /                the Milton-wide figures and the 22 neighbourhood prices
//   /streets         the corpus counts
//   /neighbourhoods  the index
//   /neighbourhoods/<slug>  the 22 hub pages, whose figures the homepage is checked against
//   /rentals         the lease side
//
// Street pages are NOT purged here. Their figures live in stored prose written at generation
// time, and re-rendering does not change them; a moved sold_date reaches a street page only
// through a regeneration, which is a separate decision.
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

const BASE = process.env.BASE || "https://miltonly.com";

(async () => {
  // REVALIDATION_SECRET, not CRON_SECRET and not REVALIDATE_SECRET. A wrong guess 401s and the
  // purge fails silently, which is how 52 condo revalidations were lost on 2026-09-09.
  const secret = process.env.REVALIDATION_SECRET;
  if (!secret) { console.error("REVALIDATION_SECRET unset. Refusing to run a purge that would 401 silently."); process.exit(1); }

  const { prisma } = await import("@/lib/prisma");
  const hubs = await prisma.hubContent.findMany({
    where: { status: "published" }, select: { neighbourhoodSlug: true },
  });
  const paths = [
    "/", "/streets", "/neighbourhoods", "/rentals",
    ...hubs.map((h) => `/neighbourhoods/${h.neighbourhoodSlug}`),
  ];
  console.log(`purging ${paths.length} paths on ${BASE} (${hubs.length} hubs)`);

  let ok = 0, bad = 0;
  for (const path of paths) {
    const status = await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
    }).then((r) => r.status).catch(() => null);
    if (status === 200) { ok++; } else { bad++; console.log(`  ${status} ${path}`); }
  }
  console.log(`200: ${ok}, other: ${bad}`);
  if (bad > 0) console.error("A non-200 is a purge that did not happen. Check the secret name before re-running.");
  await prisma.$disconnect();
  process.exit(bad > 0 ? 1 : 0);
})();
