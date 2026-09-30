// THE HUB PAGE GATE: every figure declares its source, format and tolerance; no VOW-derived
// figure renders; every link resolves; the ladder is every published street, ordered by homes
// for sale today; the JSON-LD is present and mirrors the ladder.
//
// hub-meta.mjs asserts the head, the glance and the JSON-LD carry no VOW figure, and
// hub-intents.mjs resolves the four intent squares. This check covers everything else the
// rebuilt hub renders, and it encodes the rules the 2026-09-10 rulings on report 065 set, as
// MC-046 Stage 1 amended them:
//
//   1. NOTHING STATIC. Every `data-fig` on the page outside the site nav has a row in FIG_SPECS
//      naming the record it is recomputed from, the pattern it must render in, and how far the
//      rendering may sit from the record (display granularity, never a fudge). A figure with no
//      row is a finding: an undeclared figure is an unverified one.
//
//   2. THE LADDER CARRIES NO SOLD FIGURE (MC-046 Stage 1, R9). It used to be compared to the
//      street page's typical and basis. Those left the visitor view with every other value
//      derived from VOW records, so the ladder now carries one public figure per row, the count
//      of homes for sale today, and it must be ORDERED by it (most first, ties A to Z). A row
//      that still prints a price, a basis or a sale count is a finding.
//
//   0. NO VOW FIGURE ON THE PAGE (MC-046 Stage 1). The retired figures (hub typical, type share
//      of sales, the Milton compare block, the ladder's typical and sold count, the siblings'
//      typicals) must not render at all, the page carries exactly one neutral line, and no
//      JSON-LD node carries an aggregatePrice.
//
//   3. THE LADDER IS COMPLETE. The rows equal the hub's published street set from DB1, as a set,
//      and the "streets with a page" fact equals that count. A hub that claims 48 and lists 12
//      is making the reader hunt.
//
//   4. EVERY LINK RESOLVES. Every internal href on the page is fetched once (streets through the
//      crawl already running) and must return 200 with no redirect; every fragment must match an
//      id on the page it points at. A dead fragment is the quietest defect a page can carry.
//
//   5. JSON-LD IS PRESENT and its ItemList counts what the ladder lists.
import { get, publishedHubSlugs } from '../lib/http.mjs';

const parseInt0 = (t) => Number(t.replace(/[,\s]/g, ''));

/** MC-046: figures derived from VOW records that the hub page must no longer render. */
const RETIRED_FIGS = new Set([
  'hub-fact-typical', 'hub-fact-stock', 'hub-compare-typical', 'hub-compare-milton',
  'hub-sibling-typical', 'hub-street-typical', 'hub-street-sold',
]);

/**
 * THE DECLARATIONS. `source(rec, page)` returns the record value (null = suppressed, so the
 * figure must be ABSENT); `expect` renders it as the page must; `pattern` is the format;
 * `tol` the display granularity. Per-slug figures (`perSlug: true`) are asserted per row.
 */
const FIG_SPECS = [
  { fig: 'hub-fact-pages', source: (rec) => rec.page.publishedStreets || null, expect: String, pattern: /^\d{1,4}$/, parse: parseInt0, tol: () => 0 },
  { fig: 'hub-fact-video', source: (rec) => rec.page.filmedStreets || null, expect: String, pattern: /^\d{1,4}$/, parse: parseInt0, tol: () => 0 },
  // The school count's source is the schools section ON THE SAME PAGE: the polygon test lives
  // in the app and the record cannot re-run it here, so the assertion is that the number and
  // the list it counts agree, and that every school in the list resolves (the link pass).
  { fig: 'hub-fact-schools', source: (rec, page) => page.schoolRows || null, expect: String, pattern: /^\d{1,3}$/, parse: parseInt0, tol: () => 0 },
  { fig: 'hub-fact-active', source: (rec) => rec.page.activeListings || null, expect: String, pattern: /^\d{1,5}$/, parse: parseInt0, tol: () => 0 },
  // Per-slug: the ladder's active count. Its order is asserted in the ladder pass; its format here.
  { fig: 'hub-street-active', perSlug: true, ladder: true },
];

