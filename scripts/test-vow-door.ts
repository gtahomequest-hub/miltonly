// Prebuild test for THE ONE DOOR (MC-046 Stage 1). Every read of VOW data (DB2's sold schema,
// DB3's analytics schema, the non-public rows and VOW-only columns of Listing, and the VOW
// derivatives stored in DB1) goes through src/lib/vow/door.ts, which hands out a connection only
// against a VowAccess, and a VowAccess only to a qualifying reader session, a cron's
// Authorization header, or an offline script.
//
// The behavioural half runs the door: forged, copied, missing and query-string credentials are
// refused, the header is accepted, the scope refuses outside itself, the script path refuses
// inside Next. The structural half reads src/ so that adding a VOW read to an anonymous surface
// by accident fails here:
//   1. only the door names the connection strings or imports a database driver for them, and
//      nothing under src/ imports from outside src/ (so an offline helper cannot be borrowed);
//   2. the three ways in are used only where they belong, and every VOW cron route uses the
//      header-only one;
//   3. SQL on the VOW schemas or tables lives only in modules that take their connection from
//      the door, and every such module (and every module that imports an opener) is a VOW module;
//   4. no client component and no anonymous entry point (pages, layouts, error pages, route
//      handlers, middleware, server actions, OG images, sitemaps) reaches a VOW module;
//   5. DB1: Listing's VOW columns and non-public statuses, raw SQL on Listing, full-row reads of
//      Listing and of the tables that store VOW derivatives, and the derivative columns
//      themselves appear only in allowlisted files, each with its reason.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string) {
  assertions++;
  if (!cond) failures.push(label);
}
const read = (p: string) => readFileSync(p, "utf8");
// Comments out, strings kept. A block comment opens only where `/*` cannot be part of a glob or a
// path inside a string ("src/**/*.ts"), and a line comment only after whitespace or a line start.
const code = (p: string) => read(p).replace(/(^|[\s;{}(),=])\/\*[\s\S]*?\*\//g, "$1").replace(/(^|\s)\/\/.*$/gm, "$1");
const files: string[] = [];
(function walk(d: string) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(n)) files.push(p.replace(/\\/g, "/"));
  }
})("src");
const DOOR = "src/lib/vow/door.ts";
const TAGS = "src/lib/vow/cacheTags.ts";

// ── the allowlists: each file, its reason ────────────────────────────────────────────────────

/** The VOW cron routes: header-only (vowSystemAccess), never an anonymous entry. */
const CRON_ROUTES = new Set([
  "src/app/api/sync/sold/route.ts",
  "src/app/api/sync/sold/test/route.ts",
  "src/app/api/sync/lease/test/route.ts",
  "src/app/api/sync/generate/route.ts",
  "src/app/api/sync/generate/catchup/route.ts",
  "src/app/api/sync/regenerate/route.ts",
  "src/app/api/sync/regenerate-hubs/route.ts",
  "src/app/api/sync/vip-hubs/route.ts",
  "src/app/api/sync/detect/route.ts",
  "src/app/api/sync/expire/route.ts",
  "src/app/api/jobs/compute-sold-stats/route.ts",
  "src/app/api/jobs/compute-board/route.ts",
  "src/app/api/jobs/compute-geni/route.ts",
  "src/app/api/admin/force-regenerate/route.ts",
  "src/app/api/admin/migrate/route.ts",
  "src/app/api/brief/send/route.ts",
  "src/app/api/content/market-watch/route.ts",
  "src/app/api/sync/backfill/route.ts",
]);

/** The gated reader surfaces: each issues vowReaderAccess after its own canSeeVowRecords gate. */
const READER_SURFACES = new Set([
  "src/app/api/sold/route.ts", // the gated sold records
  "src/app/api/sold-stats/route.ts", // gated street stats
  "src/app/api/streets/[slug]/sold-records/route.ts", // the street's gated records island
  "src/app/sold/page.tsx", // the gated records table
  "src/app/listings/page.tsx", // the grid's per-card VOW facts (listingsV2Data selects them only against this access)
  "src/app/api/listings/[mlsNumber]/vow/route.ts", // one listing's VOW facts
  "src/app/api/auth/saved-listings/route.ts", // a saved listing's feed status
]);

