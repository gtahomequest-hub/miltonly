// MC-044: which database URL did an MC-045 runner actually take, and did the pool bite?
// Preloaded with `--require`; prints at exit, after the script's own loadEnvLocal and Prisma
// import have run. Prints the host class and the pool parameters only, never a credential.
const t0 = Date.now();
const errs = [];
const origErr = console.error;
console.error = (...a) => {
  const s = a.map(String).join(" ");
  if (/P2024|P1001|P1017|pool|Timed out fetching a new connection|too many connections/i.test(s)) errs.push(s.slice(0, 160));
  origErr(...a);
};
process.on("exit", (code) => {
  let desc = "DATABASE_URL unset";
  const raw = process.env.DATABASE_URL;
  if (raw) {
    try {
      const u = new URL(raw);
      const pooled = /-pooler\./.test(u.host);
      desc = `${pooled ? "POOLED" : "DIRECT"} host ${u.host.replace(/^([^.]{4})[^.]*/, "$1…")} connection_limit=${u.searchParams.get("connection_limit") ?? "(unset)"} pgbouncer=${u.searchParams.get("pgbouncer") ?? "(unset)"} pool_timeout=${u.searchParams.get("pool_timeout") ?? "(unset)"}`;
    } catch {
      desc = "DATABASE_URL unparseable";
    }
  }
  const also = `VERCEL_ENV=${JSON.stringify(process.env.VERCEL_ENV ?? null)} RESEND_API_KEY ${process.env.RESEND_API_KEY ? "set" : "unset"} AI_PROVIDER=${JSON.stringify(process.env.AI_PROVIDER ?? null)}`;
  process.stdout.write(`\n[runner-probe] exit ${code} after ${((Date.now() - t0) / 1000).toFixed(1)} s; DATABASE_URL at exit: ${desc}; ${also}; pool/connection errors seen: ${errs.length}${errs.length ? " :: " + errs.join(" | ") : ""}\n`);
});