/** Every `data-fig` figure on the page: { fig, slug, rawValue, text }. Read to the element's own
 *  closing tag; the first cut of the homepage parser stopped at the first `</` and read "$". */
function figures(html) {
  const out = [];
  for (const m of html.matchAll(/<([a-z]+)\b[^>]*\bdata-fig="([^"]+)"[^>]*>/g)) {
    const tag = m[0], tagName = m[1];
    const slug = tag.match(/\bdata-slug="([^"]*)"/);
    const value = tag.match(/\bdata-value="([^"]*)"/);
    const from = m.index + tag.length;
    const close = html.indexOf(`</${tagName}>`, from);
    const inner = close === -1 ? '' : html.slice(from, close);
    out.push({
      fig: m[2],
      slug: slug ? slug[1] : null,
      rawValue: value && value[1] !== '' ? value[1] : null,
      text: inner.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    });
  }
  return out;
}

/** The site nav's markup: its `menu-` figures belong to nav.mjs and are cut before figures are read. */
function withoutSiteNav(html) {
  const open = html.indexOf('<nav');
  if (open === -1) return html;
  const close = html.indexOf('</nav>', open);
  return close === -1 ? html : html.slice(0, open) + html.slice(close + 6);
}

const strip = (s) => s.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** The ladder rows: slug, name, the active count it prints, and any retired sold markup. */
function ladderRows(html) {
  const ol = html.match(/<ol class="hh-ladder">([\s\S]*?)<\/ol>/);
  if (!ol) return [];
  const rows = [];
  for (const li of ol[1].split('<li>').slice(1)) {
    const slug = li.match(/href="\/streets\/([^"]+)"/);
    if (!slug) continue;
    const name = li.match(/<span class="hh-ladname">([\s\S]*?)(?:<span class="hh-ladfilm"|<\/span>)/);
    const active = li.match(/data-fig="hub-street-active"[^>]*data-value="(\d+)"/);
    const activeText = li.match(/data-fig="hub-street-active"[^>]*>([\s\S]*?)<\/span>\s*<\/a>/);
    rows.push({
      slug: slug[1],
      name: name ? strip(name[1]).replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&') : '',
      active: active ? Number(active[1]) : null,
      activeText: activeText ? strip(activeText[1]) : '',
      retired: /hh-ladprice|hh-ladbasis|hub-street-typical|hub-street-sold/.test(li),
    });
  }
  return rows;
}

/** Every internal href, with its query and fragment: what a reader can click. */
function internalHrefs(html) {
  return [...new Set(
    [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)]
      .map((m) => m[1].replace(/&amp;/g, '&'))
      .filter((h) => (h.startsWith('/') && !h.startsWith('//') && !h.startsWith('/_next/')) || h.startsWith('#')),
  )];
}

const idsIn = (html) => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

function ldNodes(html) {
  const nodes = [];
  let broken = 0;
  for (const b of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let parsed;
    try { parsed = JSON.parse(b[1]); } catch { broken++; continue; }
    for (const n of Array.isArray(parsed) ? parsed : [parsed]) nodes.push(n);
  }
  return { nodes, broken };
}

