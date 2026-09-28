// MC-044 evidence: the two desk rows' VOW state, and copeland-circle's 12-month edge. Read-only.
// Every timestamp is rendered as UTC text in SQL (Prisma's timestamp(3) columns hold zone-less UTC).
import fs from "node:fs";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }
const { neon } = await import("@neondatabase/serverless");
const app = neon(process.env.DATABASE_URL), sold = neon(process.env.SOLD_DATABASE_URL), an = neon(process.env.ANALYTICS_DATABASE_URL);
const mask = (e) => e.replace(/^(.{3}).*?(\+[^@]*)?(@.*)$/, (_, a, plus, d) => `${a}…${plus || ""}${d}`);
console.log(`read at ${(await app`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') t`)[0].t} (database clock)`);
console.log("\n== every User row with a VOW agreement or a password (all rows in the table):");
const users = await app`SELECT email, "vowAcknowledgementVersion" v, "isRegistrant" r, "reviewFlag" f,
  to_char("vowAcknowledgedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ack, to_char("registrantAt",'YYYY-MM-DD"T"HH24:MI:SS"Z"') reg,
  to_char("passwordSetAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') pw FROM public."User" ORDER BY email`;
for (const u of users) console.log(`  ${mask(u.email)}: terms v${u.v}, registrant ${u.r} (answered ${u.reg}), reviewFlag ${u.f}, agreed ${u.ack}, password set ${u.pw}`);
console.log(`  (${users.length} User rows in all)`);
console.log("\n== copeland-circle-milton: For Sale records near the 12-month edge, and the stats row");
const edge = await sold`SELECT to_char(NOW() - INTERVAL '12 months','YYYY-MM-DD"T"HH24:MI:SS"Z"') e`;
console.log(`  12-month edge now: ${edge[0].e}`);
for (const r of await sold`SELECT sold_date::text d, (sold_date >= NOW() - INTERVAL '12 months') in12 FROM sold.sold_records WHERE street_slug='copeland-circle-milton' AND perm_advertise AND transaction_type='For Sale' AND sold_date >= NOW() - INTERVAL '13 months' ORDER BY sold_date`)
  console.log(`  sold_date ${r.d} in the 12-month window: ${r.in12}`);
const st = await an`SELECT sold_count_12months c12, to_char(last_updated AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') t FROM analytics.street_sold_stats WHERE street_slug='copeland-circle-milton'`;
console.log(`  analytics.street_sold_stats: sold_count_12months ${st[0].c12}, last_updated ${st[0].t} (a timestamptz)`);
