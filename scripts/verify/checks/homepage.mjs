// THE HOMEPAGE HAD NO GATE.
//
// Every other significant surface on this site is verified: 444 street pages, 22 hubs,
// their metas, their JSON-LD, their k-anon floors. The homepage — the page every visitor
// and every crawler reaches first — had nothing. Not one battery check fetched "/" and
// not one of the 19 prebuild tests touched a homepage file. It could only be checked by
// looking at it, which means it could only be checked when somebody remembered to look.
//
// FOUR ASSERTIONS, each encoding a defect this page has actually shipped:
//
//   1. THE LINK FLOOR. On 2026-09-10 production's homepage served 24 unique internal
//      links. All four nav items were <button> elements whose panels mounted on click,
//      so the navigation — the one element present on every page of the site —
//      contributed zero. The floor below is stated as a literal and deliberately sits
//      under the current count with headroom, so ordinary content movement (a week with
//      fewer filmed streets) passes and a structural regression (a footer that truncates
//      its hub list again, a section that stops rendering) fails. See the constant for
//      what this floor cannot catch, and which assertion catches it instead.
//
//   2. THE HEADER IS ANCHORS. Not "the header renders links after hydration" — the
//      served HTML must carry them. Every menu trigger must be an <a href> and every
//      rail link must be present in the nav markup whether or not its panel is open.
//      The panel is progressive enhancement; the links are not.
//
//   3. EVERY FIGURE EQUALS ITS SOURCE. The homepage publishes each neighbourhood's
//      typical sold price. That figure belongs to the hub page, and this asserts the two
//      agree by recomputing the record side from DB2 — the same record hub-meta.mjs
//      checks the hub page itself against. Homepage == record and hub page == record
//      together mean homepage == hub page, without this check having to parse a second
//      template. Suppression is asserted in both directions: a sub-k hood must print no
//      price here, and a hood with a price must not be silent.
//
//   4. THE THREE STRUCTURED-DATA NODES. WebSite, Organization, and a SearchAction on the
//      WebSite. Parsed per node, never grepped: a string match on "Organization" would be
//      satisfied by the word appearing anywhere in 50KB of markup.
//
// The homepage figures are read from `data-fig` attributes rather than from prose. A
// parser that reads rendered copy is a parser that stops reading the moment somebody
// rewords a label, and reports "no findings" while covering nothing.
import { get } from '../lib/http.mjs';

/** THE FLOOR, stated, and what it does and does not catch.
 *
 *  Measured on the built page 2026-09-10: 24 unique internal links before this build,
 *  66 after. 65 of the 66 come from the BODY — the footer duplicates most nav
 *  destinations, so on the homepage specifically the nav adds one unique href. The floor
 *  therefore guards the body's link graph (a truncated footer costs ~19, a section that
 *  stops rendering costs 8 to 22) and it is assertion 2, not this one, that guards the
 *  header. Do not raise this floor to "catch the nav": it cannot, and a floor set just
 *  under the current count fails on an ordinary week with fewer filmed streets.
 *
 *  50 is a little over twice the pre-build baseline and roughly 15 below today's count. */
const LINK_FLOOR = 50;

/** Menu triggers and the rail links each panel must carry in the served HTML. */
const MENU_TRIGGERS = ['/listings', '/streets', '/sell'];
const RAIL_SAMPLE = [
  '/rentals', '/sold', '/condos', '/freehold', '/potl', '/compare', '/exclusive',
  '/neighbourhoods', '/map', '/schools', '/mosques', '/condos-guide', '/about', '/book',
];

/** Unique internal hrefs, excluding build assets — the same rule used to measure the
 *  24-link baseline, so the floor and the count are the same kind of number. */
function internalLinks(html) {
  const hrefs = [...html.matchAll(/<a\b[^>]*\bhref="(\/[^"#]*)"/g)].map((m) => m[1]);
  return new Set(
    hrefs.filter((h) => !h.startsWith('/_next/') && h !== '/favicon.ico' && h !== '/manifest.webmanifest'),
  );
}

/** The <nav> element's own markup. Anchors outside it do not count as header links. */
function navMarkup(html) {
  const open = html.indexOf('<nav');
  if (open === -1) return '';
  const close = html.indexOf('</nav>', open);
  return close === -1 ? '' : html.slice(open, close + 6);
}

/** Every `data-fig` figure on the page: { fig, slug, value, silent }. */
function figures(html) {
  const out = [];
  for (const m of html.matchAll(/<[a-z]+\b[^>]*\bdata-fig="([^"]+)"[^>]*>/g)) {
    const tag = m[0];
    const slug = tag.match(/\bdata-slug="([^"]*)"/);
    const value = tag.match(/\bdata-value="([^"]*)"/);
    const raw = value ? value[1] : '';
    out.push({
      fig: m[1],
      slug: slug ? slug[1] : null,
      value: raw === '' ? null : Number(raw),
      // the element's rendered text, for the suppression assertion
      text: html.slice(m.index + tag.length, html.indexOf('</', m.index + tag.length)).replace(/<[^>]+>/g, '').trim(),
    });
  }
  return out;
}