export default {
  id: 'hub-page',
  title: 'Every hub figure declares its source, no VOW figure renders, every link resolves, the ladder is every street',
  needsHubRecord: true,

  /** Per street page in the crawl: only that it was read (the ladder's links resolve through it). */
  perPage(slug) {
    return { slug };
  },

  async finish(rows, { base, hubRecord, crawled, mode }) {
    const streetPage = new Map(rows.map((r) => [r.slug, r]));
    // MC-035: in sample mode the crawl holds about fifty streets; a ladder row whose street is
    // outside the sample is counted, not judged. Full mode judges every row, as before.
    const crawledSet = new Set(crawled ?? rows.map((r) => r.slug));
    let ladderOutsideSample = 0;
    const slugs = await publishedHubSlugs(base);

    const pages = new Map(); // path -> { status, ids }
    const hubs = [];
    for (const slug of slugs) {
      const path = `/neighbourhoods/${slug}`;
      const r = await get(base + path);
      if (r.status !== 200) { hubs.push({ slug, status: r.status }); continue; }
      const body = withoutSiteNav(r.body);
      pages.set(path, { status: 200, ids: idsIn(r.body) });
      hubs.push({
        slug,
        status: 200,
        figs: figures(body),
        ladder: ladderRows(body),
        hrefs: internalHrefs(r.body),
        ids: idsIn(r.body),
        schoolRows: (body.match(/<ul class="hh-schoollist">([\s\S]*?)<\/ul>/)?.[1].match(/<li\b/g) ?? []).length,
        ld: ldNodes(r.body),
        // The hub's own neutral line (class hh-soldline, in the glance). The site menu and the
        // footer may carry their own, which are theirs to count.
        soldLines: (body.match(/<p\b[^>]*\bhh-soldline\b[^>]*data-sold-history-line/g) ?? []).length,
        page: hubRecord.hubPage(slug),
      });
    }
    const ok = hubs.filter((h) => h.status === 200 && h.page);

    // ── 0. no VOW figure, one neutral line, no aggregatePrice (MC-046) ────────────────────
    const vowFigs = [], soldLineOff = [], aggregatePrice = [];
    for (const h of ok) {
      for (const f of h.figs) if (RETIRED_FIGS.has(f.fig)) vowFigs.push(`${h.slug}: data-fig="${f.fig}" still renders "${f.text}"`);
      if (h.soldLines !== 1) soldLineOff.push(`${h.slug}: ${h.soldLines} neutral lines, expected exactly 1`);
      if (h.ld.nodes.some((n) => n && Object.prototype.hasOwnProperty.call(n, 'aggregatePrice'))) aggregatePrice.push(`${h.slug}: a JSON-LD node carries aggregatePrice`);
    }

    // ── 1. every figure declared, by value and by format ─────────────────────────────────
    const undeclared = [], absent = [], malformed = [], offSource = [], leaked = [];
    for (const h of ok) {
      const rec = { page: h.page };
      for (const f of h.figs) {
        if (RETIRED_FIGS.has(f.fig)) continue; // reported in pass 0
        const spec = FIG_SPECS.find((s) => s.fig === f.fig);
        if (!spec) { undeclared.push(`${h.slug}: data-fig="${f.fig}" has no declared source/format/tolerance`); continue; }
        if (spec.ladder) continue; // asserted in the ladder pass below
        const source = spec.source(rec, h, f.slug);
        const label = `${h.slug}${f.slug ? ` ${f.fig}[${f.slug}]` : ` ${f.fig}`}`;
        if (source === null || source === undefined) {
          if (spec.silentText) {
            if (f.text !== spec.silentText || f.rawValue !== null) leaked.push(`${label}: prints "${f.text}" while its source is suppressed`);
          } else {
            leaked.push(`${label}: rendered "${f.text}" while its source is suppressed or zero`);
          }
          continue;
        }
        if (!spec.pattern.test(f.text)) { malformed.push(`${label}: rendered "${f.text}", not ${spec.pattern}`); continue; }
        // The exact rendering of the source passes outright: "$2.12M" IS 2,115,000 printed to
        // two decimals, and no numeric tolerance describes that better than the formatter does.
        // The tolerance is for a rendering that is not byte-identical, and there it is display
        // granularity, never a fudge.
        if (f.text === spec.expect(source, rec)) continue;
        const shown = spec.parse(f.text);
        const tol = spec.tol(rec);
        if (!Number.isFinite(shown) || Math.abs(shown - source) > tol) {
          offSource.push(`${label}: page shows "${f.text}" (${shown}) vs source ${source} (expected "${spec.expect(source, rec)}"), tolerance ${tol}`);
        }
      }
      // Presence: a figure whose source is non-null must be on the page. (The school count has
      // no page-independent source; presence is not asserted for it.)
      for (const spec of FIG_SPECS) {
        if (spec.perSlug || spec.fig === 'hub-fact-schools') continue;
        const source = spec.source(rec, h, null);
        if (source !== null && source !== undefined && !h.figs.some((f) => f.fig === spec.fig)) absent.push(`${h.slug}: ${spec.fig} absent while its source is ${source}`);
      }
    }

    // ── 2 + 3. the ladder: complete, no sold figure, ordered by homes for sale today ──────
    const ladderCountOff = [], ladderSetOff = [], ladderNot200 = [], ladderRetired = [], ladderActiveOff = [], ladderOrderOff = [];
    for (const h of ok) {
      const want = h.page.publishedStreetSlugs;
      const got = new Set(h.ladder.map((r) => r.slug));
      if (h.ladder.length !== h.page.publishedStreets) ladderCountOff.push(`${h.slug}: ladder lists ${h.ladder.length} vs ${h.page.publishedStreets} published streets`);
      const missing = [...want].filter((s) => !got.has(s)), extra = [...got].filter((s) => !want.has(s));
      if (missing.length || extra.length) ladderSetOff.push(`${h.slug}: missing ${missing.slice(0, 3).join(', ') || 'none'}; extra ${extra.slice(0, 3).join(', ') || 'none'}`);
      h.ladder.forEach((r, i) => {
        if (r.retired) ladderRetired.push(`${h.slug} ${r.slug}: the row still carries a price, basis or sale count`);
        const wantText = r.active === null ? null : r.active > 0 ? `${r.active} for sale` : 'none for sale';
        if (r.active === null || r.activeText !== wantText) ladderActiveOff.push(`${h.slug} ${r.slug}: active count "${r.activeText}" (data-value ${r.active})`);
        const prev = h.ladder[i - 1];
        if (prev && prev.active !== null && r.active !== null) {
          const inOrder = prev.active > r.active || (prev.active === r.active && prev.name.localeCompare(r.name) <= 0);
          if (!inOrder) ladderOrderOff.push(`${h.slug}: "${prev.name}" (${prev.active}) before "${r.name}" (${r.active})`);
        }
        const sp = streetPage.get(r.slug);
        if (!sp && mode === 'sample' && !crawledSet.has(r.slug)) { ladderOutsideSample++; return; }
        if (!sp) ladderNot200.push(`${h.slug}: /streets/${r.slug} was not a 200 in the crawl`);
      });
    }

    // ── 4. every link resolves ───────────────────────────────────────────────────────────
    const targets = new Map(); // "path?query" -> Set(fragments)
    for (const h of ok) {
      for (const href of h.hrefs) {
        const [route, frag] = href.split('#');
        const key = route || `/neighbourhoods/${h.slug}`; // "#x" is this page
        if (!targets.has(key)) targets.set(key, new Set());
        if (frag) targets.get(key).add(`${frag}@${h.slug}`);
      }
    }
    const deadRoute = [], deadFragment = [];
    let fetched = 0;
    for (const [route, frags] of targets) {
      const pathOnly = route.split('?')[0];
      const streetSlug = pathOnly.match(/^\/streets\/([^/]+)$/)?.[1];
      let page = pages.get(route);
      if (!page && streetSlug && streetPage.has(streetSlug)) page = { status: 200, ids: null }; // crawled this run
      if (!page) {
        const r = await get(base + route);
        fetched++;
        page = { status: r.status, ids: r.status === 200 ? idsIn(r.body) : new Set() };
        pages.set(route, page);
      }
      if (page.status !== 200) { deadRoute.push(`${route} -> HTTP ${page.status}`); continue; }
      for (const f of frags) {
        const [frag, from] = f.split('@');
        const ids = page.ids ?? ok.find((h) => h.slug === from)?.ids;
        if (ids && !ids.has(frag)) deadFragment.push(`${route}#${frag} (from ${from}) -> no element with id="${frag}"`);
      }
    }

    // ── 5. JSON-LD present, and its ItemList is the ladder ───────────────────────────────
    const noLd = [], ldBroken = [], ldListOff = [];
    for (const h of ok) {
      if (h.ld.broken) ldBroken.push(`${h.slug}: ${h.ld.broken} JSON-LD block(s) failed to parse`);
      if (!h.ld.nodes.length) { noLd.push(h.slug); continue; }
      const list = h.ld.nodes.map((n) => n?.mainEntity).find((m) => m && m['@type'] === 'ItemList');
      if (!list) { ldListOff.push(`${h.slug}: no Place.mainEntity ItemList`); continue; }
      if (list.numberOfItems !== h.ladder.length) ldListOff.push(`${h.slug}: ItemList ${list.numberOfItems} vs ladder ${h.ladder.length}`);
    }

    const figCount = ok.reduce((n, h) => n + h.figs.length, 0);
    return {
      coverage: [
        ['hub pages read', `${ok.length} of ${slugs.length}`],
        ...(mode === 'sample' ? [['ladder rows outside the street sample (counted, not judged)', ladderOutsideSample]] : []),
        ['figures read (outside the site nav)', figCount],
        ['declared figure kinds', FIG_SPECS.length],
        ['ladder rows read', ok.reduce((n, h) => n + h.ladder.length, 0)],
        ['ladder rows matched to a crawled street page', ok.reduce((n, h) => n + h.ladder.filter((r) => streetPage.has(r.slug)).length, 0)],
        ['unique link targets', targets.size],
        ['targets fetched here (the rest came from the street crawl)', fetched],
      ],
      assertions: [
        ['hub pages read == published hub count', ok.length, slugs.length],
        ['retired VOW figures still rendered (MC-046)', vowFigs.length, 0],
        ['hubs without exactly one neutral line', soldLineOff.length, 0],
        ['hubs whose JSON-LD carries aggregatePrice', aggregatePrice.length, 0],
        ['figures with no declared source/format/tolerance', undeclared.length, 0],
        ['figures absent while their source is present', absent.length, 0],
        ['figures rendered while their source is suppressed', leaked.length, 0],
        ['figures in the wrong format', malformed.length, 0],
        ['figures outside their source + tolerance', offSource.length, 0],
        ['hubs whose ladder count != published street count', ladderCountOff.length, 0],
        ['hubs whose ladder set != published street set', ladderSetOff.length, 0],
        ['ladder rows pointing at a street that was not 200', ladderNot200.length, 0],
        ['ladder rows still carrying a price, basis or sale count', ladderRetired.length, 0],
        ['ladder rows whose active count is missing or misprinted', ladderActiveOff.length, 0],
        ['ladder rows out of order (active count, then A to Z)', ladderOrderOff.length, 0],
        ['links whose route does not return 200', deadRoute.length, 0],
        ['links whose fragment matches no id', deadFragment.length, 0],
        ['hubs with no JSON-LD', noLd.length, 0],
        ['hubs with unparseable JSON-LD', ldBroken.length, 0],
        ['hubs whose JSON-LD ItemList != the ladder', ldListOff.length, 0],
      ],
      examples: [
        ...vowFigs.slice(0, 6), ...soldLineOff, ...aggregatePrice,
        ...undeclared, ...absent, ...leaked, ...malformed, ...offSource,
        ...ladderCountOff, ...ladderSetOff, ...ladderNot200, ...ladderRetired.slice(0, 6), ...ladderActiveOff.slice(0, 6), ...ladderOrderOff.slice(0, 6),
        ...deadRoute, ...deadFragment, ...noLd.map((s) => `${s}: no JSON-LD`), ...ldBroken, ...ldListOff,
      ],
    };
  },
};