/** SQL with no connection of its own: the caller passes one it opened through the door. */
const SQL_BY_INJECTION: Record<string, string> = {
  "src/lib/vow-sync.ts": "runSoldSync takes an SqlExecutor from /api/sync/sold, which opens DB2 through the door",
};

/** Files that query Listing and name a VOW column or a non-public status, or run raw SQL on it. */
const LISTING_ALLOW: Record<string, string> = {
  "src/lib/listings/vow.ts": "the strip and the public predicate: it names every withheld column",
  "src/lib/listingsV2Data.ts": "READER: the grid's VOW-only columns, selected only against requireVowAccess",
  "src/app/api/listings/[mlsNumber]/vow/route.ts": "READER: one listing's VOW facts, after canSeeVowRecords and requireVowAccess",
  "src/app/api/sync/detect/route.ts": "WRITER: the listing sync records status changes (header-only cron)",
  "src/app/api/sync/expire/route.ts": "WRITER: marks listings expired (header-only cron)",
  "src/lib/ai/buildGeneratorInput.ts": "CRON: street generator input (sync/generate, paused by STREET_REGEN_ENABLED)",
  "src/lib/ai/buildHubInput.ts": "CRON: hub generator input and drift (regenerate-hubs)",
  "src/lib/streetDecision.ts": "CRON: the generation gate and its SMS count",
  "src/lib/brief/compose.ts": "CRON: the daily brief, paused under R17",
  "src/app/api/sync/backfill/route.ts": "CRON: counts listing rows of every status to queue generation (header-only)",
  // raw SQL on Listing, each read against the public predicate
  "src/app/streets/page.tsx": "PUBLIC: the index's name and neighbourhood samples, raw SQL with the public predicate inline",
  "src/lib/street-data.ts": "PUBLIC: the first photo of rows already read through PUBLIC_LISTING_WHERE",
};

/** Files that name a VOW derivative stored in DB1. */
const STORED_ALLOW: Record<string, string> = {
  "src/app/admin/review/AdminReviewClient.tsx": "ADMIN: the review desk shows the generation snapshot behind the admin cookie",
  "src/app/api/content/market-watch/route.ts": "CRON: writes the Market Watch edition (header-only)",
  "src/app/market-watch/[weekOf]/page.tsx": "PUBLIC, week only: selects weekOf to answer 200 or 404, never sectionsJson (asserted below)",
  "src/lib/marketWatch/generate.ts": "CRON: composes and stores the edition",
  "src/lib/ai/buildCondoBuildingInput.ts": "CRON: condo generator input",
  "src/lib/ai/buildHubInput.ts": "CRON: reads soldCount12mo for the hub generator",
  "src/lib/ai/hub/generateCondoBuilding.ts": "CRON: writes CondoContent.statsJson",
  "src/lib/ai/hub/generateRuralHub.ts": "CRON: writes HubContent.statsJson",
  "src/lib/ai/hub/generateUrbanHub.ts": "CRON: writes HubContent.statsJson",
  "src/lib/ai/validateCondoGeneration.ts": "CRON: validates a generation against its input",
  "src/lib/generateStreet.ts": "CRON: writes StreetContent.statsJson and StreetGeneration.inputJson",
  "src/types/hub-generator.ts": "TYPE: the hub generator input shape",
};

