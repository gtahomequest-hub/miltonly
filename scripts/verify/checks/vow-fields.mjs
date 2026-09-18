// THE VOW LINE, MEASURED (MC-029, 2026-09-18).
//
// TRREB's VOW rules keep a set of per-listing facts behind a signed-in, acknowledged consumer:
// days on market, the list date it is subtracted from, the prior price and when it changed,
// whether a listing sold, expired or leased, and the sold price. On 2026-09-18 production
// served all of them to anyone: the listing page's RSC payload carried the whole Prisma row
// (`priorPrice`, `daysOnMarket`, `soldPrice`, `status: "sold"`), the meta description and the
// header said "Listed 65 days ago" and "65d on market", /listings?status=sold listed sold
// homes with their sold prices, /rentals showed leased units, and the Buy menu's price-change
// panel printed each prior price with the direction.
//
// FOUR THINGS, from the served HTML (which carries the RSC payload inline), the JSON of the
// gated route, and a real browser:
//
//   1. ANONYMOUS SEES NONE OF IT. Every listing surface fetched without a cookie: the listing
//      page (an active sale, an active lease, and a sold, an expired and a leased listing, which
//      must all answer the not-available shell, noindex, with no price and no status word),
//      /listings, /listings?status=rent, /rentals, /rent, /rentals/ads, the ad landing pages, the
//      first street page, a hub, a condo page, a school and a mosque page, and the homepage. The
//      menu panels are server-rendered into every one of those. None may carry a VOW-only JSON
//      key, a day count, a "Listed N days ago", a sold price, a prior price or a non-active
//      status. /listings?status=sold answers a redirect to /sold, and the gated route answers
//      canSee:false with no facts.
//   2. AN ACKNOWLEDGED SESSION SEES THEM. The battery mints the session the app would (jose,
//      JWT_SECRET, the app's cookie name) for the most recently acknowledged verified user in
//      DB1, and asserts the gated route answers the facts, the grid's cards carry them, and the
//      listing page's island renders "Time on market" in a real browser.
//   3. THE BROKERAGE IS AS PROMINENT AS THE PRICE (TRREB item 27). In the browser, on the grid,
//      the listing page, a street page, /rentals, the homepage and the menu cards: every
//      [data-brokerage] has a [data-price] ancestor and the two compute to the same font size,
//      weight and colour. Zero brokerage elements on a surface is a finding.
//   4. NO PUBLIC LISTING LACKS THE PERMISSION FLAG. Every /listings/<mls> URL in the live sitemap
//      and every MLS number the public grids link is looked up in DB1: each must be
//      permAdvertise = TRUE and on the market (status active on the sale side, leaseStatus
//      active on the lease side).
//
// Aggregates are allowed and are not what these patterns match: "Typical days on market is
// around 23 days, across 12 sales" and a "Time on market" cell are the k-gated street figures;
// the patterns below match a per-listing count ("65d on market", "Listed 65 days ago") and the
// field names as JSON keys.
import { neon } from '@neondatabase/serverless';
import { SignJWT } from 'jose';
import { get } from '../lib/http.mjs';
import { loadEnv, requireEnv } from '../lib/env.mjs';

const COOKIE_NAME = 'miltonly_session';
const UA = 'miltonly-verify';

/** The withheld columns, as they would appear as JSON keys in an RSC payload (`"daysOnMarket\":`
 *  once escaped inside the flight script, `"daysOnMarket":` in a plain JSON response). */
const VOW_KEYS = ['daysOnMarket', 'listedAt', 'priorPrice', 'priceChangedAt', 'lastPriceChangeAt', 'soldPrice', 'soldDate'];
const keyPattern = (k) => new RegExp(`"${k}\\\\?":`);

