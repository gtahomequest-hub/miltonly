// scripts/size-hub-gap.ts
// SIZING PASS — read-only. Answers, from the record and nothing else:
//   (a) neighbourhoods that exist / hubs published / which are missing
//   (b) per missing hub: sales, streets, k>=5 on a typical — and how thin
//   (c) how many of the 157 hub-less dormant streets gain a hub if the publishable ones ship
//   (d) which are missing because generation FAILED vs was never attempted
//
// Every number is derived at run time. No frozen lists, no literals on either side.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

const money = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-CA")}`);
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { getSoldDb } = await import("@/lib/db");
  const { K_ANON_PRICE, K_ANON_RANGE } = await import("@/lib/kAnon");
  const sold = getSoldDb();
  if (!sold) throw new Error("SOLD_DATABASE_URL is not configured");

  const L = (s = "") => console.log(s);

  // ── population: every neighbourhood, every hub content row, every generation row
  const nbhds = await prisma.neighbourhood.findMany({ orderBy: { slug: "asc" } });
  const contents = await prisma.hubContent.findMany();
  const gens = await prisma.hubGeneration.findMany();
  const byContent = new Map(contents.map((c) => [c.neighbourhoodSlug, c]));
  const byGen = new Map(gens.map((g) => [g.neighbourhoodSlug, g]));

  // ── DB2: one grouped 12mo sale aggregate over every raw TREB string, k-anon applied per hub pool
  const rows = (await sold`
    SELECT neighbourhood, COUNT(*)::int AS n,
           SUM(sold_price)::float AS total,
           MIN(sold_price)::float AS lo, MAX(sold_price)::float AS hi
    FROM sold.sold_records
    WHERE perm_advertise = TRUE AND transaction_type = 'For Sale'
      AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
    GROUP BY neighbourhood`) as Array<{ neighbourhood: string; n: number; total: number; lo: number; hi: number }>;
  const byRaw = new Map(rows.map((r) => [r.neighbourhood, r]));

  // ── DB2: same, over the graduated ~26mo window (the full sold_records depth)
  const rows26 = (await sold`
    SELECT neighbourhood, COUNT(*)::int AS n, SUM(sold_price)::float AS total
    FROM sold.sold_records
    WHERE perm_advertise = TRUE AND transaction_type = 'For Sale' AND sold_date <= NOW()
    GROUP BY neighbourhood`) as Array<{ neighbourhood: string; n: number; total: number }>;
  const byRaw26 = new Map(rows26.map((r) => [r.neighbourhood, r]));

  function pool(rawStrings: string[]) {
    let n = 0, t = 0, lo = Infinity, hi = -Infinity, n26 = 0, t26 = 0;
    for (const raw of rawStrings) {
      const r = byRaw.get(raw); if (r) { n += r.n; t += r.total; lo = Math.min(lo, r.lo); hi = Math.max(hi, r.hi); }
      const r26 = byRaw26.get(raw); if (r26) { n26 += r26.n; t26 += r26.total; }
    }
    return {
      n, typical: n >= K_ANON_PRICE && t > 0 ? t / n : null,
      range: n >= K_ANON_RANGE && Number.isFinite(lo) ? { lo, hi } : null,
      n26, typical26: n26 >= K_ANON_PRICE && t26 > 0 ? t26 / n26 : null,
    };
  }

  // ── street counts per neighbourhood, and the dormant (hub-less) population
  const streets = await prisma.residentialStreet.findMany({
    select: { slug: true, neighbourhoodId: true, recencyWeightedSold: true, soldCount12mo: true },
  });
  const streetsByNbhd = new Map<string, typeof streets>();
  for (const s of streets) {
    const k = s.neighbourhoodId ?? "__none__";
    if (!streetsByNbhd.has(k)) streetsByNbhd.set(k, []);
    streetsByNbhd.get(k)!.push(s);
  }
  const publishedStreetSlugs = new Set(
    (await prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } })).map((r) => r.streetSlug),
  );

  L("═".repeat(112));
  L("SECTION 1 — SIZING THE HUB GAP");
  L("═".repeat(112));

  // ── (a)
  const publishedSlugs = new Set(contents.filter((c) => c.status === "published").map((c) => c.neighbourhoodSlug));
  const hubEligible = nbhds.filter((n) => n.profile === "urban_hub" || n.profile === "rural_hub");
  const noHubProfile = nbhds.filter((n) => n.profile === "standard_no_hub");
  L();
  L(`(a) POPULATION`);
  L(`    Neighbourhood rows total ................ ${nbhds.length}`);
  L(`      urban_hub ............................. ${nbhds.filter((n) => n.profile === "urban_hub").length}`);
  L(`      rural_hub ............................. ${nbhds.filter((n) => n.profile === "rural_hub").length}`);
  L(`      standard_no_hub (no hub page by design) ${noHubProfile.length}  [${noHubProfile.map((n) => n.slug).join(", ") || "—"}]`);
  L(`    HubContent rows ......................... ${contents.length}`);
  L(`    HubContent status=published ............. ${publishedSlugs.size}`);
  L(`    Hub-eligible (urban_hub + rural_hub) .... ${hubEligible.length}`);
  L(`    => MISSING (hub-eligible, not published)  ${hubEligible.filter((n) => !publishedSlugs.has(n.slug)).length}`);

  const missing = hubEligible.filter((n) => !publishedSlugs.has(n.slug));

  // ── (d) first: why is each missing one missing
  L();
  L(`(d) WHY MISSING — generation FAILED vs never attempted`);
  L(`    ${pad("slug", 26)} ${pad("profile", 11)} ${pad("HubContent", 22)} ${pad("HubGeneration", 22)}`);
  L(`    ${"-".repeat(26)} ${"-".repeat(11)} ${"-".repeat(22)} ${"-".repeat(22)}`);
  for (const n of missing) {
    const c = byContent.get(n.slug); const g = byGen.get(n.slug);
    L(`    ${pad(n.slug, 26)} ${pad(n.profile, 11)} ${pad(c ? `${c.status} (att ${c.attempts})` : "ABSENT", 22)} ${pad(g ? `${g.status} (att ${g.attemptCount})` : "ABSENT", 22)}`);
  }
  const failed = missing.filter((n) => byGen.get(n.slug)?.status === "failed" || (byContent.get(n.slug)?.attempts ?? 0) > 0);
  L(`    => generation attempted-and-failed: ${failed.length}   never attempted: ${missing.length - failed.length}`);

  // ── (b) can each missing hub publish
  L();
  L(`(b) CAN IT PUBLISH — 12mo sale pool, k-floors, streets`);
  L(`    ${pad("slug", 26)} ${lpad("sales12", 8)} ${lpad("typ12", 12)} ${lpad("rng", 4)} ${lpad("sales26", 8)} ${lpad("typ26", 12)} ${lpad("streets", 8)} ${lpad("pub", 5)} ${lpad("rws>0", 6)}`);
  L(`    ${"-".repeat(26)} ${"-".repeat(8)} ${"-".repeat(12)} ${"-".repeat(4)} ${"-".repeat(8)} ${"-".repeat(12)} ${"-".repeat(8)} ${"-".repeat(5)} ${"-".repeat(6)}`);
  const verdicts: Array<{ slug: string; name: string; profile: string; p: ReturnType<typeof pool>; streets: number; pub: number; ok: boolean }> = [];
  for (const n of missing) {
    const p = pool(n.rawStrings);
    const ss = streetsByNbhd.get(n.id) ?? [];
    const pub = ss.filter((s) => publishedStreetSlugs.has(s.slug)).length;
    const rws = ss.filter((s) => s.recencyWeightedSold > 0).length;
    const ok = p.typical !== null;
    verdicts.push({ slug: n.slug, name: n.name, profile: n.profile, p, streets: ss.length, pub, ok });
    L(`    ${pad(n.slug, 26)} ${lpad(p.n, 8)} ${lpad(money(p.typical), 12)} ${lpad(p.range ? "y" : "n", 4)} ${lpad(p.n26, 8)} ${lpad(money(p.typical26), 12)} ${lpad(ss.length, 8)} ${lpad(pub, 5)} ${lpad(rws, 6)}`);
  }
  L(`    => clears k>=${K_ANON_PRICE} typical on the 12mo window: ${verdicts.filter((v) => v.ok).length} of ${missing.length}`);
  L(`    => clears it only on the ~26mo window:                  ${verdicts.filter((v) => !v.ok && v.p.typical26 !== null).length}`);
  L(`    => no typical on any window:                            ${verdicts.filter((v) => !v.ok && v.p.typical26 === null).length}`);

  // ── (b2) WHOSE STREETS ARE THEY? A missing hub whose sales all sit on streets that already
  // belong to a PUBLISHED hub is not a coverage gap — publishing it would duplicate live pages.
  L();
  L(`(b2) MISSING HUBS — where their sales actually sit`);
  for (const n of missing) {
    const rows2 = (await sold`
      SELECT street_slug s, COUNT(*)::int n FROM sold.sold_records
      WHERE neighbourhood = ANY(${n.rawStrings}::text[]) AND perm_advertise = TRUE AND sold_date <= NOW()
      GROUP BY 1 ORDER BY 2 DESC`) as Array<{ s: string; n: number }>;
    L(`    ${n.slug} — ${rows2.length} distinct street(s) in DB2:`);
    const owners = await prisma.residentialStreet.findMany({
      where: { slug: { in: rows2.map((r) => r.s) } },
      select: { slug: true, neighbourhoodId: true },
    });
    const nbById = new Map(nbhds.map((x) => [x.id, x]));
    for (const r of rows2) {
      const o = owners.find((x) => x.slug === r.s);
      const own = o?.neighbourhoodId ? nbById.get(o.neighbourhoodId) : null;
      const state = !o ? "NO ResidentialStreet row" : own ? `${own.slug}${publishedSlugs.has(own.slug) ? " (PUBLISHED HUB)" : ""}` : "(unassigned)";
      L(`      ${pad(r.s, 34)} n=${lpad(r.n, 3)}  -> ${state}`);
    }
    const covered = rows2.filter((r) => {
      const o = owners.find((x) => x.slug === r.s);
      const own = o?.neighbourhoodId ? nbById.get(o.neighbourhoodId) : null;
      return own && publishedSlugs.has(own.slug);
    });
    L(`      => ${covered.length} of ${rows2.length} already covered by a published hub`);
  }

  // ── (c) THE DECIDING NUMBER — dormant hub-less streets that gain a hub
  L();
  L(`(c) THE 157 — hub-less dormant streets, and how many gain a hub`);
  // Reproduce the population by predicate, not by a frozen count.
  const dormant = streets.filter((s) => !(s.recencyWeightedSold > 0 || publishedStreetSlugs.has(s.slug)));
  const dormantNoNbhd = dormant.filter((s) => !s.neighbourhoodId);
  const dormantWithNbhd = dormant.filter((s) => s.neighbourhoodId);
  const dormantHubless = dormantWithNbhd.filter((s) => {
    const n = nbhds.find((x) => x.id === s.neighbourhoodId);
    return !n || !publishedSlugs.has(n.slug);
  });
  L(`    All ResidentialStreet rows .............................. ${streets.length}`);
  L(`    Dormant (NOT (rws>0 OR published)) ............... ${dormant.length}`);
  L(`      of those, no neighbourhoodId at all .................. ${dormantNoNbhd.length}`);
  L(`      of those, in a neighbourhood with NO published hub .... ${dormantHubless.length}`);
  const publishableSlugs = new Set(verdicts.filter((v) => v.ok).map((v) => v.slug));
  const gained = dormantHubless.filter((s) => {
    const n = nbhds.find((x) => x.id === s.neighbourhoodId);
    return n && publishableSlugs.has(n.slug);
  });
  L(`    ─────────────────────────────────────────────────────────`);
  L(`    GAIN A HUB if the publishable missing hubs ship ......... ${gained.length}`);
  L(`    Still hub-less afterwards ............................... ${dormant.length - gained.length}`);
  // per-neighbourhood breakdown of the hub-less dormant
  const byN = new Map<string, number>();
  for (const s of dormantHubless) { const n = nbhds.find((x) => x.id === s.neighbourhoodId); const k = n ? n.slug : "?"; byN.set(k, (byN.get(k) ?? 0) + 1); }
  L(`    breakdown (dormant streets per hub-less neighbourhood):`);
  for (const [k, v] of [...byN.entries()].sort((a, b) => b[1] - a[1])) {
    L(`      ${pad(k, 26)} ${lpad(v, 5)}   ${publishableSlugs.has(k) ? "<= GAINS A HUB" : "(hub not publishable)"}`);
  }

  // ── the 22 published hubs: stored meta vs live typical (Section 2 evidence)
  L();
  L("═".repeat(112));
  L("SECTION 2 EVIDENCE — stored hub meta descriptions vs the live aggregate");
  L("═".repeat(112));
  L(`    ${pad("slug", 26)} ${lpad("sales12", 8)} ${lpad("live typ", 12)} ${lpad("live r5k", 12)} ${lpad("stored in meta", 16)} ${lpad("drift", 12)}`);
  L(`    ${"-".repeat(26)} ${"-".repeat(8)} ${"-".repeat(12)} ${"-".repeat(12)} ${"-".repeat(16)} ${"-".repeat(12)}`);
  let withStored = 0, drifting = 0;
  for (const n of nbhds.filter((x) => publishedSlugs.has(x.slug))) {
    const c = byContent.get(n.slug)!;
    const p = pool(n.rawStrings);
    const live = p.typical;
    const liveR = live != null ? Math.round(live / 5000) * 5000 : null;
    const md = c.metaDescription ?? "";
    const m = md.match(/\$([\d,]{6,})/);
    const stored = m ? Number(m[1].replace(/,/g, "")) : null;
    if (stored != null) withStored++;
    const drift = stored != null && liveR != null ? stored - liveR : null;
    if (drift != null && drift !== 0) drifting++;
    L(`    ${pad(n.slug, 26)} ${lpad(p.n, 8)} ${lpad(money(live), 12)} ${lpad(money(liveR), 12)} ${lpad(stored != null ? money(stored) : "—", 16)} ${lpad(drift == null ? "—" : (drift > 0 ? "+" : "") + drift.toLocaleString("en-CA"), 12)}`);
  }
  L(`    => published hubs: ${publishedSlugs.size}   meta carrying a stored price: ${withStored}   drifting from live: ${drifting}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
