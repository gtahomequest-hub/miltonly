// MC-042: the three new street pages, asserted on production.
//
//   MSYS_NO_PATHCONV=1 BASE=https://miltonly.com node scratchpad/mc042/assert-prod.mjs
//
// Per page: published and served (sitemap, robots, canonical, h1, the stored prose on the page);
// the two VOW sentences verbatim; the 24-month display window (the constant, the logged-out sold
// table, every machine date, the "~2 years" count against DB2, the out-of-window rows absent,
// the signed-in record list); no withheld address (DB1 and DB2 flags, both directions); the
// 100-result cap (inventory cards, signed-in records). Read-only: GETs, SELECTs, and the
// battery's cached session cookie. It never calls /api/auth/login (three sign-ins an hour).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireEnv, REPO_ROOT } from '../../scripts/verify/lib/env.mjs';
import { DISPLAY_MONTHS as BATTERY_MONTHS } from '../../scripts/verify/lib/db.mjs';
import { BONA_FIDE, RELIABILITY } from '../../scripts/verify/checks/vow-display.mjs';

const BASE = process.env.BASE || 'https://miltonly.com';
const PAGES = [
  { slug: 'gowland-crescent-milton', name: 'Gowland Crescent' },
  { slug: 'ennisclare-drive-milton', name: 'Ennisclare Drive' },
  { slug: 'jempson-path-milton', name: 'Jempson Path' },
];
const RESULT_CAP = 100;

loadEnv();
requireEnv('DATABASE_URL', 'SOLD_DATABASE_URL');
const app = neon(process.env.DATABASE_URL);
const sold = neon(process.env.SOLD_DATABASE_URL);

const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const iso = (d) => new Date(d).toISOString().slice(0, 10);

let fails = 0;
const out = [];
const say = (s) => { out.push(s); console.log(s); };
const check = (ok, label, detail = '') => { if (!ok) fails++; say(`   ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` · ${detail}` : ''}`); };

// ── the window: the app constant, read from source, must equal the battery's mirror ─────────
const vowSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/lib/vowWindow.ts'), 'utf8');
const VOW_DISPLAY_MONTHS = Number((vowSrc.match(/export const VOW_DISPLAY_MONTHS: number \| null = (\d+);/) || [])[1]);
const now = new Date();
const cutoff = new Date(now); cutoff.setUTCMonth(cutoff.getUTCMonth() - VOW_DISPLAY_MONTHS);
const CUTOFF = iso(cutoff);
say(`MC-042 prod assertions · ${BASE} · ${now.toISOString()}`);
say(`VOW_DISPLAY_MONTHS = ${VOW_DISPLAY_MONTHS} (src/lib/vowWindow.ts), battery mirror ${BATTERY_MONTHS}; cutoff ${CUTOFF}`);
check(VOW_DISPLAY_MONTHS === 24 && BATTERY_MONTHS === VOW_DISPLAY_MONTHS, 'the display window is 24 months in the app and in the battery');

const served = await fetch(`${BASE}/api/build`).then((r) => r.json());
say(`served ${served.commit} built ${served.builtAt}`);

const sitemapXml = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text());
const locs = new Set([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
say(`sitemap: ${locs.size} URLs, ${[...locs].filter((l) => l.includes('/streets/')).length} streets`);

// ── the signed-in session: the battery's cached cookie, checked, never re-issued ────────────
const cookieFile = path.join(os.tmpdir(), `miltonly-verify-session-${new URL(BASE).host}.txt`);
let token = null;
try { token = fs.readFileSync(cookieFile, 'utf8').trim() || null; } catch { /* absent */ }
let me = null;
if (token) {
  me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `miltonly_session=${token}` } }).then((r) => r.json()).catch(() => null);
}
const signedIn = !!me?.user;
say(`signed-in session: ${signedIn ? 'valid (cached battery cookie)' : 'NOT AVAILABLE, the signed-in half is skipped and reported'}`);