/** Per-listing renderings of the same facts. */
const TEXT_PATTERNS = [
  [/\b\d+ ?d on market\b/, 'a day count on market'],
  [/\b\d+ days on market\b/, 'a day count on market'],
  [/\bListed \d+ days? ago\b/, '"Listed N days ago"'],
  [/\bListed today\b/, '"Listed today"'],
  [/\b\d+d ago\b/, '"Nd ago"'],
  // case-sensitive: the badges; "12 new this week" is an aggregate and stays
  [/\bNew this week\b/, '"New this week" on a listing'],
  [/\bNew today\b/, '"New today" on a listing'],
  [/\bSold for\b/, '"Sold for"'],
  [/\bLeased for\b/, '"Leased for"'],
  [/m-mega-prior|m-mega-change|lv-sold-card|lv-soldb|lv-soldnote/, 'a sold or price-change card class'],
  // `"status\":\"sold` inside the escaped flight payload, `"status":"sold` in plain JSON
  [/"status\\?":\\?"(sold|expired|rented)/, 'a non-active status in the payload'],
];

function offences(html) {
  const out = [];
  for (const k of VOW_KEYS) if (keyPattern(k).test(html)) out.push(`key ${k}`);
  for (const [re, label] of TEXT_PATTERNS) {
    const m = html.match(re);
    if (m) out.push(`${label} ("${m[0].slice(0, 40)}")`);
  }
  return out;
}

async function launchBrowser() {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch (e) {
    throw new Error(`puppeteer is not installed: ${e.message}`);
  }
  const opts = { headless: 'new', args: ['--no-sandbox'] };
  try {
    return await puppeteer.launch(opts);
  } catch {
    const fallback = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    return puppeteer.launch({ ...opts, executablePath: fallback });
  }
}

/** The DB1 side: sample MLS numbers per state, the acknowledged user, and the flag lookup. */
async function db1() {
  loadEnv();
  requireEnv('DATABASE_URL', 'JWT_SECRET');
  const app = neon(process.env.DATABASE_URL);
  const one = async (q) => (await q)[0]?.m ?? null;
  const [sale, lease, sold, expired, leased, users] = await Promise.all([
    one(app`SELECT "mlsNumber" m FROM public."Listing" WHERE city='Milton' AND "permAdvertise" AND status='active' AND "transactionType"<>'For Lease' ORDER BY "listedAt" DESC LIMIT 1`),
    one(app`SELECT "mlsNumber" m FROM public."Listing" WHERE city='Milton' AND "permAdvertise" AND "transactionType"='For Lease' AND "leaseStatus"='active' ORDER BY "listedAt" DESC LIMIT 1`),
    one(app`SELECT "mlsNumber" m FROM public."Listing" WHERE city='Milton' AND "permAdvertise" AND status='sold' ORDER BY "updatedAt" DESC LIMIT 1`),
    one(app`SELECT "mlsNumber" m FROM public."Listing" WHERE city='Milton' AND "permAdvertise" AND status='expired' ORDER BY "updatedAt" DESC LIMIT 1`),
    one(app`SELECT "mlsNumber" m FROM public."Listing" WHERE city='Milton' AND "permAdvertise" AND "transactionType"='For Lease' AND "leaseStatus"='leased' ORDER BY "updatedAt" DESC LIMIT 1`),
    app`SELECT id FROM public."User" WHERE verified AND "vowAcknowledgedAt" IS NOT NULL ORDER BY "vowAcknowledgedAt" DESC LIMIT 1`,
  ]);
  if (!sale || !lease) throw new Error('DB1 has no active sale or available lease listing — check the credential, not the data');
  if (!users.length) throw new Error('DB1 has no verified, VOW-acknowledged user to mint a session for');
  return { app, sale, lease, sold, expired, leased, userId: users[0].id };
}

async function mintSession(userId) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ userId }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

async function fetchRaw(url, cookie) {
  const headers = { 'user-agent': UA };
  if (cookie) headers.cookie = `${COOKIE_NAME}=${cookie}`;
  const r = await fetch(url, { headers, redirect: 'manual' });
  return { status: r.status, location: r.headers.get('location') || '', body: r.status === 200 ? await r.text() : '' };
}

const firstHref = (html, prefix) => {
  const m = html.match(new RegExp(`href="(${prefix}[^"?#]+)"`));
  return m ? m[1] : null;
};
const mlsIn = (html) => [...new Set([...html.matchAll(/\/listings\/([A-Z]\d{6,9})\b/g)].map((m) => m[1]))];