/** JSON-LD nodes, parsed. Returns [] when the page emits none, which is itself a finding. */
function ldNodes(html) {
  const nodes = [];
  for (const b of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let parsed;
    try { parsed = JSON.parse(b[1]); } catch { continue; }
    for (const n of Array.isArray(parsed) ? parsed : [parsed]) nodes.push(n);
  }
  return nodes;
}

export default {
  id: 'homepage',
  title: 'The homepage links, states its figures, and declares itself',
  wholeCorpusOnly: true,
  needsHubRecord: true,

  async finish(_rows, { base, hubRecord }) {
    const r = await get(base + '/');
    if (r.status !== 200) {
      return {
        coverage: [['homepage fetch', `HTTP ${r.status}`]],
        assertions: [['homepage returns 200', r.status, 200]],
      };
    }
    const html = r.body;
    const links = internalLinks(html);
    const nav = navMarkup(html);
    const navLinks = internalLinks(nav);
    const figs = figures(html);
    const nodes = ldNodes(html);

    // ── 2. header anchors ────────────────────────────────────────────────
    // A trigger rendered as <button> is the exact regression this replaces, so the
    // trigger's own class is checked on the tag that carries it.
    const triggerTags = [...nav.matchAll(/<([a-z]+)\b[^>]*class="[^"]*m-navtrigger[^"]*"/g)].map((m) => m[1]);
    const nonAnchorTriggers = triggerTags.filter((t) => t !== 'a');
    const missingTriggers = MENU_TRIGGERS.filter((h) => !navLinks.has(h));
    const missingRail = RAIL_SAMPLE.filter((h) => !navLinks.has(h));

    // ── 3. figures against the record ────────────────────────────────────
    const hoodFigs = figs.filter((f) => f.fig === 'nbhd-typical' && f.slug);
    const priceMismatch = [], subKLeak = [], silentSplit = [], noRecord = [];
    for (const f of hoodFigs) {
      const rec = hubRecord.hub(f.slug);
      if (!rec) { noRecord.push(f.slug); continue; }
      const expected = rec.typicalRounded;
      if (expected === null) {
        if (f.value !== null) subKLeak.push(`${f.slug}: homepage states $${f.value.toLocaleString()} off ${rec.salesCount} sales (below k=5)`);
        if (!/thin/i.test(f.text)) silentSplit.push(`${f.slug}: sub-k pool but the card prints "${f.text}"`);
      } else if (f.value !== expected) {
        priceMismatch.push(`${f.slug}: homepage ${f.value === null ? 'silent' : `$${f.value.toLocaleString()}`} vs live $${expected.toLocaleString()}`);
      }
    }

    // Milton-wide figures must be present and numeric. A missing figure is a section that
    // silently stopped rendering, which no visual check catches on a page this long.
    const REQUIRED_FIGS = ['on-market', 'new-week', 'sold-mtd', 'typical-milton'];
    const missingFigs = REQUIRED_FIGS.filter((k) => !figs.some((f) => f.fig === k && f.value !== null));

    // ── 4. structured data ───────────────────────────────────────────────
    const website = nodes.find((n) => n['@type'] === 'WebSite');
    const org = nodes.find((n) => n['@type'] === 'Organization');
    const searchAction =
      website && website.potentialAction && website.potentialAction['@type'] === 'SearchAction';

    return {
      coverage: [
        ['unique internal links served', links.size],
        ['of which are in the <nav>', navLinks.size],
        ['stated link floor', LINK_FLOOR],
        ['data-fig figures parsed', figs.length],
        ['neighbourhood price figures', hoodFigs.length],
        ['sub-k hoods (price must be silent)', hoodFigs.filter((f) => hubRecord.hub(f.slug) && hubRecord.hub(f.slug).typicalRounded === null).map((f) => f.slug).join(', ') || 'none'],
        ['JSON-LD nodes parsed', nodes.length],
      ],
      assertions: [
        ['homepage returns 200', r.status, 200],
        [`unique internal links >= ${LINK_FLOOR}`, links.size >= LINK_FLOOR, true],
        // A parser that reaches nothing must fail on its own coverage.
        ['neighbourhood price figures found', hoodFigs.length > 0, true],
        ['menu triggers rendered as anchors', nonAnchorTriggers.length, 0],
        ['menu trigger hrefs in served nav markup', missingTriggers.length, 0],
        ['rail links in served nav markup', missingRail.length, 0],
        ['Milton-wide figures present', missingFigs.length, 0],
        ['neighbourhood figure != its hub record', priceMismatch.length, 0],
        ['neighbourhood figure off a sub-k pool', subKLeak.length, 0],
        ['sub-k hood prints a price instead of its suppression', silentSplit.length, 0],
        ['WebSite node present', Boolean(website), true],
        ['Organization node present', Boolean(org), true],
        ['SearchAction on the WebSite node', Boolean(searchAction), true],
      ],
      notes: [
        `neighbourhood figures with no DB2 record (not asserted): ${noRecord.join(', ') || 'none'}`,
        'homepage == record and hub page == record (hub-meta) together assert homepage == hub page',
      ],
      examples: [
        ...priceMismatch, ...subKLeak, ...silentSplit,
        ...missingTriggers.map((h) => `menu trigger missing from nav markup: ${h}`),
        ...missingRail.map((h) => `rail link missing from nav markup: ${h}`),
        ...missingFigs.map((k) => `Milton-wide figure absent or non-numeric: ${k}`),
      ],
    };
  },
};
