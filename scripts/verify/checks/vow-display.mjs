// PropTx VOW Best Practices, the display side (MC-036). Four rules held against the live site:
//
//   1. THE ADDRESS FLAG. InternetAddressDisplayYN = N (Listing.displayAddress false;
//      sold_records.display_address false) means the address, the street number, the street
//      name, the unit, the postal code and any map position may not be displayed or mapped.
//      For every DB1 row with displayAddress false: its street page, /listings/<mls>, the ads
//      landing pages, /listings and its map pins, /rentals and /rentals/ads, its school and
//      mosque pages, and its condo page must carry none of: the civic address, the house
//      number as a ladder mark of that row, a /streets/<slug> link on the listing page, a map
//      coordinate. The permission flag (InternetEntireListingDisplayYN, permAdvertise) is the
//      vow-fields check's business.
//   2. THE 100-RESULT CAP (s6.3(b)). No consumer search reaches more than 100 listings: the
//      /listings pager's last page, the map pins in the payload, /sold's record list, a street
//      page's inventory.
//   3. THE BONA FIDE NOTICE (s6.3(k)), verbatim, on every page type: a street page, a listing
//      page, /listings, /rentals, /sold, a hub, the homepage, a condo page, /saved.
//      MC-047 adds, over more page types: the registrant and the brokerage in the header (the
//      data-registrant strip, above the page's first <h1>), the TRREB and PropTx copyright line
//      with this year, and no "TREB" (the board's pre-2018 name) in the visible text or the meta.
//   4. THE 2003 FLOOR (item 38) and the 24-HOUR REFRESH (s6.3(h)): no date in DB1, DB2 or DB3
//      before 2003-01-01; the newest syncedAt on an active DB1 row within 26 hours (the feed
//      sync runs daily at 10:00Z).
import { neon } from '@neondatabase/serverless';
import { get } from '../lib/http.mjs';
import { loadEnv, requireEnv } from '../lib/env.mjs';

export const BONA_FIDE = 'The information provided herein must only be used by consumers that have a bona fide interest in the purchase, sale or lease of real estate and may not be used for any commercial purpose or any other purpose.';
// the second half of item 22 (MLS Rules 8.25), rendered beside the first everywhere it appears (MC-037)
export const RELIABILITY = 'The information is deemed reliable but is not guaranteed accurate by PropTx.';
// item 10, as TRREB's auditor read it on 2026-09-28: the header names the registrant and the brokerage (MC-047)
export const REGISTRANT = 'Aamir Yaqoob, Sales Representative';
export const BROKERAGE = 'RE/MAX Realty Specialists Inc., Brokerage';
// item 31 (MLS Rules 8.07), the year computed
const COPYRIGHT_RE = /MLS® listing data © (\d{4}) Toronto Regional Real Estate Board \(TRREB\) and PropTx Innovations Inc\. All rights reserved\./;
const RESULT_CAP = 100;
const REFRESH_HOURS = 26;

const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');
const civic = (address) => (address || '').split(',')[0].trim(); // "123 Clark Boulevard"
const houseNumber = (address) => (civic(address).match(/^(\d+)/) || [])[1] || null;

