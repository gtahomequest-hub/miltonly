// EVERY PAGE TYPE ENDS IN THE SAME FOOTER, AND THE FOOTER IS THE SITE'S MAP.
//
// MA-004 (2026-09-13) measured five page types and found three endings: the homepage and the
// hub carried HomeFooter, the listing page and the guides carried the legacy navy FooterSection
// (thirteen top-level links, a /map that redirected, "Sign in" as the CTA, 10px text at 2.5:1),
// and 509 street pages carried nothing. The guides also served two headers. MH-006 gave every
// page one forest bar and one footer, and this check holds that line, over more page types than
// the audit read, because the chrome is rendered by twenty-odd server components and a
// regression in one of them is invisible on the others.
//
// FOUR THINGS, PER PAGE TYPE, from the served HTML:
//
//   1. ONE FOOTER, ONE BAR. Exactly one <footer class="m-footer">, exactly one forest <nav>
//      (.site-nav or .m-nav), and no navy <header> at all.
//   2. THE MAP. Every published hub is linked from the footer (count == the record's), the
//      street index is linked, and every one of the map's fixed destinations is present: the
//      eight guides, /schools and /mosques, /market-watch, /compare/freehold-vs-condo, /privacy
//      and /terms, and /sold exactly once. A footer that lists three of twenty-two hubs, or
//      drops the legal links, is a footer that failed.
//   3. NO HOP, NO 404. Every footer href resolves 200 with no redirect, fetched once per unique
//      href across every page type. /map and /book are named as findings by themselves: both
//      were redirects the footer carried for weeks.
//   4. HEADINGS AND A FORM. The footer opens with an <h2> and its columns are <h3>s (Lighthouse
//      heading-order failed on the homepage and named the footer's <h4>s), and it carries the
//      search well and the brief form, because a footer on every page is a capture surface.
//
// A parser that reaches nothing must fail on its own coverage: the page-type count is asserted.
import { get } from '../lib/http.mjs';

/** The map's fixed destinations. A footer missing one is a finding. */
const MAP_LINKS = [
  '/streets', '/listings', '/rentals', '/sold', '/sell', '/condos', '/freehold', '/condos-guide', '/potl',
  '/compare', '/compare/freehold-vs-condo', '/schools', '/mosques', '/guides', '/market-watch', '/about', '/privacy', '/terms',
];
const GUIDE_COUNT = 8;
const ONCE = ['/sold'];
const REDIRECTS = ['/map', '/book'];