/** Full-row reads (no `select`) of Listing or of a table that stores a VOW derivative. */
const FULL_ROW_ALLOW: Record<string, string> = {
  "src/app/listings/[mlsNumber]/page.tsx": "STRIP: the listing page reads its row whole, answers the not-available shell unless isPublicListing, and serialises only stripVowFields(row)",
  "src/app/sales/ads/[mlsNumber]/page.tsx": "STRIP: the ads page answers only a public listing and strips the row",
  "src/app/rentals/ads/[mlsNumber]/page.tsx": "STRIP: the ads page answers only a public lease and strips the row",
  "src/app/admin/review/page.tsx": "ADMIN: the review desk, behind the admin cookie",
};

// ── behaviour ─────────────────────────────────────────────────────────────────────────────────
async function behaviour() {
  const door = await import("@/lib/vow/door");
  const saved = { ...process.env };
  // Vercel's build sets VERCEL=1 and Next sets NEXT_PHASE; the positive script check below must
  // not depend on the machine it runs on.
  delete process.env.NEXT_RUNTIME;
  delete process.env.NEXT_PHASE;
  delete process.env.VERCEL;
  try {
    process.env.CRON_SECRET = "door-test-secret";
    const req = (h?: string, q = "") => new Request(`http://localhost/api/sync/sold${q}`, { headers: h ? { authorization: h } : {} });
    ok(door.vowSystemAccess(req("Bearer door-test-secret"))?.principal === "system", "the cron header opens the door");
    ok(door.vowSystemAccess(req("Bearer wrong")) === null, "a wrong header is refused");
    ok(door.vowSystemAccess(req(undefined, "?secret=door-test-secret")) === null, "the right secret as ?secret= is refused (R16)");
    ok(door.vowSystemAccess(req("door-test-secret")) === null, "the secret without Bearer is refused");
    process.env.CRON_SECRET = "door-test-secret\n";
    ok(door.vowSystemAccess(req("Bearer door-test-secret"))?.principal === "system", "a trailing newline in CRON_SECRET does not lock the crons out");
    delete process.env.CRON_SECRET;
    ok(door.vowSystemAccess(req("Bearer undefined")) === null, "no CRON_SECRET configured refuses every caller");
    ok(door.vowReaderAccess(null) === null, "no session, no reader access");
    ok(door.vowReaderAccess({ verified: false } as never) === null, "an unverified user has no reader access");
    const forged = { principal: "system" } as unknown as import("@/lib/vow/door").VowAccess;
    let threw = false;
    try { door.soldDb(forged); } catch { threw = true; }
    ok(threw, "a forged access object is refused by soldDb");
    threw = false;
    try { door.analyticsDb(null as never); } catch { threw = true; }
    ok(threw, "a null access is refused by analyticsDb");
    threw = false;
    try { door.scopedVowAccess(); } catch { threw = true; }
    ok(threw, "outside withVowAccess the scope refuses");
    process.env.CRON_SECRET = "door-test-secret";
    const sys = door.vowSystemAccess(req("Bearer door-test-secret"))!;
    ok(door.withVowAccess(sys, () => door.scopedVowAccess().principal) === "system", "inside withVowAccess the scope answers");
    // A copy of a genuine access, brand symbol and all, is not an access the door issued.
    const copied = Object.fromEntries(Object.getOwnPropertySymbols(sys).map((k) => [k, (sys as unknown as Record<symbol, unknown>)[k]]));
    const copy = Object.assign(copied, { principal: "system" }) as unknown as import("@/lib/vow/door").VowAccess;
    threw = false;
    try { door.soldDb(copy); } catch { threw = true; }
    ok(threw, "a copy of a genuine access (the brand copied across) is refused");
    threw = false;
    try { door.withVowAccess(forged, () => 1); } catch { threw = true; }
    ok(threw, "a forged access cannot open a scope");
    process.env.NEXT_RUNTIME = "nodejs";
    threw = false;
    try { door.vowScriptAccess(); } catch { threw = true; }
    ok(threw, "vowScriptAccess refuses inside a Next server");
    delete process.env.NEXT_RUNTIME;
    process.env.NEXT_PHASE = "phase-production-build";
    threw = false;
    try { door.vowScriptAccess(); } catch { threw = true; }
    ok(threw, "vowScriptAccess refuses inside a Next build");
    delete process.env.NEXT_PHASE;
    process.env.VERCEL = "1";
    ok(door.vowScriptAccess().principal === "script", "vowScriptAccess answers an offline script, even with VERCEL=1 from vercel env pull");
  } catch (e) {
    ok(false, `the behavioural half threw: ${(e as Error).message}`);
  } finally {
    process.env = saved;
  }
}