for (const { slug, name } of PAGES) {
  say(`\n── /streets/${slug}`);
  const res = await fetch(`${BASE}/streets/${slug}`, { headers: { 'user-agent': 'miltonly-verify MC-042' } });
  const html = await res.text();
  const body = text(html);
  const cache = res.headers.get('x-vercel-cache');

  // 1. published and served
  const [row] = await app`SELECT status, "needsReview", template, to_char("publishedAt",'YYYY-MM-DD HH24:MI') p FROM public."StreetContent" WHERE "streetSlug"=${slug}`;
  const [gen] = await app`SELECT status, "sectionsJson" s FROM public."StreetGeneration" WHERE "streetSlug"=${slug}`;
  check(res.status === 200, 'status 200', `${res.status}, x-vercel-cache ${cache}`);
  check(row?.status === 'published' && row?.needsReview === false, 'StreetContent published, needsReview false', `${row?.status} · needsReview ${row?.needsReview} · ${row?.template} · publishedAt ${row?.p}Z`);
  check(gen?.status === 'succeeded', 'StreetGeneration succeeded', gen?.status);
  check(locs.has(`${BASE}/streets/${slug}`), 'on the sitemap');
  check(/<meta name="robots" content="index, follow"\/>/.test(html), 'robots index, follow');
  check(html.includes(`<link rel="canonical" href="${BASE}/streets/${slug}"/>`), 'self canonical');
  const h1 = norm(text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || ''));
  check(h1.includes(name), 'h1 carries the registry name', JSON.stringify(h1));
  check(!body.includes('No written profile yet'), 'the written profile renders (no placeholder)');
  // The page renders the stored prose with every numeric sentence cut (src/lib/streetV2Data.ts
  // stripNumericParagraphs, by design), so the assertion runs the other way: every sentence the
  // page renders in the profile must be a sentence of the stored generation, in the same section.
  const sentences = (s) => norm(s).split(/(?<=[.!?])\s+/).filter(Boolean);
  const stored = new Map((Array.isArray(gen?.s) ? gen.s : []).map((sec) => [sec.id, (sec.paragraphs || []).flatMap(sentences)]));
  const rendered = [];
  for (const chunk of html.split('<div class="s-prose-sec"').slice(1)) {
    const id = (chunk.match(/^[^>]*id="s-([A-Za-z]+)"/) || [])[1];
    const inner = chunk.slice(0, chunk.indexOf('</div>'));
    for (const m of inner.matchAll(/<p>([\s\S]*?)<\/p>/g)) for (const s of sentences(text(m[1].replace(/<!-- -->/g, '')))) rendered.push({ id, s });
  }
  const foreign = rendered.filter(({ id, s }) => !(stored.get(id) || []).includes(s));
  const storedN = [...stored.values()].reduce((a, v) => a + v.length, 0);
  check(rendered.length > 0 && foreign.length === 0, 'every rendered profile sentence is a stored generated sentence of its section',
    `${rendered.length} rendered of ${storedN} stored (${storedN - rendered.length} cut at render by stripNumericParagraphs) in ${new Set(rendered.map((r) => r.id)).size} sections` +
    (foreign.length ? ` · FOREIGN: ${foreign.slice(0, 3).map((f) => `[${f.id}] ${f.s.slice(0, 80)}`).join(' | ')}` : ''));

  // 2. the two VOW sentences
  const island = /<p class="s-r-bona">The information provided herein must only be used by consumers that have a bona fide interest in the purchase, sale or lease of real estate and may not be used for any commercial purpose or any other purpose\. The information is deemed reliable but is not guaranteed accurate by PropTx\.<\/p>/.test(html);
  const footer = /<span data-vow-notice="true">The information provided herein[^<]*?any other purpose\. The information is deemed reliable but is not guaranteed accurate by PropTx\.<\/span>/.test(html);
  const nBona = body.split(BONA_FIDE).length - 1;
  const nRel = body.split(RELIABILITY).length - 1;
  check(nBona >= 1 && nRel >= 1, 'bona fide notice AND the PropTx reliability sentence in the page text', `bona fide ×${nBona}, PropTx ×${nRel}`);
  check(island && footer, 'both sentences at both sites: the sold-records island and the footer', `island ${island}, footer ${footer}`);

  // 3. the 24-month window
  const tbodyEmpty = /<table class="s-rtable">[\s\S]*?<tbody><\/tbody>/.test(html);
  check(tbodyEmpty, 'logged out, the sold table renders no rows (no individual sold record unauthenticated)');
  const dates = [...new Set(html.match(/\b20\d\d-\d\d-\d\d\b/g) || [])].sort();
  const early = dates.filter((d) => d < CUTOFF);
  check(early.length === 0, `every machine date on the page is on or after ${CUTOFF}`, dates.join(', ') || 'none');
  const monthYears = [...new Set(body.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December) (20\d\d)\b/g) || [])];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const earlyMY = monthYears.filter((m) => { const [mo, y] = m.split(' '); return `${y}-${String(MONTHS.indexOf(mo) + 1).padStart(2, '0')}` < CUTOFF.slice(0, 7); });
  check(earlyMY.length === 0, 'no month-year in the page text before the window', monthYears.join(', ') || 'none');
  const years = [...new Set((body.match(/\b(19|20)\d\d\b/g) || []))].sort();
  say(`   info  four-digit years in the page text: ${years.join(', ') || 'none'}`);

  const siblings = (await sold`SELECT DISTINCT street_slug FROM sold.sold_records WHERE street_slug = ${slug} OR street_slug LIKE ${slug.replace(/-milton$/, '') + '-%-milton'}`).map((r) => r.street_slug);
  const sib = siblings.length ? siblings : [slug];
  const [w24] = await sold`SELECT COUNT(*)::int n FROM sold.sold_records WHERE street_slug = ANY(${sib}::text[]) AND perm_advertise = TRUE AND transaction_type = 'For Sale' AND sold_date >= NOW() - (INTERVAL '1 month' * ${VOW_DISPLAY_MONTHS}) AND sold_date <= NOW() AND sold_price IS NOT NULL`;
  const [w12] = await sold`SELECT COUNT(*)::int n FROM sold.sold_records WHERE street_slug = ANY(${sib}::text[]) AND perm_advertise = TRUE AND transaction_type = 'For Sale' AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW() AND sold_price IS NOT NULL`;
  const twoYr = [...html.matchAll(/across (\d+) sales in the last ~2 years/g)].map((m) => Number(m[1]));
  say(`   info  DB2 slugs ${sib.join(', ')} · resales in 12 months ${w12.n}, in ${VOW_DISPLAY_MONTHS} months ${w24.n}`);
  if (twoYr.length) check(twoYr.every((n) => n === w24.n) && w24.n >= 5, 'the "~2 years" typical counts exactly the 24-month window and clears k5', `page ${[...new Set(twoYr)].join('/')} · DB2 ${w24.n}`);
  else check(w12.n >= 5 || w24.n < 5, 'no "~2 years" typical: correctly absent (12-month count clears k5, or the 24-month count is under k5)', `12mo ${w12.n}, 24mo ${w24.n}`);

  const outside = await sold`SELECT mls_number, to_char(sold_date,'YYYY-MM-DD') d, transaction_type t, sold_price::bigint p FROM sold.sold_records WHERE street_slug = ANY(${sib}::text[]) AND sold_date < NOW() - (INTERVAL '1 month' * ${VOW_DISPLAY_MONTHS})`;
  const outLeak = outside.filter((r) => html.includes(r.mls_number) || html.includes(r.d));
  check(outLeak.length === 0, `no out-of-window record (older than ${CUTOFF}) on the page by MLS number or date`, `${outside.length} such rows on record${outside.length ? ': ' + outside.map((r) => `${r.d} ${r.t}`).join(', ') : ''}`);

  // 4. withheld addresses, both databases, both directions
  const w1 = await app`SELECT "mlsNumber" mls, address, status FROM public."Listing" WHERE "streetSlug" = ANY(${sib}::text[]) AND "displayAddress" = false`;
  const w2 = await sold`SELECT mls_number mls, address FROM sold.sold_records WHERE street_slug = ANY(${sib}::text[]) AND display_address = false`;
  const leak = [];
  for (const r of [...w1, ...w2]) {
    const civic = (r.address || '').split(',')[0].trim();
    const num = (civic.match(/^(\d+)/) || [])[1];
    if (html.includes(`/listings/${r.mls}`)) leak.push(`${r.mls} linked`);
    for (const m of html.matchAll(/<div class="s-listing-a">([\s\S]*?)<\/div>/g)) if (civic && text(m[1]).includes(civic)) leak.push(`${r.mls} civic in a card`);
    if (num && new RegExp(`id="${num}" class="s-m[^"]*s-on"[^>]*>[\\s\\S]{0,400}?/listings/${r.mls}`).test(html)) leak.push(`${r.mls} ladder mark`);
  }
  check(leak.length === 0, 'no withheld row is linked, carded or placed on the ladder', `withheld on record: DB1 ${w1.length}, DB2 ${w2.length}${leak.length ? ' · ' + leak.join('; ') : ''}`);
  const linked = [...new Set([...html.matchAll(/href="\/listings\/([A-Z]\d{6,})"/g)].map((m) => m[1]))];
  const linkedWithheld = linked.length ? await app`SELECT "mlsNumber" mls FROM public."Listing" WHERE "mlsNumber" = ANY(${linked}::text[]) AND "displayAddress" = false` : [];
  check(linkedWithheld.length === 0, 'no /listings/ link anywhere on the page points at a withheld listing', `${linked.length} listing links checked${linkedWithheld.length ? ': ' + linkedWithheld.map((r) => r.mls).join(', ') : ''}`);

  // 5. the 100-result cap
  const cards = (html.match(/<a class="s-listing" href="\/listings\//g) || []).length;
  check(cards <= RESULT_CAP, `inventory cards at or under ${RESULT_CAP}`, String(cards));

  // signed in: the record list itself
  if (signedIn) {
    const j = await fetch(`${BASE}/api/streets/${slug}/sold-records`, { headers: { cookie: `miltonly_session=${token}` } }).then((r) => r.json());
    const recs = j.records || [];
    const recEarly = recs.filter((r) => String(r.sold_date).slice(0, 10) < CUTOFF);
    check(j.canSee === true, 'signed in, the sold records are served (canSee true)');
    check(recEarly.length === 0, `signed in, every record is inside the window`, `${recs.length} records: ${recs.map((r) => String(r.sold_date).slice(0, 10)).join(', ') || 'none'}`);
    check(recs.length <= RESULT_CAP, `signed in, the record list is at or under ${RESULT_CAP}`, String(recs.length));
    const flags = recs.length ? await sold`SELECT mls_number m, display_address da FROM sold.sold_records WHERE mls_number = ANY(${recs.map((r) => r.mls_number)}::text[])` : [];
    const bad = recs.filter((r) => flags.some((f) => f.m === r.mls_number && f.da === false) && r.address !== 'Address on request');
    check(bad.length === 0, 'signed in, a withheld record reads "Address on request"', `${flags.filter((f) => f.da === false).length} withheld among ${recs.length}`);
  } else {
    say('   SKIP  signed-in record list (no valid cached session; not signing in from here)');
  }
  const lo = await fetch(`${BASE}/api/streets/${slug}/sold-records`).then((r) => r.json());
  check(lo.canSee === false && (lo.records || []).length === 0, 'logged out, the record API serves no records');
}

say(`\n${fails === 0 ? 'PASS' : 'FAIL'} · ${fails} failing assertion(s)`);
fs.writeFileSync(path.join(REPO_ROOT, 'scratchpad/mc042/assert-prod.log'), out.join('\n') + '\n');
process.exit(fails ? 1 : 0);