function footerMarkup(html) {
  const open = html.indexOf('<footer');
  if (open === -1) return '';
  const close = html.indexOf('</footer>', open);
  return close === -1 ? '' : html.slice(open, close + 9);
}
const hrefsIn = (html) => [...html.matchAll(/<a\b[^>]*\bhref="(\/[^"#]*)"/g)].map((m) => m[1]);
const count = (html, re) => (html.match(re) || []).length;

/** One URL per page type. The dynamic ones are read off their index pages so the check never
 *  hardcodes an MLS number or a slug that can expire. */
async function pageTypes(base, slugs, hubRecord) {
  const firstHref = async (path, prefix) => {
    const r = await get(base + path);
    if (r.status !== 200) return null;
    const m = r.body.match(new RegExp(`href="(${prefix}[^"?#]+)"`));
    return m ? m[1] : null;
  };
  const hub = hubRecord.publishedSlugs[0];
  const [listing, condo, school, mosque, edition] = await Promise.all([
    firstHref('/listings', '/listings/[A-Z]'),
    firstHref('/condos', '/condos/'),
    firstHref('/schools', '/schools/'),
    firstHref('/mosques', '/mosques/'),
    firstHref('/market-watch', '/market-watch/'),
  ]);
  return [
    ['homepage', '/'],
    ['street', `/streets/${slugs[0]}`],
    ['hub', `/neighbourhoods/${hub}`],
    ['listing', listing],
    ['guide', '/guides/what-milton-neighbourhoods-cost'],
    ['guides index', '/guides'],
    ['listings index', '/listings'],
    ['streets index', '/streets'],
    ['hubs index', '/neighbourhoods'],
    ['condos index', '/condos'],
    ['condo building', condo],
    ['schools index', '/schools'],
    ['school', school],
    ['mosques index', '/mosques'],
    ['mosque', mosque],
    ['sold', '/sold'],
    ['sell', '/sell'],
    ['value', `/value/${hub}`],
    ['market watch', '/market-watch'],
    ['edition', edition],
    ['compare', '/compare'],
    ['compare flagship', '/compare/freehold-vs-condo'],
    ['freehold', '/freehold'],
    ['condos guide', '/condos-guide'],
    ['potl', '/potl'],
    ['rentals', '/rentals'],
    ['about', '/about'],
    ['exclusive', '/exclusive'],
    ['privacy', '/privacy'],
    ['terms', '/terms'],
  ];
}

export default {
  id: 'footer',
  title: 'Every page type ends in one forest footer that is the site map, under one bar',
  wholeCorpusOnly: true,
  needsHubRecord: true,

  async finish(_rows, { base, slugs, hubRecord }) {
    const types = await pageTypes(base, slugs, hubRecord);
    const hubCount = hubRecord.publishedSlugs.length;
    const read = [], unread = [];
    const chrome = [], hubs = [], map = [], twice = [], redirects = [], headings = [], forms = [];
    const allHrefs = new Set();

    for (const [type, path] of types) {
      if (!path) { unread.push(`${type}: no URL could be derived`); continue; }
      const r = await get(base + path);
      if (r.status !== 200) { unread.push(`${type} ${path} -> ${r.status}`); continue; }
      read.push(type);
      const html = r.body;
      const tag = `${type} ${path}`;

      // 1. one footer, one bar, no navy header
      const footers = count(html, /<footer\b[^>]*class="[^"]*m-footer[^"]*"/g);
      const anyFooter = count(html, /<footer\b/g);
      const bars = count(html, /<nav\b[^>]*class="[^"]*\b(site-nav|m-nav)\b[^"]*"/g);
      const navy = count(html, /<header\b[^>]*class="[^"]*bg-\[#07111f\][^"]*"/g);
      if (footers !== 1 || anyFooter !== 1) chrome.push(`${tag}: ${footers} map footer(s), ${anyFooter} <footer> element(s), expected 1 and 1`);
      if (bars !== 1) chrome.push(`${tag}: ${bars} forest bar(s), expected 1`);
      if (navy) chrome.push(`${tag}: ${navy} navy header(s)`);

      const footer = footerMarkup(html);
      const hrefs = hrefsIn(footer);
      for (const h of hrefs) allHrefs.add(h);

      // 2. the map
      const hubLinks = new Set(hrefs.filter((h) => /^\/neighbourhoods\/[^/]+$/.test(h)));
      if (hubLinks.size !== hubCount) hubs.push(`${tag}: ${hubLinks.size} hub links, expected ${hubCount}`);
      const missing = MAP_LINKS.filter((h) => !hrefs.includes(h));
      if (missing.length) map.push(`${tag}: missing ${missing.join(' ')}`);
      const guideLinks = new Set(hrefs.filter((h) => /^\/guides\/[^/]+$/.test(h)));
      if (guideLinks.size !== GUIDE_COUNT) map.push(`${tag}: ${guideLinks.size} guide links, expected ${GUIDE_COUNT}`);
      for (const h of ONCE) {
        const n = hrefs.filter((x) => x === h).length;
        if (n !== 1) twice.push(`${tag}: ${h} linked ${n} times`);
      }
      for (const h of REDIRECTS) if (hrefs.includes(h)) redirects.push(`${tag}: ${h} is a redirect, not a destination`);

      // 4. headings and forms
      if (!/<h2\b/.test(footer)) headings.push(`${tag}: footer has no <h2>`);
      if (/<h4\b/.test(footer)) headings.push(`${tag}: footer still uses <h4>`);
      if (count(footer, /<h3\b/g) < 4) headings.push(`${tag}: footer has ${count(footer, /<h3\b/g)} <h3> columns, expected at least 4`);
      if (!/<form\b[^>]*class="[^"]*m-fsearch/.test(footer)) forms.push(`${tag}: footer has no search well`);
      if (!/<form\b[^>]*class="[^"]*m-fbrief/.test(footer)) forms.push(`${tag}: footer has no brief form`);
    }

    // 3. every footer href resolves 200 with no hop, once per unique href
    const hrefs = [...allHrefs];
    const dead = [];
    let i = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (i < hrefs.length) {
        const h = hrefs[i++];
        const r = await get(base + h);
        if (r.status !== 200) dead.push(`${h} -> ${r.status}`);
      }
    }));

    return {
      coverage: [
        ['page types read', `${read.length} of ${types.length}: ${read.join(', ')}`],
        ['published hubs (record)', hubCount],
        ['unique footer hrefs resolved', hrefs.length],
      ],
      assertions: [
        ['page types read == derived', read.length, types.length],
        ['pages not serving exactly one map footer under one forest bar', chrome.length, 0],
        ['pages whose footer does not link every published hub', hubs.length, 0],
        ['pages whose footer misses a map destination', map.length, 0],
        ['pages whose footer links /sold more than once', twice.length, 0],
        ['pages whose footer carries a redirect', redirects.length, 0],
        ['pages whose footer headings are not h2 then h3', headings.length, 0],
        ['pages whose footer lacks the search well or the brief form', forms.length, 0],
        ['footer hrefs that do not resolve 200 without a hop', dead.length, 0],
      ],
      examples: [...unread, ...chrome, ...hubs, ...map, ...twice, ...redirects, ...headings, ...forms, ...dead],
    };
  },
};
