// src/lib/canonicalizeResidential.ts
// Registry-backed canonicaliser for residential street identity. Given a raw MLS
// street name (and optional slug), returns the OFFICIAL Town of Milton registry slug
// + name it belongs to — so junk/dupe/typo variants collapse onto one canonical
// entity. Pure (no server-only): safe to import from ws3-backfill (tsx) and app code.
//
// Durability: wired into ws3-backfill so the Step-4-proper cleanup survives the next
// backfill run — the aggregation groups sold rows by canonical slug, not the raw DB2
// street_slug. Off-registry rural roads (OFF_REGISTRY_SET) pass through unchanged.
import { MILTON_STREET_REGISTRY } from "@/data/miltonStreetRegistry";
import { OFF_REGISTRY_SET } from "@/data/offRegistryStreets";

const ABBR: Record<string, string> = { rd:"road",st:"street",ave:"avenue",av:"avenue",blvd:"boulevard",crt:"court",ct:"court",dr:"drive",cres:"crescent",pl:"place",trl:"trail",cir:"circle",ln:"lane",terr:"terrace",ter:"terrace",grv:"grove",hts:"heights",hllw:"hollow",pkwy:"parkway",sdrd:"sideroad",gdns:"garden",gardens:"garden",hwy:"highway",pt:"point",ldg:"landing",cr:"crescent",wy:"way",xing:"crossing",cirle:"circle",cross:"crossing" };
const ORD: Record<string, string> = {"1":"first","1st":"first","2":"second","2nd":"second","3":"third","3rd":"third","4":"fourth","4th":"fourth","5":"fifth","5th":"fifth","6":"sixth","6th":"sixth","7":"seventh","7th":"seventh","8":"eighth","8th":"eighth","9":"ninth","9th":"ninth","10":"tenth","10th":"tenth"};
const DIR = new Set(["e","w","n","s","ne","nw","se","sw","east","west","north","south"]);
const TYPE = new Set(["street","court","crescent","terrace","place","way","road","avenue","gate","lane","heights","landing","boulevard","trail","point","circle","line","crossing","garden","common","path","close","drive","parkway","centre","townline","sideroad","grove","hollow","ridge","hill","view","square","park","walk","mews","row","vale","villas","green"]);
const TRAILJUNK = /^(?:[a-z]|\d+|th\d+|unit\d*|ll|upl|upr|upper|lower|main|bsmt|milton|only|flr)$/;
const JUNK = /\b(unit|apt|apartment|suite|ste|floor|flr|level|lvl|basement|bsmt|bsment|basmt|basemnt|basmnt|basment|ground|rear|loft|penthouse|coach|entire|property|bonus|parking|upr|upl|mn|th\d|unt|con|lot|only)\b|[&#/\[\],]/i;
const LEGAL = /\bcon\b.*\blot\b|concession/i;

function toks(name: string): string[] {
  const s = String(name || "").toLowerCase().replace(/-milton$/, "").replace(/[-_]/g, " ").replace(/[^a-z0-9\s]/g, " ");
  const t = s.split(/\s+/).filter(Boolean).map((x) => ORD[x] || ABBR[x] || x);
  while (t.length > 1 && DIR.has(t[t.length - 1])) t.pop();
  while (t.length > 1 && DIR.has(t[0])) t.shift();
  return t;
}
const norm = (n: string) => toks(n).join(" ");
function baseKey(t: string[]): string { const a = [...t]; while (a.length > 1 && TYPE.has(a[a.length - 1])) a.pop(); return a.join(" "); }
function truncAfterType(rawName: string): string | null {
  const raw = String(rawName || "").toLowerCase().replace(/-milton$/, "").replace(/[-_]/g, " ").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).map((x) => ABBR[x] || x);
  let ti = -1; for (let i = 0; i < raw.length; i++) if (TYPE.has(raw[i])) { ti = i; break; }
  if (ti < 0) return null; let end = ti + 1; while (end < raw.length && DIR.has(raw[end])) end++; return raw.slice(0, end).join(" ");
}
function lev(a: string, b: string): number {
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

const byNorm = new Map<string, { name: string; slug: string }>();
const byBase = new Map<string, Array<{ name: string; slug: string }>>();
const regNorms: string[] = [];
for (const r of MILTON_STREET_REGISTRY) {
  byNorm.set(norm(r.name), { name: r.name, slug: r.slug });
  regNorms.push(norm(r.name));
  const bk = baseKey(toks(r.name)); if (!byBase.has(bk)) byBase.set(bk, []); byBase.get(bk)!.push({ name: r.name, slug: r.slug });
}
const regSlugs = new Set(MILTON_STREET_REGISTRY.map((r) => r.slug));
const nameBySlug = new Map(MILTON_STREET_REGISTRY.map((r) => [r.slug, r.name]));

export type CanonReason = "exact-slug" | "norm" | "base" | "junk-base" | "typo" | "off-registry" | "unmatched" | "legal";
export interface CanonResult {
  canonicalSlug: string;   // official slug when matched; else the input slug unchanged
  canonicalName: string | null; // official name when matched
  matched: boolean;        // true when resolved to a registry street
  offRegistry: boolean;    // true for allowlisted rural/regional roads
  reason: CanonReason;
}

/** Resolve a raw name/slug to its canonical registry identity. Never throws. */
export function canonicalizeResidential(rawName: string, rawSlug?: string): CanonResult {
  if (rawSlug && regSlugs.has(rawSlug)) return { canonicalSlug: rawSlug, canonicalName: nameBySlug.get(rawSlug) ?? null, matched: true, offRegistry: false, reason: "exact-slug" };
  if (rawSlug && OFF_REGISTRY_SET.has(rawSlug)) return { canonicalSlug: rawSlug, canonicalName: null, matched: false, offRegistry: true, reason: "off-registry" };

  const t = toks(rawName);
  let hit = byNorm.get(t.join(" ")); if (hit) return { canonicalSlug: hit.slug, canonicalName: hit.name, matched: true, offRegistry: false, reason: "norm" };
  let bm = byBase.get(baseKey(t)); if (bm && bm.length === 1) return { canonicalSlug: bm[0].slug, canonicalName: bm[0].name, matched: true, offRegistry: false, reason: "base" };
  // trailing-junk strip
  const t2 = [...t]; let stripped = false; while (t2.length > 1 && TRAILJUNK.test(t2[t2.length - 1])) { t2.pop(); stripped = true; }
  if (stripped) { hit = byNorm.get(t2.join(" ")); if (hit) return { canonicalSlug: hit.slug, canonicalName: hit.name, matched: true, offRegistry: false, reason: "norm" }; bm = byBase.get(baseKey(t2)); if (bm && bm.length === 1) return { canonicalSlug: bm[0].slug, canonicalName: bm[0].name, matched: true, offRegistry: false, reason: "base" }; }
  if (LEGAL.test(rawName)) return { canonicalSlug: rawSlug ?? "", canonicalName: null, matched: false, offRegistry: false, reason: "legal" };
  // unit/legal junk → truncate after first type token, re-match the base
  if (JUNK.test(rawName)) { const tb = truncAfterType(rawName); if (tb) { const m2 = byNorm.get(norm(tb)) ?? (byBase.get(baseKey(toks(tb)))?.length === 1 ? byBase.get(baseKey(toks(tb)))![0] : null); if (m2) return { canonicalSlug: m2.slug, canonicalName: m2.name, matched: true, offRegistry: false, reason: "junk-base" }; } }
  // typo — nearest registry name within edit distance 2
  const un = norm(rawName); let best = "", bd = 99; for (const rn of regNorms) { const dd = lev(un, rn); if (dd < bd) { bd = dd; best = rn; } }
  if (bd <= 2) { const m = byNorm.get(best)!; return { canonicalSlug: m.slug, canonicalName: m.name, matched: true, offRegistry: false, reason: "typo" }; }
  return { canonicalSlug: rawSlug ?? "", canonicalName: null, matched: false, offRegistry: false, reason: "unmatched" };
}
