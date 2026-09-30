// MC-046: prove enterVowScriptScope reaches a scoped helper after an await. Prints a count only.
import { loadEnv } from "../../scripts/verify/lib/env.mjs";
import { enterVowScriptScope, soldDb, scopedVowAccess } from "../../src/lib/vow/door";
loadEnv();
enterVowScriptScope();
async function main() {
  await new Promise((r) => setTimeout(r, 10));
  const sd = soldDb(scopedVowAccess())!;
  const rows = (await sd`SELECT COUNT(*)::int AS n FROM sold.sold_records WHERE perm_advertise`) as Array<{ n: number }>;
  console.log(`scope ok after await; sold_records (perm_advertise) count=${rows[0].n}`);
}
main().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
