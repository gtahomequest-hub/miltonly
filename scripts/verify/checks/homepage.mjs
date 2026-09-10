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
//   3b. EVERY MILTON-WIDE FIGURE, BY VALUE AND BY FORMAT. Added 2026-09-10, because the
//      first version of this check passed while two figures on the page were wrong, under a
//      title claiming the page "states its figures". It asserted PRESENCE — that a
//      `data-fig` existed and parsed as a number — and presence is not value. The page
//      shipped "0.980868783307145%" for sold-to-ask (a ratio printed with a percent sign
//      welded on, overlapping its own caption) and "738 Milton streets with their own page"
//      against 444 published pages. Both satisfied every assertion here.
//
//      So each figure now declares its SOURCE QUERY and its DISPLAY FORMAT, and the check
//      reads the RENDERED TEXT rather than the `data-value` attribute. That distinction is
//      the fix: `data-value` was correct in both defects. The defect lived between the value
//      and the reader, which is the one span an attribute cannot cover.
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

/** Every `data-fig` figure on the page: { fig, slug, value, text }.
 *
 *  `text` is what the READER sees, read to the element's own closing tag rather than to the
 *  first `</` anywhere after it. The first version stopped at the first `</`, so the hero's
 *  typical price — `<b>$</b>930K` — yielded the text "$", and any value assertion built on
 *  it would have been comparing against nothing. */
function figures(html) {
  const out = [];
  for (const m of html.matchAll(/<([a-z]+)\b[^>]*\bdata-fig="([^"]+)"[^>]*>/g)) {
    const tag = m[0];
    const tagName = m[1];
    const slug = tag.match(/\bdata-slug="([^"]*)"/);
    const value = tag.match(/\bdata-value="([^"]*)"/);
    const raw = value ? value[1] : '';
    const from = m.index + tag.length;
    const close = html.indexOf(`</${tagName}>`, from);
    const inner = close === -1 ? '' : html.slice(from, close);
    out.push({
      fig: m[2],
      slug: slug ? slug[1] : null,
      value: raw === '' ? null : Number(raw),
      // the attribute verbatim — figures whose canonical form is a STRING ("28 days",
      // "98.1%", "$933,000") cannot survive Number()
      rawValue: raw === '' ? null : raw,
      // React splits adjacent text nodes with <!-- -->; strip comments before tags.
      text: inner.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    });
  }
  return out;
}