// ── structure ─────────────────────────────────────────────────────────────────────────────────
function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec).replace(/\\/g, "/").replace(/^.*?\/(src\/)/, "src/");
  else return null;
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (files.includes(cand)) return cand;
  return null;
}
const specsOf = (c: string) => [...c.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g)].map((m) => m[1]);

/** The balanced argument text of every `.<model>.<method>(` call in `c`. */
function callArgs(c: string, model: string, methods: RegExp): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\.${model}\\.(\\w+)\\s*\\(`, "g");
  for (const m of c.matchAll(re)) {
    if (!methods.test(m[1])) continue;
    let depth = 0;
    let i = (m.index ?? 0) + m[0].length - 1;
    const start = i;
    for (; i < c.length; i++) {
      if (c[i] === "(") depth++;
      else if (c[i] === ")" && --depth === 0) break;
    }
    out.push(c.slice(start, i + 1));
  }
  return out;
}

function structure() {
  // 1. The connection strings, the drivers, and the src/ boundary.
  for (const f of files) {
    const c = code(f);
    if (f !== DOOR && f !== TAGS) {
      ok(!/(?<!DB_CACHE_TAG\.)\b(?:SOLD|ANALYTICS)_DATABASE_URL\b/.test(c), `${f} names a VOW connection string (only the door does)`);
    }
    if (/@neondatabase\/serverless|["']pg["']|["']postgres["']|["']@vercel\/postgres["']/.test(c)) ok(f === DOOR, `${f} imports a database driver (only the door opens DB2/DB3; DB1 is Prisma)`);
    ok(!/\bgetSoldDb\b|\bgetAnalyticsDb\b/.test(c), `${f} uses a retired DB2/DB3 accessor`);
    for (const s of specsOf(c)) {
      if (s.startsWith(".")) {
        const abs = resolve(dirname(f), s).replace(/\\/g, "/");
        const inSrc = /\/src\//.test(`${abs}/`) && !/\/(?:scripts|scratchpad)\//.test(`${abs}/`);
        ok(inSrc, `${f} imports ${s}, outside src/`);
      }
    }
    if (f !== DOOR) ok(!/export\s+(?:\*|\{[^}]*\}|type\s+\{[^}]*\})\s+from\s+["'][^"']*vow\/door["']/.test(c), `${f} re-exports the door (one module, no barrels)`);
    if (f !== DOOR) ok(!/^(?:let|var|const)\s+\w+\s*(?::\s*VowAccess\b|=\s*vow(?:Reader|System|Script)Access\s*\()/m.test(c), `${f} keeps a VowAccess in a module-level variable`);
  }

  // 2. The three ways in, only where they belong; every VOW cron route is header-only.
  for (const f of files) {
    if (f === DOOR) continue;
    const c = code(f);
    if (/\bvowSystemAccess\b/.test(c)) ok(CRON_ROUTES.has(f), `${f} issues vowSystemAccess but is not a listed VOW cron route`);
    ok(!/\b(?:vowScriptAccess|enterVowScriptScope)\b/.test(c), `${f} issues a script access (scripts only, never src/)`);
    if (/\bvowReaderAccess\b/.test(c)) ok(READER_SURFACES.has(f), `${f} issues vowReaderAccess but is not an allowlisted gated surface`);
  }
  for (const f of CRON_ROUTES) {
    ok(files.includes(f), `cron route ${f} exists`);
    if (!files.includes(f)) continue;
    const c = code(f);
    ok(/\bvowSystemAccess\(/.test(c), `${f} opens the door by the header (vowSystemAccess)`);
    ok(!/searchParams\.get\(\s*["']secret["']\s*\)/.test(c), `${f} still reads ?secret=`);
  }
  for (const f of READER_SURFACES) ok(files.includes(f) && /\bcanSeeVowRecords\(/.test(code(f)), `${f} gates by canSeeVowRecords before it takes an access`);

  // 3. VOW SQL, and which modules are VOW modules.
  const importsDoor = (c: string) => specsOf(c).some((s) => /(?:^@\/lib\/vow\/door$|(?:^|\/)door$)/.test(s));
  const VOW_SQL = /"?\b(?:sold|analytics)\b"?\."?[a-z_]+|\b(?:sold_records|street_sold_stats|street_monthly_stats|neighbourhood_sold_stats|neighbourhood_monthly_stats|neighbourhood_match_stats|board_stats|listing_scores|street_lease_coverage_log)\b/;
  const OPENERS = ["soldDb", "analyticsDb", "requireSoldDb", "requireAnalyticsDb", "scopedVowAccess", "withVowAccess"];
  const importsOpener = (c: string) =>
    [...c.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["'][^"']*vow\/door["']|const\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*["'][^"']*vow\/door["']\s*\)/g)]
      .some((m) => (m[1] ?? m[2] ?? "").split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).some((n) => OPENERS.includes(n)));
  const vowModules = new Set<string>(Object.keys(SQL_BY_INJECTION));
  for (const f of files) {
    if (f === DOOR || f === TAGS) continue;
    const c = code(f);
    const sql = VOW_SQL.test(c.replace(/^\s*import[^;]*;/gm, ""));
    if (sql) ok(importsDoor(c) || f in SQL_BY_INJECTION, `${f} holds SQL on the VOW schemas or tables without taking its connection from the door`);
    if (sql || importsOpener(c)) vowModules.add(f);
  }
  ok(vowModules.size >= 15, `the scan found the VOW modules (${vowModules.size})`);

  // 4. Reachability: no client component and no anonymous entry point reaches a VOW module.
  const graph = new Map<string, string[]>();
  for (const f of files) graph.set(f, specsOf(code(f)).map((s) => resolveImport(f, s)).filter((x): x is string => !!x));
  const reaches = (start: string): string | null => {
    const seen = new Set<string>();
    const stack = [...(graph.get(start) ?? [])];
    while (stack.length) {
      const f = stack.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      if (vowModules.has(f)) return f;
      for (const n of graph.get(f) ?? []) stack.push(n);
    }
    return null;
  };
  for (const f of files) {
    if (/^\s*["']use client["']/.test(read(f))) {
      const hit = vowModules.has(f) ? f : reaches(f);
      ok(!hit, `client component ${f} reaches a VOW module: ${hit}`);
    }
  }
  const ENTRY = /^src\/app\/(?:.*\/)?(page|layout|not-found|error|global-error|route|opengraph-image|twitter-image|icon|sitemap|robots|manifest)\.tsx?$|^src\/middleware\.ts$/;
  let entries = 0;
  for (const f of files) {
    const isEntry = ENTRY.test(f) || /^\s*["']use server["']/.test(read(f));
    if (!isEntry || CRON_ROUTES.has(f) || READER_SURFACES.has(f)) continue;
    entries++;
    const hit = vowModules.has(f) ? f : reaches(f);
    ok(!hit, `anonymous entry ${f} reaches a VOW module: ${hit}`);
  }
  ok(entries >= 90, `the entry scan found the app's pages, routes and actions (${entries})`);

  // 5. DB1.
  const LISTING_QUERY = /\.listing\.(?:findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow|count|groupBy|aggregate|update|updateMany|upsert|create|createMany|delete|deleteMany)\b/;
  const RAW_LISTING = /\$(?:queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)[\s\S]{0,400}?"Listing"/;
  const NON_PUBLIC = `["'](?:sold|expired|rented|leased|terminated|cancelled|suspended|withdrawn)["']`;
  const LISTING_VOW = new RegExp(
    `\\b(?:soldPrice|soldDate|daysOnMarket|priorPrice|priceChangedAt|lastPriceChangeAt)\\b` +
      `|\\b(?:status|leaseStatus)\\s*:\\s*(?:\\{[^}]*?)?${NON_PUBLIC}` +
      `|\\b(?:status|leaseStatus)\\s*:\\s*\\{\\s*(?:not|notIn)\\s*:` +
      `|\\bNOT\\s*:\\s*\\{[^}]*\\b(?:status|leaseStatus)\\b`,
  );
  const STORED_VOW = /\b(?:soldCount12mo|recencyWeightedSold|statsJson|marketEdition|MarketEdition|inputJson)\b/;
  const FIND = /^find(?:Unique|First|Many)(?:OrThrow)?$/;
  const FULL_ROW_MODELS = ["listing", "hubContent", "condoContent", "streetContent", "streetGeneration", "marketEdition", "residentialStreet"];
  for (const f of files) {
    const c = code(f);
    if ((LISTING_QUERY.test(c) && LISTING_VOW.test(c)) || RAW_LISTING.test(c)) ok(f in LISTING_ALLOW, `${f} queries Listing and names a VOW column or a non-public status, or runs raw SQL on it, but is not allowlisted`);
    if (STORED_VOW.test(c)) ok(f in STORED_ALLOW, `${f} names a stored VOW derivative, but is not allowlisted`);
    for (const model of FULL_ROW_MODELS) {
      for (const args of callArgs(c, model, FIND)) {
        if (!/\bselect\s*:/.test(args)) ok(f in FULL_ROW_ALLOW || CRON_ROUTES.has(f) || f in STORED_ALLOW || f in LISTING_ALLOW, `${f} reads whole ${model} rows (no select), which carry VOW columns, but is not allowlisted`);
      }
    }
  }
  for (const f of [...Object.keys(LISTING_ALLOW), ...Object.keys(STORED_ALLOW), ...Object.keys(FULL_ROW_ALLOW), ...Object.keys(SQL_BY_INJECTION)]) {
    ok(files.includes(f), `allowlisted ${f} exists (a stale entry is removed, not kept)`);
  }
  for (const [f, why] of Object.entries(LISTING_ALLOW)) {
    if (why.startsWith("READER")) ok(/\b(?:vowReaderAccess|requireVowAccess)\b/.test(code(f)), `${f} reads VOW columns but takes no access from the door`);
    if (why.startsWith("CRON") || why.startsWith("WRITER")) ok(!ENTRY.test(f) || CRON_ROUTES.has(f), `${f} is cron-side but is an anonymous entry point`);
  }
  for (const [f, why] of Object.entries(FULL_ROW_ALLOW)) {
    if (why.startsWith("STRIP")) ok(/\b(?:stripVowFields|isPublicListing)\(/.test(code(f)), `${f} reads whole Listing rows but neither strips nor checks them`);
  }
  ok(!/sectionsJson/.test(code("src/app/market-watch/[weekOf]/page.tsx")), "the Market Watch edition page never reads sectionsJson");
}

(async () => {
  await behaviour();
  structure();
  if (failures.length) {
    console.error(`[vow-door] FAIL: ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`[vow-door] PASS: ${assertions} assertions. One door: DB2/DB3 open only against a VowAccess; no client component and no anonymous entry point reaches a VOW module.`);
})().catch((e) => {
  console.error(`[vow-door] crashed: ${(e as Error).stack ?? e}`);
  process.exit(1);
});
