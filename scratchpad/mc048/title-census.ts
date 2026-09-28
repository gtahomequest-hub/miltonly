// MC-048, read-only: what the new title and meta would be for every published street, before any
// code changes. Run: npx tsx --tsconfig tsconfig.test.json --require ./scripts/_server-only-shim.cjs scratchpad/mc048/title-census.ts
import fs from "node:fs";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*?)\r?$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }
async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const { resolveStreetName } = await import("../../src/lib/streetName");
  const { townAddressesForSlug } = await import("../../src/lib/town/addresses");
  const sd: any = await import("../../src/lib/streetUtils");
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT "streetSlug" s, "streetName" n FROM public."StreetContent" WHERE status='published'`;
  const out: any[] = [];
  for (const r of rows as any[]) {
    const rural = typeof sd.ruralSideRoadName === "function" ? sd.ruralSideRoadName(r.s) : null;
    const name = resolveStreetName(r.s, rural ?? r.n).name;
    const t = townAddressesForSlug(r.s);
    const nums = t ? t.addresses.map((a: any) => a.number) : [];
    const count = nums.length, lo = count ? Math.min(...nums) : null, hi = count ? Math.max(...nums) : null;
    const t1 = `${name}, Milton: homes, sold history, prices | Miltonly`;
    const t2 = `${name}, Milton: homes, sold history | Miltonly`;
    const t3 = `${name}, Milton: homes, sold history`;
    const rung = t1.length <= 65 ? 1 : t2.length <= 65 ? 2 : t3.length <= 65 ? 3 : 4;
    const m1 = count ? `${count} addresses on ${name}, numbered ${lo} to ${hi}. Every one listed, with its sold history for registered readers. Free to register.` : `${name}, Milton: every address on the street, with sold history for registered readers.`;
    const m2 = count ? `${count} addresses on ${name}, numbered ${lo} to ${hi}. Every one listed, with its sold history for registered readers.` : m1;
    out.push({ slug: r.s, name, nameLen: name.length, rung, count, lo, hi, metaLen: m1.length, meta2Len: m2.length, dash: /[–—]/.test(name) });
  }
  const by = (k: string) => out.reduce((a: any, x) => ((a[x[k]] = (a[x[k]] || 0) + 1), a), {});
  console.log("published", out.length, "title rungs", JSON.stringify(by("rung")));
  console.log("no Town addresses:", out.filter((x) => !x.count).length, "| count 1:", out.filter((x) => x.count === 1).length, "| lo==hi with count>1:", out.filter((x) => x.count > 1 && x.lo === x.hi).length);
  console.log("meta over 155 (full):", out.filter((x) => x.metaLen > 155).length, "| still over after dropping the last sentence:", out.filter((x) => x.meta2Len > 155).length);
  console.log("names with an en or em dash:", out.filter((x) => x.dash).map((x) => x.name));
  const longest = out.sort((a, b) => b.nameLen - a.nameLen).slice(0, 6);
  console.log("longest names:", longest.map((x) => `${x.slug} "${x.name}" (${x.nameLen}) rung ${x.rung}`).join("; "));
  console.log("count 1 or no-address examples:", out.filter((x) => (x.count || 0) <= 1).slice(0, 8).map((x) => `${x.slug}:${x.count}`).join(", "));
  fs.writeFileSync("scratchpad/mc048/title-census.json", JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