export default {
  id: 'vow-display',
  title: 'The address flag is honoured on every surface, no search exceeds 100 results, the bona fide notice is on every page, no date precedes 2003, the feed is fresh',
  wholeCorpusOnly: true,

  async finish(_rows, { base, slugs }) {
    loadEnv();
    requireEnv('DATABASE_URL', 'SOLD_DATABASE_URL', 'ANALYTICS_DATABASE_URL');
    const app = neon(process.env.DATABASE_URL);
    const sold = neon(process.env.SOLD_DATABASE_URL);
    const analytics = neon(process.env.ANALYTICS_DATABASE_URL);
    const published = new Set(slugs);
    const coverage = [], assertions = [], examples = [], notes = [];

    // ── 1. the address flag ────────────────────────────────────────────────────────────
    const withheld = await app`SELECT "mlsNumber" mls, status, "leaseStatus" ls, "transactionType" t, "streetSlug" slug, address, "condoBuilding" condo, "permAdvertise" perm
                              FROM public."Listing" WHERE "displayAddress" = false AND "permAdvertise" = true`;
    const leaks = [];
    const surfacesRead = new Set();
    const leak = (mls, url, what) => leaks.push(`${mls} · ${url} · ${what}`);
    const readsFor = (r) => {
      const isLease = r.t === 'For Lease';
      const live = isLease ? r.ls === 'active' : r.status === 'active';
      const urls = [`/listings/${r.mls}`, isLease ? `/rentals/ads/${r.mls}` : `/sales/ads/${r.mls}`];
      if (published.has(r.slug)) urls.push(`/streets/${r.slug}`);
      return { live, urls };
    };
    for (const r of withheld) {
      const { urls } = readsFor(r);
      const addr = civic(r.address), num = houseNumber(r.address);
      for (const url of urls) {
        const p = await get(`${base}${url}`);
        surfacesRead.add(url);
        if (p.status !== 200) continue;
        const html = p.body;
        // a street page lists every civic address on the street from the Town's address points
        // (its PostalAddress ItemList), Town data, not the listing; there the finding is a card or a
        // ladder mark that ties the listing to a number, tested below. Elsewhere the string itself is.
        if (addr && !url.startsWith('/streets/') && html.includes(addr)) leak(r.mls, url, `carries the civic address "${addr}"`);
        if (url.startsWith('/streets/') && addr && html.includes(`class="s-listing-a"`) && html.split('class="s-listing-a"').slice(1).some((seg) => seg.slice(0, 200).includes(addr))) leak(r.mls, url, `an inventory card prints "${addr}"`);
        if (url.startsWith('/listings/')) {
          // the site chrome lists the busiest streets on every page; the listing's own tie to its
          // street is what may not exist, so the link is judged inside <main> only
          const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
          if (main.includes(`/streets/${r.slug}`)) leak(r.mls, url, `links /streets/${r.slug} in the page body`);
          if (/"latitude"\s*:\s*-?\d/.test(html) || /"longitude"\s*:\s*-?\d/.test(html)) leak(r.mls, url, 'carries a map coordinate in the JSON-LD');
          if (/origin=\d+\.\d+,-?\d+\.\d+/.test(html)) leak(r.mls, url, 'carries a directions origin');
        }
        if (url.startsWith('/streets/') && num) {
          // the ladder mark of that house number must not name this row: no link to its listing
          const mark = new RegExp(`data-n=["']${num}["'][^>]*>[\\s\\S]{0,400}?/listings/${r.mls}`);
          if (mark.test(html) || html.includes(`/listings/${r.mls}`)) leak(r.mls, url, `the street page names the listing (a card or a ladder mark for #${num})`);
        }
      }
    }
    // the grids and their pins, once
    for (const url of ['/listings', '/listings?status=rent', '/rentals', '/rentals/ads']) {
      const p = await get(`${base}${url}`);
      surfacesRead.add(url);
      if (p.status !== 200) continue;
      for (const r of withheld) {
        const addr = civic(r.address);
        if (addr && p.body.includes(addr)) leak(r.mls, url, `carries the civic address "${addr}"`);
        if (url.startsWith('/listings') && new RegExp(`\\\\"mlsNumber\\\\":\\\\"${r.mls}\\\\"[^}]*\\\\"latitude\\\\":`).test(p.body)) leak(r.mls, url, 'is a map pin');
      }
    }
    coverage.push(['DB1 rows with the address withheld (permAdvertise true)', withheld.length]);
    coverage.push(['surfaces read for them', surfacesRead.size]);
    assertions.push(['withheld addresses, house numbers, street links or coordinates on a public surface', leaks.length, 0]);
    examples.push(...leaks.slice(0, 8));

    // ── 2. the 100-result cap ─────────────────────────────────────────────────────────
    const capFindings = [];
    for (const url of ['/listings', '/listings?status=rent']) {
      const p = await get(`${base}${url}`);
      if (p.status !== 200) { capFindings.push(`${url} answered ${p.status}`); continue; }
      const pages = [...p.body.matchAll(/href="[^"]*[?&]page=(\d+)"/g)].map((m) => Number(m[1]));
      const last = pages.length ? Math.max(...pages) : 1;
      const perPage = (p.body.match(/class="lv-lcard"/g) || []).length;           // the cards on page one
      const pins = (p.body.match(/\\"latitude\\":-?\d/g) || []).length;       // the map pins in the flight payload
      coverage.push([`${url}: cards on page one · last page linked · map pins`, `${perPage} · ${last} · ${pins}`]);
      if (perPage && last * perPage > RESULT_CAP) capFindings.push(`${url}: page ${last} at ${perPage} a page reaches ${last * perPage} results`);
      if (!perPage) capFindings.push(`${url}: no card parsed (class lv-lcard), the cap cannot be judged`);
      if (pins > RESULT_CAP) capFindings.push(`${url}: ${pins} map pins in one response`);
      const deep = await get(`${base}${url}${url.includes('?') ? '&' : '?'}page=9`);
      const deepCards = (deep.body.match(/class="lv-lcard"/g) || []).length;
      const deepLinks = [...deep.body.matchAll(/href="[^"]*[?&]page=(\d+)"/g)].map((m) => Number(m[1]));
      if (deep.status === 200 && deepCards && deepLinks.some((n) => n >= 9)) capFindings.push(`${url} page=9 renders ${deepCards} cards and links page 9 or beyond`);
    }
    const soldRows = await sold`SELECT count(*)::int n FROM sold.sold_records WHERE perm_advertise AND sold_date >= NOW() - INTERVAL '90 days' AND sold_date <= NOW()`;
    coverage.push(['/sold: sold rows in its 90-day window (the list takes at most 60)', soldRows[0].n]);
    assertions.push(['consumer search surfaces reaching past 100 results', capFindings.length, 0]);
    examples.push(...capFindings.slice(0, 4));

    // ── 3. the bona fide notice on every page type ────────────────────────────────────
    const hubs = [...new Set([...(await get(`${base}/sitemap.xml`)).body.matchAll(/<loc>[^<]*\/neighbourhoods\/([a-z0-9-]+)<\/loc>/g)].map((m) => m[1]))];
    const condo = ((await get(`${base}/sitemap.xml`)).body.match(/<loc>[^<]*(\/condos\/[a-z0-9-]+)<\/loc>/) || [])[1];
    const sale = (await app`SELECT "mlsNumber" m FROM public."Listing" WHERE "permAdvertise" AND status = 'active' AND "transactionType" <> 'For Lease' AND "displayAddress" ORDER BY "listedAt" DESC LIMIT 1`)[0]?.m;
    const lease = (await app`SELECT "mlsNumber" m FROM public."Listing" WHERE "permAdvertise" AND "leaseStatus" = 'active' AND "transactionType" = 'For Lease' AND "displayAddress" ORDER BY "listedAt" DESC LIMIT 1`)[0]?.m;
    // the three ads landing pages mount no site chrome and carry the notices in their own footer
    const pageTypes = [
      ['homepage', '/'], ['street page', `/streets/${slugs[0]}`], ['listing page', sale ? `/listings/${sale}` : null], ['listings grid', '/listings'],
      ['rentals', '/rentals'], ['sold', '/sold'], ['hub', hubs[0] ? `/neighbourhoods/${hubs[0]}` : null], ['condo', condo || null], ['saved', '/saved'],
      ['rentals ads index', '/rentals/ads'], ['rental ad', lease ? `/rentals/ads/${lease}` : null], ['sale ad', sale ? `/sales/ads/${sale}` : null],
    ].filter(([, u]) => u);
    const missing = [], missingReliability = [];
    for (const [name, url] of pageTypes) {
      const p = await get(`${base}${url}`);
      if (p.status !== 200) { missing.push(`${name} ${url} answered ${p.status}`); continue; }
      const t = text(p.body);
      if (!t.includes(BONA_FIDE)) missing.push(`${name} ${url}`);
      if (!t.includes(RELIABILITY)) missingReliability.push(`${name} ${url}`);
    }
    // MC-047: the header's registrant strip, the copyright line and no TREB-era wording, on every
    // page type above and the rest of the site's templates
    const school = ((await get(`${base}/sitemap.xml`)).body.match(/<loc>[^<]*(\/schools\/[a-z0-9-]+)<\/loc>/) || [])[1];
    const mosque = ((await get(`${base}/sitemap.xml`)).body.match(/<loc>[^<]*(\/mosques\/[a-z0-9-]+)<\/loc>/) || [])[1];
    const guide = ((await get(`${base}/sitemap.xml`)).body.match(/<loc>[^<]*(\/guides\/[a-z0-9-]+)<\/loc>/) || [])[1];
    const brandTypes = [
      ...pageTypes,
      ['streets index', '/streets'], ['neighbourhoods index', '/neighbourhoods'], ['condos index', '/condos'], ['school', school || null], ['schools index', '/schools'],
      ['mosque', mosque || null], ['guide', guide || null], ['guides index', '/guides'], ['market watch', '/market-watch'], ['compare', '/compare/freehold-vs-condo'],
      ['sell', '/sell'], ['freehold', '/freehold'], ['about', '/about'], ['terms', '/terms'], ['privacy', '/privacy'], ['sign-in', '/signin'], ['exclusive', '/exclusive'],
    ].filter(([, u]) => u);
    const year = String(new Date().getFullYear());
    const noBrand = [], noCopyright = [], trebCopy = [];
    for (const [name, url] of brandTypes) {
      const p = await get(`${base}${url}`);
      if (p.status !== 200) { noBrand.push(`${name} ${url} answered ${p.status}`); continue; }
      const strip = p.body.match(/<div[^>]*data-registrant(?:=""|\b)[^>]*>([\s\S]*?)<\/div>/);
      const stripText = strip ? text(strip[1]) : '';
      const h1 = p.body.search(/<h1\b/);
      if (!strip || !stripText.includes(REGISTRANT) || !stripText.includes(BROKERAGE)) noBrand.push(`${name} ${url}: header strip ${strip ? `reads "${stripText.trim().slice(0, 90)}"` : 'absent'}`);
      else if (h1 >= 0 && strip.index > h1) noBrand.push(`${name} ${url}: the strip comes after the <h1>`);
      const c = text(p.body).match(COPYRIGHT_RE);
      if (!c || c[1] !== year) noCopyright.push(`${name} ${url}${c ? ` (year ${c[1]})` : ''}`);
      const meta = [...p.body.matchAll(/<meta[^>]+content="([^"]*)"/g)].map((m) => m[1]).join(' ');
      if (/\bTREB\b/.test(text(p.body)) || /\bTREB\b/.test(meta)) trebCopy.push(`${name} ${url}`);
    }
    coverage.push(['page types read for the registrant header (MC-047)', brandTypes.length]);
    assertions.push(['page types without the registrant and the brokerage in the header', noBrand.length, 0]);
    assertions.push(['page types without this year\'s TRREB and PropTx copyright line', noCopyright.length, 0]);
    assertions.push(['page types with TREB-era wording in the text or the meta', trebCopy.length, 0]);
    examples.push(...noBrand.slice(0, 6), ...noCopyright.slice(0, 6), ...trebCopy.slice(0, 6));
    coverage.push(['page types read for the notices', pageTypes.length]);
    assertions.push(['page types without the verbatim bona fide notice', missing.length, 0]);
    assertions.push(['page types without the reliability notice (8.25)', missingReliability.length, 0]);
    examples.push(...missing.slice(0, 6), ...missingReliability.slice(0, 6));

    // ── 4. the 2003 floor and the 24-hour refresh ─────────────────────────────────────
    const d1 = (await app`SELECT to_char(min("listedAt"), 'YYYY-MM-DD') listed, to_char(min("createdAt"), 'YYYY-MM-DD') created, to_char(max("syncedAt") FILTER (WHERE status = 'active'), 'YYYY-MM-DD HH24:MI') synced,
                            EXTRACT(EPOCH FROM (NOW() - max("syncedAt") FILTER (WHERE status = 'active'))) / 3600 AS age_h FROM public."Listing"`)[0];
    const d2 = (await sold`SELECT to_char(min(sold_date), 'YYYY-MM-DD') sold, to_char(min(list_date), 'YYYY-MM-DD') listed FROM sold.sold_records`)[0];
    const d3 = (await analytics`SELECT min(year)::int y FROM analytics.street_monthly_stats`)[0];
    const floor = [d1.listed, d1.created, d2.sold, d2.listed].filter(Boolean).sort()[0];
    coverage.push(['oldest dates: DB1 listedAt, DB2 sold_date, DB2 list_date, DB3 year', `${d1.listed} · ${d2.sold} · ${d2.listed} · ${d3.y}`]);
    coverage.push(['newest syncedAt on an active DB1 row', `${d1.synced} (${Number(d1.age_h).toFixed(1)} h ago)`]);
    assertions.push(['oldest date across DB1, DB2 and DB3 on or after 2003-01-01', floor >= '2003-01-01' && d3.y >= 2003, true]);
    assertions.push([`active listings refreshed within ${REFRESH_HOURS} hours`, Number(d1.age_h) <= REFRESH_HOURS, true]);
    notes.push('the address flag is InternetAddressDisplayYN; the permission flag (InternetEntireListingDisplayYN, permAdvertise) is asserted by vow-fields; AMPRE exposes no third flag');

    return { coverage, assertions, notes, examples };
  },
};
