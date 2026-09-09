// scripts/recon-condo-names.ts
// GATE A RECON for QUEUE item 4, condo building names. READ ONLY. Writes nothing.
//
// The question is narrow: can the street component of every CondoBuilding address be routed
// through resolveStreetName, keeping the civic number, the way street pages already are? This
// reports how far the existing columns get us and names every row that would not resolve.
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
  const { resolveStreetName } = await import("../src/lib/streetName");
  const { identityFromSlug, parseAddress } = await import("../src/lib/town/identity");
  const { MILTON_STREET_REGISTRY } = await import("../src/data/miltonStreetRegistry");
  const { OFF_REGISTRY_SET } = await import("../src/data/offRegistryStreets");

  // identity key -> registry slug. The key is what parseAddress produces, so this is the bridge
  // from a raw address string to the registry without a second name-matching heuristic.
  const byKey = new Map<string, string>();
  const dupKeys = new Set<string>();
  for (const r of MILTON_STREET_REGISTRY) {
    const k = identityFromSlug(r.slug).key;
    if (byKey.has(k)) dupKeys.add(k);
    else byKey.set(k, r.slug);
  }
  for (const s of OFF_REGISTRY_SET) {
    const k = identityFromSlug(s).key;
    if (!byKey.has(k)) byKey.set(k, s);
  }

  const rows = await prisma.condoBuilding.findMany({
    select: {
      slug: true, name: true, displayName: true, buildingAddress: true,
      streetNumber: true, streetName: true, streetSlug: true,
    },
    orderBy: { slug: "asc" },
  });

  console.log(`── the population ──`);
  console.log(`CondoBuilding rows                 ${rows.length}`);
  console.log(`registry streets                   ${MILTON_STREET_REGISTRY.length} (duplicate identity keys: ${dupKeys.size})`);
  console.log(`off-registry allowlist             ${OFF_REGISTRY_SET.size}`);

  const filled = (k: keyof (typeof rows)[number]) => rows.filter((r) => r[k] != null && String(r[k]).trim() !== "").length;
  console.log(`\n── which columns are actually populated ──`);
  for (const k of ["name", "displayName", "buildingAddress", "streetNumber", "streetName", "streetSlug"] as const) {
    console.log(`${k.padEnd(34)}${filled(k)} of ${rows.length}`);
  }

  // Does displayName differ from buildingAddress anywhere? The schema comment says it was
  // backfilled equal to it. If that still holds, there is one raw string, not two.
  const differs = rows.filter((r) => (r.displayName ?? "") !== (r.buildingAddress ?? ""));
  console.log(`displayName differs from buildingAddress   ${differs.length}`);
  for (const r of differs.slice(0, 10)) console.log(`   ${r.slug}  displayName=${JSON.stringify(r.displayName)}  buildingAddress=${JSON.stringify(r.buildingAddress)}`);

  console.log(`\n── raw forms, first 12 ──`);
  for (const r of rows.slice(0, 12)) {
    console.log(`   ${String(r.buildingAddress ?? r.displayName ?? "").padEnd(34)} n=${String(r.streetNumber ?? "-").padEnd(6)} streetName=${JSON.stringify(r.streetName)} streetSlug=${JSON.stringify(r.streetSlug)}`);
  }

  // ── the parse ────────────────────────────────────────────────────────────────
  // Two independent routes to a registry slug, reported separately so we learn whether the
  // stored streetSlug is trustworthy on its own or whether the address has to be re-parsed.
  type Out = {
    slug: string; raw: string; number: string | null;
    viaColumn: string | null; viaParse: string | null; agree: boolean;
    resolved: string | null; source: string | null; display: string | null;
  };
  const out: Out[] = [];

  for (const r of rows) {
    const raw = (r.buildingAddress ?? r.displayName ?? r.name ?? r.slug ?? "").trim();

    // route 1: the stored streetSlug column
    const viaColumn = r.streetSlug && byKey.has(identityFromSlug(r.streetSlug).key) ? r.streetSlug : null;

    // route 2: re-parse the raw address, then bridge on the identity key
    const parsed = parseAddress(raw);
    const viaParse = parsed ? byKey.get(parsed.identity.key) ?? null : null;

    const chosen = viaColumn ?? viaParse;
    const number = parsed ? String(parsed.number) : (r.streetNumber ?? null);
    let resolved: string | null = null;
    let source: string | null = null;
    if (chosen) {
      const rn = resolveStreetName(chosen);
      resolved = rn.name;
      source = rn.source;
    }
    out.push({
      slug: r.slug, raw, number,
      viaColumn, viaParse,
      agree: viaColumn != null && viaParse != null && viaColumn === viaParse,
      resolved, source,
      display: resolved && number ? `${number} ${resolved}` : null,
    });
  }

  const registry = out.filter((o) => o.source === "registry");
  const offReg = out.filter((o) => o.source === "off-registry");
  const fallback = out.filter((o) => o.source === "fallback");
  const failed = out.filter((o) => o.source === null || o.display === null);

  console.log(`\n── resolution ──`);
  console.log(`resolve through the REGISTRY               ${registry.length} of ${rows.length}`);
  console.log(`resolve through the OFF-REGISTRY allowlist ${offReg.length}`);
  console.log(`land on the FALLBACK chain                 ${fallback.length}`);
  console.log(`FAIL to produce "number + name"            ${failed.length}`);

  console.log(`\n── the two routes against each other ──`);
  console.log(`stored streetSlug usable                   ${out.filter((o) => o.viaColumn).length}`);
  console.log(`re-parse of the address usable             ${out.filter((o) => o.viaParse).length}`);
  console.log(`both present and AGREE                     ${out.filter((o) => o.agree).length}`);
  const disagree = out.filter((o) => o.viaColumn && o.viaParse && o.viaColumn !== o.viaParse);
  console.log(`both present and DISAGREE                  ${disagree.length}`);
  for (const o of disagree) console.log(`   ${o.slug}  raw=${JSON.stringify(o.raw)}  column=${o.viaColumn}  parse=${o.viaParse}`);
  const onlyParse = out.filter((o) => !o.viaColumn && o.viaParse);
  console.log(`column missing, parse rescued              ${onlyParse.length}`);
  for (const o of onlyParse.slice(0, 12)) console.log(`   ${o.slug}  raw=${JSON.stringify(o.raw)}  ->  ${o.viaParse}`);
  const onlyColumn = out.filter((o) => o.viaColumn && !o.viaParse);
  console.log(`parse failed, column rescued               ${onlyColumn.length}`);
  for (const o of onlyColumn.slice(0, 12)) console.log(`   ${o.slug}  raw=${JSON.stringify(o.raw)}  ->  ${o.viaColumn}`);

  if (failed.length) {
    console.log(`\n── FAILURES, with the raw string ──`);
    for (const o of failed) {
      console.log(`   ${o.slug.padEnd(38)} raw=${JSON.stringify(o.raw)}  number=${o.number ?? "-"}  column=${o.viaColumn ?? "-"}  parse=${o.viaParse ?? "-"}`);
    }
  }

  // ── what would actually change on screen ─────────────────────────────────────
  const changed = out.filter((o) => o.display && o.display !== o.raw);
  const same = out.filter((o) => o.display && o.display === o.raw);
  console.log(`\n── what the display rule would change ──`);
  console.log(`H1 text CHANGES                            ${changed.length}`);
  console.log(`H1 text already correct                    ${same.length}`);
  console.log(`\n   raw  ->  proposed`);
  for (const o of changed) console.log(`   ${o.raw.padEnd(34)} ->  ${o.display}`);

  // ── the direction question ───────────────────────────────────────────────────
  // parseAddress POPS a trailing direction, and the registry carries only two directional
  // streets in 944. So the rule as briefed drops every direction in the stored strings. That is
  // only safe if those directions are feed noise. This measures it: a direction is suspect when
  // one street carries MORE THAN ONE of them across its buildings, because a street cannot be
  // East and West and South at once.
  const DIR = new Set(["e","w","n","s","east","west","north","south"]);
  const dirRows = rows
    .map((r) => ({ raw: (r.buildingAddress ?? "").trim(), slug: r.streetSlug ?? "" }))
    .map((r) => {
      const head = r.raw.replace(/^\d+\s+/, "").trim();
      const last = head.split(/\s+/).pop() ?? "";
      const isDir = DIR.has(last.toLowerCase());
      return { ...r, dir: isDir ? last.toUpperCase()[0] : null };
    });
  const withDir = dirRows.filter((r) => r.dir);
  console.log(`
── the direction question ──`);
  console.log(`buildings whose raw string ends in a direction   ${withDir.length} of ${rows.length}`);
  const byStreet = new Map<string, Set<string>>();
  const totalByStreet = new Map<string, number>();
  for (const r of dirRows) {
    totalByStreet.set(r.slug, (totalByStreet.get(r.slug) ?? 0) + 1);
    if (r.dir) {
      if (!byStreet.has(r.slug)) byStreet.set(r.slug, new Set());
      byStreet.get(r.slug)!.add(r.dir);
    }
  }
  const contradictory = [...byStreet.entries()].filter(([, d]) => d.size > 1);
  console.log(`streets carrying MORE THAN ONE direction        ${contradictory.length}  <- cannot all be real`);
  for (const [slug, d] of contradictory) {
    console.log(`   ${slug.padEnd(30)} {${[...d].sort().join(",")}}  over ${totalByStreet.get(slug)} buildings`);
    for (const r of dirRows.filter((x) => x.slug === slug)) console.log(`      ${r.raw}`);
  }
  const single = [...byStreet.entries()].filter(([, d]) => d.size === 1);
  console.log(`streets carrying exactly ONE direction          ${single.length}`);
  for (const [slug, d] of single) {
    const n = dirRows.filter((x) => x.slug === slug).length;
    const withD = dirRows.filter((x) => x.slug === slug && x.dir).length;
    console.log(`   ${slug.padEnd(30)} {${[...d][0]}}  on ${withD} of ${n} buildings on that street`);
  }

  // Does a directional variant exist ANYWHERE as an entity? registry, off-registry, StreetContent.
  console.log(`
── do directional variants exist as entities? ──`);
  const scRows = await prisma.streetContent.findMany({ select: { streetSlug: true, status: true } });
  const scSlugs = new Set(scRows.map((r) => r.streetSlug));
  const scPublished = new Set(scRows.filter((r) => r.status === "published").map((r) => r.streetSlug));
  const regSlugs = new Set(MILTON_STREET_REGISTRY.map((r) => r.slug));
  for (const slug of [...new Set(dirRows.filter((r) => r.dir).map((r) => r.slug))].sort()) {
    const stem = slug.replace(/-milton$/, "");
    const type = stem.split("-").pop();
    const base = stem.slice(0, stem.length - (type?.length ?? 0) - 1);
    const variants = ["east", "west", "north", "south"].flatMap((d) => [`${base}-${type}-${d}-milton`, `${stem}-${d}-milton`]);
    const found = variants.filter((v) => regSlugs.has(v) || OFF_REGISTRY_SET.has(v) || scSlugs.has(v));
    console.log(`   ${slug.padEnd(30)} directional entity: ${found.length ? found.map((f) => `${f}${scPublished.has(f) ? " (PUBLISHED)" : scSlugs.has(f) ? " (row, unpublished)" : " (registry/off-registry only)"}`).join(", ") : "NONE"}`);
  }

  // Stored strings that are simply dirty, direction aside.
  console.log(`
── dirty raw strings ──`);
  for (const r of rows) {
    const raw = (r.buildingAddress ?? "").trim();
    if (/[^A-Za-z0-9 .'\-]/.test(raw)) console.log(`   ${r.slug.padEnd(38)} ${JSON.stringify(raw)}`);
  }

  // ── the resolver, once it exists ─────────────────────────────────────────────
  const { resolveCondoName } = await import("../src/lib/condoName");
  console.log(`
── resolveCondoName over all ${rows.length} rows ──`);
  const res = rows.map((r) => ({ r, n: resolveCondoName({ slug: r.slug, streetNumber: r.streetNumber, streetSlug: r.streetSlug, buildingAddress: r.buildingAddress }) }));
  const bySource = new Map<string, number>();
  for (const { n } of res) bySource.set(n.source, (bySource.get(n.source) ?? 0) + 1);
  for (const [k, v] of [...bySource.entries()].sort()) console.log(`   source=${k.padEnd(14)} ${v}`);
  console.log(`   carry a Town direction   ${res.filter((x) => x.n.direction).length}`);
  console.log(`   disagreements (agrees=false) ${res.filter((x) => !x.n.agrees).length}`);
  console.log(`   rows with issues         ${res.filter((x) => x.n.issues.length).length}`);
  for (const { r, n } of res.filter((x) => x.n.issues.length)) console.log(`      ${r.slug.padEnd(38)} ${n.issues.join(" | ")}`);
  console.log(`
   raw  ->  resolved`);
  for (const { r, n } of res) console.log(`   ${String(r.buildingAddress).padEnd(34)} ->  ${n.name}${n.direction ? "   [Town dir " + n.direction + "]" : ""}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
