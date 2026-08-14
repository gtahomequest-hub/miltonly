// Rendered-page parsers, shared by every check.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: read discrete containers, never a tag-stripped document.
// The first denial sweep stripped every tag off the page and split the result on sentence
// punctuation. The stat grid contains no sentence punctuation, so one "sentence" ran 1,005
// characters across the whole tile block — and a k-anon suppression LABEL on one tile ("Detached
// 2 sample too small") landed in the same pseudo-sentence as a PRICE on a different tile. It
// reported four denials that no sentence on those pages makes. The JSON-LD failed the same way at
// 2,455 characters, joining the site-wide organisation blurb to an FAQ answer.
//
// So: prose is read per container, and structured data is PARSED and walked per text field.

export const clean = (x) => (x ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;|&rsquo;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, ' ')
  .replace(/&mdash;/g, '—')
  .replace(/\s+/g, ' ')
  .trim();

export const tight = (x) => clean(x).replace(/\s+/g, '');

/** Sentences, on text that is genuinely one prose block. */
export const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

const PROSE_CONTAINERS = [
  /<div class="s-faq-a">([\s\S]*?)<\/div>/g,            // FAQ answers
  /<p class="s-character">([\s\S]*?)<\/p>/g,             // hero subtitle
  /<div class="s-prose-sec"[^>]*>([\s\S]*?)(?=<div class="s-prose-sec"|<aside)/g,
  /<p class="s-p">([\s\S]*?)<\/p>/g,
];

/** Every human-readable prose block on the page, each as its own string. */
export function proseBlocks(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>/g, ' ');
  const out = [];
  for (const re of PROSE_CONTAINERS) {
    for (const m of body.matchAll(re)) { const t = clean(m[1]); if (t) out.push(t); }
  }
  return out;
}

/** Every human-readable string in the structured data, each as its own block. Parsed, not joined:
 *  a JSON blob split on full stops is not a set of sentences. */
export function schemaBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch { out.push(clean(m[1])); continue; }
    const walk = (node) => {
      if (typeof node === 'string') { if (/[a-z]{4,}\s+[a-z]{3,}/i.test(node)) out.push(node); return; }
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(parsed);
  }
  return out;
}

/** FAQ items as RENDERED, and as declared in the FAQPage node. Both surfaces are published. */
export function faqCounts(html) {
  // The two surfaces are counted from the two places they actually live: the rendered document
  // for what a reader sees, the <script> blocks for what a crawler is handed. Next serializes the
  // same props into an RSC payload inside <script>, so anything counted on the raw response risks
  // being counted twice — everything visible is measured on the stripped document.
  const rendered = html.replace(/<script[\s\S]*?<\/script>/g, ' ');
  const visible = (rendered.match(/class="s-faq-item"/g) ?? []).length;
  const schema = (html.match(/"@type":"Question"/g) ?? []).length;
  return {
    visible, schema,
    headingRendered: /Common questions/.test(rendered),
    faqPageNode: /"FAQPage"/.test(html),
  };
}

/** The deterministic layer: hero tiles, at-a-glance tiles, sidebar facts, type cards, market
 *  summaries, FAQ pairs, prose sections, inline CTA. */
