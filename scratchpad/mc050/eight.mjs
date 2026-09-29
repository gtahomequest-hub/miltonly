// MC-050, read-only: the eight street pages Google canonicalised to www.747live.bet (MA-011 s5).
// For each: the StreetContent and StreetGeneration rows (when written), the live page (full or
// placeholder, its canonical, robots, title), and the queue. Prints no secret.
import fs from 'node:fs';
for (const f of ['.env', '.env.local']) { if (!fs.existsSync(f)) continue; for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, ''); } }
const { neon } = await import('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
const SLUGS = ['14-side-road-milton','bell-street-milton','cedric-terrace-milton','connaught-terrace-milton','lobelia-crescent-milton','lower-base-line-milton','rowe-terrace-milton','whetham-heights-milton'];
const utc = (c) => `to_char(${c} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"')`;
const sc = await sql.query(`SELECT "streetSlug", "streetName", status, "isVipHub", length(description) dlen, ${utc('"publishedAt"')} pub, ${utc('"generatedAt"')} gen, ${utc('"updatedAt"')} upd, ${utc('"createdAt"')} cre FROM "StreetContent" WHERE "streetSlug" = ANY($1)`, [SLUGS]);
const sg = await sql.query(`SELECT "streetSlug", status::text, "totalWords", ${utc('"generatedAt"')} gen FROM "StreetGeneration" WHERE "streetSlug" = ANY($1)`, [SLUGS]);
const sq = await sql.query(`SELECT * FROM "StreetQueue" WHERE "streetSlug" = ANY($1)`, [SLUGS]).catch((e) => [{ error: e.message.slice(0, 120) }]);
const out = [];
for (const s of SLUGS) {
  const r = await fetch(`https://miltonly.com/streets/${s}`, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; miltonly-mc050)' } });
  const h = await r.text();
  const canon = (h.match(/<link[^>]+rel="canonical"[^>]*>/) || [''])[0];
  const robots = (h.match(/<meta[^>]+name="robots"[^>]*>/) || [''])[0];
  const title = (h.match(/<title>([^<]*)<\/title>/) || ['', ''])[1];
  const h1 = (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || ['', ''])[1].replace(/<[^>]+>/g, '').trim();
  out.push({ slug: s, status: r.status, xcache: r.headers.get('x-vercel-cache'), age: r.headers.get('age'), bytes: h.length, canon, robots, title, h1,
    words: h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    has747: /747live/i.test(h), hasPlaceholderMark: /data-placeholder|coming soon|being prepared/i.test(h),
    sc: sc.find((x) => x.streetSlug === s) || null, sg: sg.find((x) => x.streetSlug === s) || null });
}
fs.writeFileSync('scratchpad/mc050/eight.json', JSON.stringify({ at: new Date().toISOString(), out, queue: sq }, null, 2));
for (const o of out) console.log(o.slug, o.status, o.bytes, 'words', o.words, '|', o.canon, '|', o.robots || 'no robots meta', '| 747:', o.has747, '| ph:', o.hasPlaceholderMark, '| SC', o.sc && `${o.sc.status} dlen ${o.sc.dlen} pub ${o.sc.pub} gen ${o.sc.gen} upd ${o.sc.upd} cre ${o.sc.cre}`, '| SG', o.sg && `${o.sg.status} ${o.sg.totalWords}w ${o.sg.gen}`);
console.log('queue rows', JSON.stringify(sq).slice(0, 600));
