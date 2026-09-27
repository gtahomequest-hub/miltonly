// MC-045: parses one cached served street page into its text fields (read-only). Written by the
// anatomy reader and checked on all 719 pages; the selectors are documented in rep-anatomy.
import fs from 'fs';

const dec = (s) => (s ?? '').replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const txt = (s) => dec((s ?? '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const all = (re, s) => Array.from(s.matchAll(re));
const one = (re, s) => { const m = s.match(re); return m ? m : null; };
const between = (s, a, b) => { const i = s.indexOf(a); if (i < 0) return null; const j = b ? s.indexOf(b, i + a.length) : -1; return s.slice(i, j < 0 ? s.length : j); };

const cutAt = (s, m) => { const i = s.indexOf(m); return i < 0 ? s : s.slice(0, i); };

export function extract(html) {
  const flight = html.indexOf('<script>self.__next_f.push');
  const head = html.slice(0, html.indexOf('</head>'));
  // THE DOM, NOT THE FLIGHT PAYLOAD: every visible string is repeated, escaped, inside
  // self.__next_f.push scripts after this point. Cut there, and strip React's text-node seams.
  const dom = html.slice(0, flight < 0 ? html.length : flight).replace(/<!-- -->/g, '');
  const f = {};
  f.template = dom.includes('<span class="s-eyebrow">The street</span>') ? 'minimal'
    : dom.includes('<h3>No written profile yet</h3>') ? 'placeholder' : 'standard';

  // ── head ──
  f.title = txt(one(/<title>([^<]*)<\/title>/, head)?.[1]);
  f.metaDescription = dec(one(/<meta name="description" content="([^"]*)"/, head)?.[1]);
  f.ogDescription = dec(one(/<meta property="og:description" content="([^"]*)"/, head)?.[1]);
  f.twitterDescription = dec(one(/<meta name="twitter:description" content="([^"]*)"/, head)?.[1]);

  // ── JSON-LD (first ld+json in the DOM; the second occurrence is inside the flight payload) ──
  const ld = one(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, dom);
  const graph = ld ? JSON.parse(ld[1])['@graph'] ?? [] : [];
  const node = (t) => graph.find((n) => n['@type'] === t);
  const place = node('Place');
  f.ldPlaceDescription = place?.description ?? null;
  f.ldPlaceContainedIn = (place?.containedInPlace ?? []).map((p) => p.name);
  f.ldPlaceTypicals = (place?.additionalProperty ?? []).map((p) => ({ id: p.propertyID, value: p.value, description: p.description }));
  f.ldFaq = (node('FAQPage')?.mainEntity ?? []).map((q) => ({ q: q.name, a: q.acceptedAnswer?.text }));
  f.ldVideo = graph.filter((n) => n['@type'] === 'VideoObject').map((v) => v.description);
  f.ldNearby = (graph.find((n) => n['@id']?.endsWith('#nearby-places'))?.itemListElement ?? []).map((i) => i.item.name);
  f.ldAddressCount = graph.find((n) => n['@id']?.endsWith('#addresses'))?.numberOfItems ?? 0;
  f.ldGraphTypes = graph.map((n) => n['@type']).join(',');

  // ── hero ──
  const hero = between(dom, '<header class="s-hero">', '</header>') ?? '';
  f.heroEyebrow = txt(one(/<span class="s-eyebrow">([^<]*)<\/span>/, hero)?.[1]);
  f.h1 = txt(one(/<h1>([\s\S]*?)<\/h1>/, hero)?.[1]);
  f.heroSubtitle = txt(one(/<p class="s-character">([\s\S]*?)<\/p>/, hero)?.[1]) || null;
  f.heroStats = all(/<div class="s-hs"><div class="s-n( s-silent)?">([\s\S]*?)<\/div><div class="s-l">([^<]*)<\/div>(?:<div class="s-sub">([^<]*)<\/div>)?(?:<div class="s-basis">([^<]*)<\/div>)?<\/div>/g, hero)
    .map((m) => ({ label: txt(m[3]), value: txt(m[2]), silent: !!m[1], sub: m[4] ? txt(m[4]) : null, basis: m[5] ? txt(m[5]) : null }));
  f.pillRows = hero.split('<div class="s-pillrow">').slice(1).map((row) => ({
    row: /Recent leases/.test(row.slice(0, 200)) ? 'leases' : 'sales',
    window: txt(one(/<span class="s-pillrow-win">([^<]*)<\/span>/, row)?.[1]),
    pills: all(/<span class="s-pill-t">([^<]*)<\/span><span class="s-pill-c">(\d+)<\/span><span class="s-pill-p( s-silent)?">([^<]*)<\/span>/g, row)
      .map((m) => ({ type: txt(m[1]), count: +m[2], price: txt(m[4]), silent: !!m[3] })),
  }));
  f.heroGateCount = +(one(/<span class="s-hero-gate-n">(\d+)<\/span>/, hero)?.[1] ?? 0) || null;
  f.heroUpdated = txt(one(/<p class="s-updated">([\s\S]*?)<\/p>/, hero)?.[1]);
  f.captureCopy = txt(one(/<p class="s-capture-p">([\s\S]*?)<\/p>/, hero)?.[1]);

  // ── video ──
  f.videoCaptions = all(/<figcaption class="s-video-cap">([^<]*)<\/figcaption>/g, dom).map((m) => txt(m[1]));
  f.videoCoverage = all(/<p class="s-video-coverage">([^<]*)<\/p>/g, dom).map((m) => txt(m[1]));

  // ── glance tiles ──
  f.glance = all(/<div class="s-gi"><div class="s-gi-l">([^<]*)<\/div><div class="s-gi-v( s-silent)?">([^<]*)<\/div>(?:<div class="s-gi-d">([^<]*)<\/div>)?<\/div>/g, dom)
    .map((m) => ({ label: txt(m[1]), value: txt(m[3]), silent: !!m[2], detail: m[4] ? txt(m[4]) : null }));

  // ── area context (sub-k5 full shell) ──
  const acx = between(dom, '<section class="s-block s-areacx">', '</section>');
  f.areaContext = acx ? {
    eyebrow: txt(one(/<span class="s-eyebrow">([^<]*)<\/span>/, acx)?.[1]),
    heading: txt(one(/<h2>([\s\S]*?)<\/h2>/, acx)?.[1]),
    num: txt(one(/<div class="s-areacx-num">([\s\S]*?)<\/div>/, acx)?.[1]) || null,
    label: txt(one(/<div class="s-areacx-lbl">([\s\S]*?)<\/div>/, acx)?.[1]) || null,
    read: txt(one(/<p class="s-areacx-read">([\s\S]*?)<\/p>/, acx)?.[1]),
  } : null;

  // ── profile (standard) ──
  const prose = between(dom, '<div class="s-prose">', '<aside class="s-side">') ?? '';
  f.sections = f.template === 'minimal' ? [] : prose.split('<div class="s-prose-sec" id="s-').slice(1).map((chunk) => {
    const id = chunk.slice(0, chunk.indexOf('"'));
    const body = chunk.replace(/<div class="s-inline-cta">[\s\S]*$/, '');
    return { id, heading: txt(one(/<h3>([\s\S]*?)<\/h3>/, body)?.[1]) || null, paragraphs: all(/<p>([\s\S]*?)<\/p>/g, body).map((m) => txt(m[1])) };
  });
  f.ownerInlineCta = txt(one(/<div class="s-inline-h">([\s\S]*?)<\/div>/, prose)?.[1]) || null;
  // ── minimal "About" + trust anchor + area market ──
  f.minimalProse = f.template === 'minimal' ? all(/<p>([\s\S]*?)<\/p>/g, prose).map((m) => txt(m[1])) : [];
  const trust = one(/<div class="s-placeholder" style="[^"]*"><h2>([\s\S]*?)<\/h2><p>([\s\S]*?)<\/p>/, dom);
  f.minimalTrust = trust ? { heading: txt(trust[1]), body: txt(trust[2]) } : null;

  // ── sidebar ──
  const side = between(dom, '<aside class="s-side">', '</aside>') ?? '';
  f.streetFacts = all(/<div class="s-fact"><span class="s-fact-l">([^<]*)<\/span><span class="s-fact-v">([^<]*)<\/span><\/div>/g, side).map((m) => ({ label: txt(m[1]), value: txt(m[2]) }));
  f.roadIdentity = one(/<div class="s-side-card s-geo" data-identity="([^"]*)">/, side)?.[1] ?? null;
  f.roadFacts = all(/<div class="s-fact s-geo-fact" data-key="([a-z]+)"><span class="s-fact-l">([^<]*)<\/span><span class="s-fact-v">([^<]*)<\/span><\/div>/g, side).map((m) => ({ key: m[1], label: txt(m[2]), value: txt(m[3]) }));
  f.nearby = all(/<div class="s-near">(?:<span class="s-near-ic">[^<]*<\/span>)?<span class="s-near-n">([^<]*)<\/span>(?:<span class="s-near-d">([^<]*)<\/span>)?<\/div>/g, side).map((m) => ({ name: txt(m[1]), distance: m[2] ? txt(m[2]) : null }));
  const scta = between(side, '<div class="s-side-cta">', null);
  f.sidebarCta = scta ? { eyebrow: txt(one(/<span class="s-eyebrow">([^<]*)<\/span>/, scta)?.[1]), headline: txt(one(/<h3>([^<]*)<\/h3>/, scta)?.[1]), body: txt(one(/<p>([\s\S]*?)<\/p>/, scta)?.[1]) } : null;

  // ── type cards ──
  f.typeCards = dom.split('<div class="s-type" id="type-').slice(1).map((chunk) => {
    const c = cutAt(chunk, '</section>');
    return {
      type: c.slice(0, c.indexOf('"')),
      intro: txt(one(/<p class="s-type-intro">([\s\S]*?)<\/p>/, c)?.[1]),
      stats: all(/<div class="s-stat"[^>]*><div class="s-stat-l">([^<]*)<\/div><div class="s-stat-v( s-silent)?">([^<]*)<\/div>(?:<div class="s-stat-d">([^<]*)<\/div>)?<\/div>/g, c).map((m) => ({ label: txt(m[1]), value: txt(m[3]), silent: !!m[2], detail: m[4] ? txt(m[4]) : null })),
      chartNote: txt(one(/<div class="s-chart-note">([\s\S]*?)<\/div>/, c)?.[1]) || null,
    };
  });

  // ── market ──
  f.marketCards = all(/<div class="s-msum"(?: id="leases")?><h3>([^<]*)<\/h3><p>([\s\S]*?)<\/p>/g, dom).map((m) => ({ title: txt(m[1]), body: txt(m[2]) }));
  f.minimalAreaMarket = f.template === 'minimal' ? txt(one(/<div class="s-msum"><p>([\s\S]*?)<\/p>/, dom)?.[1]) || null : null;
  f.yoy = txt(one(/<p class="s-yoy">([\s\S]*?)<\/p>/, dom)?.[1]) || null;
  f.chartCaption = txt(one(/<div class="s-chart-cap">([\s\S]*?)<\/div>/, dom)?.[1]) || null;

  // ── listings ──
  f.listings = all(/<div class="s-listing-a">([^<]*)<\/div><div class="s-listing-m">((?:<span>[^<]*<\/span>)+)<\/div>/g, dom).map((m) => {
    const spans = all(/<span>([^<]*)<\/span>/g, m[2]).map((s) => txt(s[1]));
    return { address: txt(m[1]), propertyType: spans[spans.length - 1] };
  });

  // ── address ladder ──
  f.addressSummary = txt(one(/<p class="s-addr-sum">([\s\S]*?)<\/p>/, dom)?.[1]) || null;

  // ── context cards (full shell: h3-headed columns; minimal: eyebrow-headed sections) ──
  f.contextCols = dom.split('<div class="s-ctx-col">').slice(1).map((chunk) => {
    const c = cutAt(chunk, '</section>');
    return { heading: txt(one(/^<h3>([^<]*)<\/h3>/, c)?.[1]) || null, items: all(/<div class="s-ctx-n">([^<]*)<\/div>(?:<div class="s-ctx-m">([^<]*)<\/div>)?/g, c).map((m) => ({ name: txt(m[1]), meta: m[2] ? txt(m[2]) : null })) };
  });

  // ── FAQ (visible) ──
  f.faq = all(/<div class="s-faq-item"><div class="s-faq-q">([\s\S]*?)<\/div><div class="s-faq-a">([\s\S]*?)<\/div><\/div>/g, dom).map((m) => ({ q: txt(m[1]), a: txt(m[2]) }));

  // ── final CTAs ──
  f.finalCtas = all(/<div class="s-fcard[^"]*"[^>]*><h3>([^<]*)<\/h3><p>([\s\S]*?)<\/p>/g, dom).map((m) => ({ headline: txt(m[1]), body: txt(m[2]) }));
  return f;
}