export function parsePage(html) {
  const o = { hero: {}, pills: [], glance: {}, facts: {}, types: [], msum: {}, msumFlat: {}, faq: [], secs: [], cta: null };

  for (const chunk of html.split('<div class="s-hs">').slice(1)) {
    const c = chunk.slice(0, 1400);
    const l = clean((c.match(/<div class="s-l">([\s\S]*?)<\/div>/) || [])[1]);
    if (!l) continue;
    o.hero[l] = {
      v: tight((c.match(/<div class="s-n"[^>]*>([\s\S]*?)<\/div>/) || [])[1]),
      basis: clean((c.match(/<div class="s-basis">([\s\S]*?)<\/div>/) || [])[1]) || null,
      silent: /class="s-n s-silent"/.test(c),
    };
  }

  for (const m of html.matchAll(/<span class="s-pill-t">([\s\S]*?)<\/span><span class="s-pill-c">([\s\S]*?)<\/span><span class="s-pill-p[^"]*">([\s\S]*?)<\/span>/g))
    o.pills.push({ type: clean(m[1]), count: clean(m[2]), price: clean(m[3]) });

  for (const chunk of html.split('<div class="s-gi"').slice(1)) {
    const c = chunk.slice(0, 700);
    const l = clean((c.match(/<div class="s-gi-l">([\s\S]*?)<\/div>/) || [])[1]);
    if (!l) continue;
    o.glance[l] = {
      v: clean((c.match(/<div class="s-gi-v[^"]*">([\s\S]*?)<\/div>/) || [])[1]),
      d: clean((c.match(/<div class="s-gi-d">([\s\S]*?)<\/div>/) || [])[1]) || null,
    };
  }

  for (const m of html.matchAll(/<span class="s-fact-l">([\s\S]*?)<\/span><span class="s-fact-v">([\s\S]*?)<\/span>/g))
    o.facts[clean(m[1])] = clean(m[2]);

  for (const chunk of html.split('<div class="s-type" id="type-').slice(1)) {
    const c = chunk.slice(0, 4000);
    const type = (c.match(/^([a-z]+)"/) || [])[1] || '?';
    const cells = {};
    for (const cc of c.split('<div class="s-stat">').slice(1)) {
      const b = cc.slice(0, 500);
      const l = clean((b.match(/<div class="s-stat-l">([\s\S]*?)<\/div>/) || [])[1]);
      if (l) cells[l] = {
        v: clean((b.match(/<div class="s-stat-v[^"]*">([\s\S]*?)<\/div>/) || [])[1]),
        d: clean((b.match(/<div class="s-stat-d">([\s\S]*?)<\/div>/) || [])[1]) || null,
      };
    }
    o.types.push({ type, cells });
  }

  for (const chunk of html.split('<div class="s-msum">').slice(1)) {
    const c = chunk.slice(0, 2500);
    const title = clean((c.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1]);
    const stats = {};
    for (const cc of c.split('<div class="s-stat"').slice(1)) {
      const b = cc.slice(0, 400);
      const l = clean((b.match(/<div class="s-stat-l">([\s\S]*?)<\/div>/) || [])[1]);
      if (l) stats[l] = clean((b.match(/<div class="s-stat-v[^"]*">([\s\S]*?)<\/div>/) || [])[1]);
    }
    o.msum[title] = stats;
  }
  for (const chunk of html.split('<div class="s-msum-s">').slice(1)) {
    const c = chunk.slice(0, 400);
    const l = clean((c.match(/<div class="s-msum-l">([\s\S]*?)<\/div>/) || [])[1]);
    if (l) o.msumFlat[l] = clean((c.match(/<div class="s-msum-v">([\s\S]*?)<\/div>/) || [])[1]);
  }

  for (const m of html.matchAll(/<div class="s-faq-q">([\s\S]*?)<\/div><div class="s-faq-a">([\s\S]*?)<\/div>/g))
    o.faq.push({ q: clean(m[1]), a: clean(m[2]) });

  for (const chunk of html.split('<div class="s-prose-sec"').slice(1)) {
    const c = chunk.split('<div class="s-prose-sec"')[0];
    const h = clean((c.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1]) || clean((c.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1]);
    const paras = [...c.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((x) => clean(x[1])).filter(Boolean);
    o.secs.push({ h, paras });
  }

  const cta = html.match(/Typical is <b>([^<]*)<\/b>/);
  o.cta = cta ? clean(cta[1]) : null;

  // The page-level publication facts the prose guards are gated on.
  o.publishesPrice = /class="s-n"><span[^>]*>\$<\/span>|class="s-n">\$/.test(html)
    || /<div class="s-gi-l">Typical sold<\/div><div class="s-gi-v">\$/.test(html);
  o.publishesBand = /<span class="s-fact-l">Price band<\/span>/.test(html);

  return o;
}