/** The compact money form the hero prints. Re-derived from compactPrice, never imported. */
const compact = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${n}`;

const int = (n) => Number(n).toLocaleString('en-CA');

/**
 * THE MILTON-WIDE FIGURES: each one's source query, its expected rendering, and how far the
 * rendering may sit from the source.
 *
 * `tol` is display granularity, not a fudge factor. A figure printed as "$930K" cannot carry
 * more precision than the nearest thousand, so 500 is the most it can honestly differ by. A
 * whole-number percent gets 0.5. Counts get 0: a count off by one is simply wrong.
 *
 * `pattern` is the half that was missing. "0.980868783307145%" is a number followed by a
 * percent sign, and it satisfied every assertion this check used to make.
 */
const FIG_SPECS = [
  { fig: 'on-market', source: 'onMarket', expect: (v) => String(v), parse: (t) => Number(t.replace(/[,\s]/g, '')), tol: 0, pattern: /^\d{1,5}$/ },
  { fig: 'new-week', source: 'newThisWeek', expect: (v) => String(v), parse: (t) => Number(t.replace(/[,\s]/g, '')), tol: 0, pattern: /^\d{1,5}$/ },
  { fig: 'sold-mtd', source: 'soldMonthToDate', expect: (v) => String(v), parse: (t) => Number(t.replace(/[,\s]/g, '')), tol: 0, pattern: /^\d{1,5}$/ },
  {
    fig: 'typical-milton', source: 'typicalMilton',
    expect: (v) => `$${compact(v)}`,
    parse: (t) => {
      const m = t.match(/^\$\s*([\d.]+)(K|M)$/);
      return m ? Number(m[1]) * (m[2] === 'M' ? 1e6 : 1e3) : NaN;
    },
    tol: 500, pattern: /^\$\s*[\d.]+(K|M)$/,
  },
  // NOT sale-side, and asserted against BOTH the record and the page it is copied from.
  // See the /rentals cross-check below: equality with the record is not enough, because the
  // point of this figure is that two surfaces state one number.
  { fig: 'rentals-available', source: 'rentalsAvailable', expect: int, parse: (t) => Number(t.replace(/[,\s]/g, '')), tol: 0, pattern: /^[\d,]{1,7}$/ },
  { fig: 'proof-street-pages', source: 'publishedStreetPages', expect: int, parse: (t) => Number(t.replace(/[,\s]/g, '')), tol: 0, pattern: /^[\d,]{1,7}$/ },
  { fig: 'proof-sales-12mo', source: 'sold12mo', expect: int, parse: (t) => Number(t.replace(/[,\s]/g, '')), tol: 0, pattern: /^[\d,]{1,7}$/ },
  {
    fig: 'proof-sold-to-ask', source: 'soldToAskPct',
    expect: (v) => `${Math.round(v)}%`,
    parse: (t) => Number(t.replace('%', '')),
    tol: 0.5, pattern: /^\d{1,3}%$/,
  },
];

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
  needsHomeRecord: true,

  async finish(_rows, { base, hubRecord, homeRecord }) {
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

    // ── 3b. every Milton-wide figure, by value and by format ─────────────
    // A missing figure is a section that silently stopped rendering, which no visual check
    // catches on a page this long. A malformed one is what shipped.
    const absent = [], malformed = [], offSource = [];
    const figReport = [];
    for (const spec of FIG_SPECS) {
      const f = figs.find((x) => x.fig === spec.fig);
      const source = homeRecord[spec.source];
      if (!f) { absent.push(`${spec.fig}: no element carries this data-fig`); continue; }
      if (source === null || source === undefined) {
        // The source is k-suppressed. The figure must then not be on the page at all.
        malformed.push(`${spec.fig}: rendered "${f.text}" while its source is suppressed`);
        continue;
      }
      const wanted = spec.expect(source);
      figReport.push(`${spec.fig}: "${f.text}" (source ${source}, expected "${wanted}")`);
      if (!spec.pattern.test(f.text)) {
        malformed.push(`${spec.fig}: rendered "${f.text}", which is not a ${spec.pattern}`);
        continue; // an unparseable string cannot also be value-checked
      }
      const shown = spec.parse(f.text);
      if (!Number.isFinite(shown) || Math.abs(shown - source) > spec.tol) {
        offSource.push(`${spec.fig}: page shows "${f.text}" (${shown}) vs source ${source}, tolerance ${spec.tol}`);
      }
    }

    // The streets figure gets its own named assertion, because "which set does this count"
    // is the question it got wrong, not "is it formatted".
    const pagesFig = figs.find((f) => f.fig === 'proof-street-pages');
    const pagesShown = pagesFig ? Number(pagesFig.text.replace(/[,\s]/g, '')) : null;
    const pagesMatch = pagesShown === homeRecord.publishedStreetPages;

    // ── 3c. the rentals figure equals the figure /rentals itself publishes ───
    // The homepage tile is a COPY of another page's number. Asserting it against the record
    // proves it is right; asserting it against /rentals proves the two pages say one thing,
    // which is the property that was asked for and the one that breaks first.
    const rentalsPage = await get(base + '/rentals');
    const rentalsFig = rentalsPage.status === 200 ? figures(rentalsPage.body).find((f) => f.fig === 'rentals-available') : null;
    const rentalsShown = rentalsFig ? Number(String(rentalsFig.value)) : null;
    const homeRentals = figs.find((f) => f.fig === 'rentals-available');
    const homeRentalsShown = homeRentals ? Number(homeRentals.text.replace(/[,\s]/g, '')) : null;
    const rentalsAgree = rentalsShown !== null && homeRentalsShown !== null && rentalsShown === homeRentalsShown;

    // ── 3d. THE MENU IS A SURFACE TOO ────────────────────────────────────
    // The mega menu printed "$937,465.504", "27.829694323144103" and a ratio wearing a
    // percent sign, on production, for as long as the panel existed. Every gate written to
    // that point read the page BODY, and none of them opened a menu — so a surface that
    // publishes site figures had no coverage at all.
    //
    // Two rules, both cheap:
    //   · the menu's three market figures must equal what THE BOARD renders on the same
    //     page. One page, two surfaces, one number — no new record needed.
    //   · NOTHING carrying data-fig anywhere on this page may render a raw float. That one
    //     regex would have caught all three defects on the day they shipped, and it catches
    //     the next one without anybody predicting which figure it will be.
    // Compared on data-value, not rendered text: the Board's tile prints "28" and captions
    // it "days" in a sibling element, while the menu prints "28 days" in one. Both declare
    // the same canonical string in data-value, which is what the attribute is for.
    const val = (k) => { const f = figs.find((x) => x.fig === k); return f ? (f.value === null ? f.text : String(f.rawValue ?? f.text)) : null; };
    const menuPairs = [
      ['menu-sell-days', 'board-days'],
      ['menu-sell-sta', 'board-sta'],
    ];
    const menuMismatch = [];
    for (const [menuKey, boardKey] of menuPairs) {
      const m = val(menuKey), b = val(boardKey);
      if (m === null || b === null) { menuMismatch.push(`${menuKey}/${boardKey}: ${m ?? 'absent'} vs ${b ?? 'absent'}`); continue; }
      if (m.replace(/\s/g, '') !== b.replace(/\s/g, '')) menuMismatch.push(`${menuKey} "${m}" != ${boardKey} "${b}"`);
    }

    // A raw float is a formatting failure whatever the figure is: 3+ decimal places, or any
    // decimal at all in a value that also carries a currency or percent sign.
    const RAW_FLOAT = /\d\.\d{3,}/;
    const rawFloats = figs.filter((f) => RAW_FLOAT.test(f.text)).map((f) => `${f.fig}: "${f.text}"`);

    // ── 3e. VOICE: no em-dash, en-dash only between numerals ─────────────
    // CLAUDE.md's rule, gated on the RENDERED page rather than on source, so a dash reaching
    // the reader through a data field or a generated string is caught too. The Open
    // Government Licence attribution is exempt by name: "Open Government Licence – Milton"
    // is verbatim licence text and may not be altered.
    // Tested PER TEXT NODE, not over the whole document. A document-wide regex reads across
    // element boundaries and reports "Volume - Days" as prose; and it cannot tell the Board's
    // standalone null marker from a dash inside a sentence. Splitting on tags gives each
    // chunk in isolation, so a chunk that is only a dash is what it is: a marker for "no
    // value", not prose.
    //
    // TWO DELIBERATE EXEMPTIONS, both stated rather than silent:
    //   · the Open Government Licence attribution, which is verbatim licence text
    //   · a chunk consisting solely of a dash, the Board's "no value published" glyph
    const chunks = html
      .replace(/<script[\s\S]*?<\/script>/g, '<>')
      .replace(/<style[\s\S]*?<\/style>/g, '<>')
      .replace(/<!--[\s\S]*?-->/g, '<>')
      .split(/<[^>]*>/)
      .map((c) => c.replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((c) => !/Open Government Licence – Milton/.test(c));

    const isProse = (c) => /[A-Za-z]/.test(c.replace(/[–—]/g, ''));
    const emDashes = chunks.filter((c) => c.includes('—') && isProse(c)).map((c) => c.slice(0, 90));
    // An en-dash is allowed only as a NUMERIC RANGE: a digit or currency symbol on both
    // sides. "$785,000-$1,107,000" is a range; "Licence - Milton" is not.
    // The prose guard applies here too. React splits `{a}–{b}` into three text nodes, so
    // the Board's price band arrives as a lone dash with its numbers in the neighbouring
    // nodes. A chunk with no letters in it is not prose and cannot be a voice violation.
    const enDashes = chunks
      .filter((c) => c.includes('–') && isProse(c))
      .filter((c) => !/[\d$][\s]?–[\s]?[$\d]/.test(c))
      .map((c) => c.slice(0, 90));

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
        ['Milton-wide figures checked by value + format', `${FIG_SPECS.length} specs`],
        ['as rendered', figReport.join(' · ') || 'none read'],
        ['published street pages (record)', homeRecord.publishedStreetPages],
        ['rentals available: homepage / /rentals / record', `${homeRentalsShown ?? '-'} / ${rentalsShown ?? '-'} / ${homeRecord.rentalsAvailable}`],
        ['menu sell figures', figs.filter((f) => f.fig.startsWith('menu-sell-')).map((f) => `${f.fig}="${f.text}"`).join(' · ') || 'none'],
        ['published StreetContent rows (record)', homeRecord.publishedContentRows],
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
        ['Milton-wide figures absent from the page', absent.length, 0],
        ['Milton-wide figures rendered in the wrong format', malformed.length, 0],
        ['Milton-wide figures outside their source + tolerance', offSource.length, 0],
        ['street-page figure == the published page count', pagesMatch, true],
        ['/rentals returns 200', rentalsPage.status, 200],
        ['homepage rentals figure == the figure /rentals publishes', rentalsAgree, true],
        ['menu figure != the Board figure on the same page', menuMismatch.length, 0],
        ['any data-fig rendering a raw float', rawFloats.length, 0],
        ['em-dashes in rendered copy', emDashes.length, 0],
        ['en-dashes outside a numeric range', enDashes.length, 0],
        ['neighbourhood figure != its hub record', priceMismatch.length, 0],
        ['neighbourhood figure off a sub-k pool', subKLeak.length, 0],
        ['sub-k hood prints a price instead of its suppression', silentSplit.length, 0],
        ['WebSite node present', Boolean(website), true],
        ['Organization node present', Boolean(org), true],
        ['SearchAction on the WebSite node', Boolean(searchAction), true],
      ],
      notes: [
        `neighbourhood figures with no DB2 record (not asserted): ${noRecord.join(', ') || 'none'}`,
        `published pages ${homeRecord.publishedStreetPages} vs published content rows ${homeRecord.publishedContentRows}: the difference is content published for a slug with no ResidentialStreet entity, which the sitemap refuses`,
        'homepage == record and hub page == record (hub-meta) together assert homepage == hub page',
      ],
      examples: [
        ...priceMismatch, ...subKLeak, ...silentSplit,
        ...missingTriggers.map((h) => `menu trigger missing from nav markup: ${h}`),
        ...missingRail.map((h) => `rail link missing from nav markup: ${h}`),
        ...absent, ...malformed, ...offSource,
        ...(pagesMatch ? [] : [`street-page figure shows ${pagesShown} vs ${homeRecord.publishedStreetPages} published pages`]),
        ...(rentalsAgree ? [] : [`rentals: homepage ${homeRentalsShown ?? 'absent'} vs /rentals ${rentalsShown ?? 'absent'}`]),
        ...menuMismatch, ...rawFloats,
        ...emDashes.map((c) => `em-dash: ...${c}...`),
        ...enDashes.map((c) => `en-dash outside a numeric range: ...${c}...`),
      ],
    };
  },
};