export default {
  id: 'vow-fields',
  title: 'VOW-only listing facts reach only an acknowledged session; the brokerage is as prominent as the price; every public listing is advertisable',
  wholeCorpusOnly: true,
  needsHubRecord: true,

  async finish(_rows, { base, slugs, hubRecord }) {
    const assertions = [];
    const coverage = [];
    const examples = [];
    const notes = [];

    const d = await db1();
    const hub = hubRecord.publishedSlugs[0];
    const street = slugs[0];

    // ── the public surfaces ───────────────────────────────────────────────────────────────
    const index = await Promise.all(['/listings', '/rentals', '/condos', '/schools', '/mosques', '/sitemap.xml'].map((p) => get(base + p)));
    const [listingsHtml, rentalsHtml, condosHtml, schoolsHtml, mosquesHtml, sitemap] = index.map((r) => r.body);
    const condo = firstHref(condosHtml, '/condos/');
    const school = firstHref(schoolsHtml, '/schools/');
    const mosque = firstHref(mosquesHtml, '/mosques/');

    const surfaces = [
      ['home', '/'],
      ['grid', '/listings'],
      ['grid rent', '/listings?status=rent'],
      ['grid page 2', '/listings?page=2'],
      ['rentals', '/rentals'],
      ['rent', '/rent'],
      ['rentals ads', '/rentals/ads'],
      ['listing sale', `/listings/${d.sale}`],
      ['listing lease', `/listings/${d.lease}`],
      ['sales ad', `/sales/ads/${d.sale}`],
      ['rental ad', `/rentals/ads/${d.lease}`],
      ['street', `/streets/${street}`],
      ['hub', `/neighbourhoods/${hub}`],
      ['condo', condo],
      ['school', school],
      ['mosque', mosque],
    ];
    const anon = new Map();
    let leaks = 0;
    let read = 0;
    for (const [name, path] of surfaces) {
      if (!path) { examples.push(`${name}: no url to read`); continue; }
      const r = await get(base + path);
      if (r.status !== 200) { examples.push(`${name} ${path} -> ${r.status}`); continue; }
      read++;
      anon.set(name, r.body);
      const found = offences(r.body);
      if (found.length) { leaks++; examples.push(`${name} ${path}: ${found.slice(0, 4).join('; ')}`); }
    }
    coverage.push(['public surfaces read anonymously', `${read} of ${surfaces.length}`]);
    assertions.push(['public surfaces read', read, surfaces.length]);
    assertions.push(['surfaces carrying a VOW-only field anonymously', leaks, 0]);

    // The not-available shell for what is no longer on the market: 200, noindex, no price, no
    // status word, the same words as the display-flag shell.
    let shells = 0;
    let shellOk = 0;
    for (const [name, mls] of [['sold', d.sold], ['expired', d.expired], ['leased', d.leased]]) {
      if (!mls) { notes.push(`no ${name} listing in DB1 to probe`); continue; }
      shells++;
      const r = await get(`${base}/listings/${mls}`);
      const ok = r.status === 200
        && /not available for display/i.test(r.body)
        && /noindex/.test(r.body)
        && !/\$[\d,]{6,}/.test(r.body.replace(/<script[\s\S]*?<\/script>/g, ''))
        && !new RegExp(`\\b(sold|expired|leased)\\b`, 'i').test(r.body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/Recently sold|sold prices|/gi, ''))
        && offences(r.body).length === 0;
      if (ok) shellOk++;
      else examples.push(`${name} listing ${mls}: status ${r.status}, ${offences(r.body).slice(0, 3).join('; ') || 'shell text, noindex or a price or status word missing/present'}`);
    }
    assertions.push(['off-market listings answer the not-available shell', shellOk, shells]);

    const soldRedirect = await fetchRaw(`${base}/listings?status=sold`);
    assertions.push(['/listings?status=sold redirects to /sold', soldRedirect.status >= 300 && soldRedirect.status < 400 && /\/sold(\?|$)/.test(soldRedirect.location) ? 'yes' : `no (${soldRedirect.status} ${soldRedirect.location})`, 'yes']);

    const anonApi = await fetchRaw(`${base}/api/listings/${d.sale}/vow`);
    let anonApiOk = false;
    try {
      const j = JSON.parse(anonApi.body);
      anonApiOk = anonApi.status === 200 && j.canSee === false && !('facts' in j);
    } catch { /* not JSON */ }
    assertions.push(['gated route answers canSee:false, no facts, anonymously', anonApiOk ? 'yes' : `no (${anonApi.status})`, 'yes']);

    // ── the acknowledged session ─────────────────────────────────────────────────────────
    const token = await mintSession(d.userId);
    const authApi = await fetchRaw(`${base}/api/listings/${d.sale}/vow`, token);
    let authFacts = null;
    try { authFacts = JSON.parse(authApi.body); } catch { /* not JSON */ }
    const factsOk = !!(authFacts && authFacts.canSee === true && authFacts.facts
      && Number.isInteger(authFacts.facts.daysOnMarket) && typeof authFacts.facts.listedAt === 'string'
      && 'priorPrice' in authFacts.facts && typeof authFacts.facts.status === 'string');
    assertions.push(['gated route answers the facts to an acknowledged session', factsOk ? 'yes' : `no (${authApi.status} ${authApi.body.slice(0, 80)})`, 'yes']);

    const authGrid = await fetchRaw(`${base}/listings`, token);
    const gridVow = authGrid.status === 200 && /data-vow-facts/.test(authGrid.body) && /\b\d+d on market\b|Listed today/.test(authGrid.body);
    assertions.push(['grid cards carry the facts for an acknowledged session', gridVow ? 'yes' : `no (${authGrid.status})`, 'yes']);
    // and the same page, anonymous, does not (already asserted above; restated as a pair)
    assertions.push(['grid cards carry no facts anonymously', /data-vow-facts/.test(anon.get('grid') || '') ? 'no' : 'yes', 'yes']);

    // ── the flag ─────────────────────────────────────────────────────────────────────────
    const sitemapMls = [...new Set([...sitemap.matchAll(/\/listings\/([A-Z]\d{6,9})</g)].map((m) => m[1]))];
    const linked = [...new Set([...mlsIn(listingsHtml), ...mlsIn(rentalsHtml), ...mlsIn(anon.get('home') || ''), ...mlsIn(anon.get('street') || '')])];
    const all = [...new Set([...sitemapMls, ...linked])];
    coverage.push(['listing URLs checked against DB1', `${all.length} (${sitemapMls.length} sitemap, ${linked.length} linked)`]);
    let notPermitted = -1;
    if (all.length) {
      const rows = await d.app`SELECT "mlsNumber" m FROM public."Listing"
        WHERE "mlsNumber" = ANY(${all}::text[])
          AND NOT ("permAdvertise" AND ((("transactionType" IS DISTINCT FROM 'For Lease') AND status='active') OR ("transactionType"='For Lease' AND "leaseStatus"='active')))`;
      notPermitted = rows.length;
      rows.slice(0, 5).forEach((r) => examples.push(`public listing without the flag or off market: ${r.m}`));
    }
    assertions.push(['public listing URLs found', all.length > 0 ? 'some' : 'none', 'some']);
    assertions.push(['public listings lacking permAdvertise or off market', notPermitted, 0]);

    // ── the browser: brokerage prominence and the island ────────────────────────────────
    const prominence = [
      ['grid', '/listings'],
      ['listing', `/listings/${d.sale}`],
      ['street', `/streets/${street}`],
      ['rentals', '/rentals'],
      ['home', '/'],
    ];
    let measured = 0;
    let mismatches = 0;
    let empty = 0;
    let islandOk = 'not measured';
    let browserError = null;
    try {
      const browser = await launchBrowser();
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        for (const [name, path] of prominence) {
          const res = await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 90000 });
          if (!res || res.status() !== 200) { examples.push(`${name} -> ${res ? res.status() : 'no response'} in the browser`); continue; }
          const r = await page.evaluate(() => {
            const out = { n: 0, bad: [] };
            for (const b of document.querySelectorAll('[data-brokerage]')) {
              out.n++;
              const p = b.closest('[data-price]');
              if (!p) { out.bad.push('no [data-price] ancestor'); continue; }
              const bs = getComputedStyle(b);
              const ps = getComputedStyle(p);
              const diff = ['fontSize', 'fontWeight', 'color', 'fontFamily'].filter((k) => bs[k] !== ps[k]);
              if (diff.length) out.bad.push(`${diff.map((k) => `${k} ${bs[k]} vs ${ps[k]}`).join(', ')}`);
            }
            return out;
          });
          measured++;
          // the menu cards are in every page's HTML; the street page and home carry them too
          if (r.n === 0) { empty++; examples.push(`${name}: no [data-brokerage] element`); }
          if (r.bad.length) { mismatches += r.bad.length; examples.push(`${name}: ${r.bad[0]}`); }
        }
        // the island, signed in
        await page.setCookie({ name: COOKIE_NAME, value: token, url: base });
        await page.goto(`${base}/listings/${d.sale}`, { waitUntil: 'networkidle2', timeout: 90000 });
        await page.waitForSelector('[data-vow-facts]', { timeout: 20000 }).catch(() => null);
        const island = await page.evaluate(() => {
          const el = document.querySelector('[data-vow-facts]');
          return el ? el.textContent : '';
        });
        islandOk = /Time on market/.test(island) && /\d+ days?/.test(island) ? 'yes' : `no (${island.slice(0, 60)})`;
        await page.deleteCookie({ name: COOKIE_NAME, url: base });
      } finally {
        await browser.close();
      }
    } catch (e) {
      browserError = e.message;
    }
    if (browserError) notes.push(`browser: ${browserError}`);
    coverage.push(['surfaces measured for brokerage prominence', `${measured} of ${prominence.length}`]);
    assertions.push(['surfaces measured in the browser', measured, prominence.length]);
    assertions.push(['surfaces with no brokerage element', empty, 0]);
    assertions.push(['brokerage elements differing from their price in size, weight, colour or face', mismatches, 0]);
    assertions.push(['listing page island renders the facts for an acknowledged session', islandOk, 'yes']);

    return { coverage, assertions, examples, notes };
  },
};
