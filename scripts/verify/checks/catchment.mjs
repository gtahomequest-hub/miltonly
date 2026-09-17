// NO CATCHMENT VOCABULARY IN A TITLE OR A META TAG, ON ANY PAGE THE SITEMAP LISTS.
//
// The site publishes no catchment: which homes a school admits is the board's fact (WS4, locked;
// src/lib/ai/catchmentVocabulary.ts is the render-time guard on generated prose). The 29 school
// titles said "School Zone Data" for a year anyway, because the guard reads generated paragraphs
// and a title is a template literal in a page file. The nightly audit (MA-003) found them; this
// check keeps them out.
//
// TITLES AND META ONLY, AND EVERY PAGE. The body of a listing page carries the brokerage's
// remarks, which say "zoned for" in their own voice; the body of a street page is already
// guarded at render. The <title>, the description, the keywords and the Open Graph pair are
// always the site's own words on every template, so they are held to the rule on every URL the
// sitemap lists: the crawled streets (read off the same crawl every other check uses) plus every
// other URL, fetched here. The pattern list is the audit's, kept in step by hand and asserted
// against the guard's list in the prebuild test; a word needs school, board, zone or catchment
// context within the tag's text, the way MA-003 reads it, except "school zone" and "feeder
// school", which carry their context in the match.
import { get, publishedStreetSlugs } from '../lib/http.mjs';
import { clean } from '../lib/parse.mjs';

export const PATTERNS = [
  /\bcatchments?\b/gi,
  /\bboundar(?:y|ies)\b/gi,
  /\bzoned?\s+(?:for|to)\b/gi,
  /\bdraws?\s+from\b/gi,
  /\bdrawing\s+from\b/gi,
  /\bfeeds?\s+into\b/gi,
  /\bfeeding\s+into\b/gi,
  /\bassigned\s+to\b/gi,
  /\bschool\s+zones?\b/gi,
  /\bfeeder\s+schools?\b/gi,
  /\bdraws?\s+to\b/gi,
  /\bdrawing\s+to\b/gi,
  /\bserv(?:es?|ing)\s+the\s+(?:area|street|neighbourhood)\b/gi,
];
const CONTEXT = /\b(schools?|boards?|zones?|catchments?)\b/i;

const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i')) || [])[1];

/** The site's own words in the head: title, description, keywords, og:title, og:description. */
export function headFields(html) {
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html.slice(0, 20000)])[0];
  const out = {};
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) out.title = clean(title[1]);
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const key = (attr(tag, 'name') || attr(tag, 'property') || '').toLowerCase();
    if (['description', 'keywords', 'og:title', 'og:description', 'twitter:title', 'twitter:description'].includes(key)) {
      out[key] = clean(attr(tag, 'content'));
    }
  }
  return out;
}

/** Pure: the findings for one page's head fields, as `field: "match"` strings. */
export function catchmentHits(fields) {
  const hits = [];
  for (const [field, text] of Object.entries(fields)) {
    if (!text) continue;
    for (const re of PATTERNS) {
      re.lastIndex = 0;
      const m = re.exec(text);
      if (!m) continue;
      if (!CONTEXT.test(m[0]) && !CONTEXT.test(text)) continue;
      hits.push(`${field}: "${m[0]}" in "${text.slice(0, 90)}"`);
      break;
    }
  }
  return hits;
}

export default {
  id: 'catchment',
  title: 'No catchment vocabulary in a title or a meta tag on any page',

  perPage(slug, html) {
    return { url: `/streets/${slug}`, hits: catchmentHits(headFields(html)) };
  },

  async finish(rows, { base }) {
    // Every sitemap URL that is not a street page: fetched here, once, at the crawl's concurrency.
    const sm = await get(`${base}/sitemap.xml`);
    if (sm.status !== 200) throw new Error(`sitemap at ${base} returned ${sm.status}`);
    const origin = (sm.body.match(/<loc>(https?:\/\/[^/<]+)/) || [])[1] || base;
    const others = [...new Set(
      [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(origin, '').replace(/\/$/, '') || '/'),
    )].filter((u) => !u.startsWith('/streets/'));
    const streets = await publishedStreetSlugs(base);

    const fetched = [];
    let i = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (i < others.length) {
        const url = others[i++];
        const r = await get(`${base}${url}`);
        fetched.push({ url, status: r.status, hits: r.status === 200 ? catchmentHits(headFields(r.body)) : [] });
      }
    }));
    const unread = fetched.filter((f) => f.status !== 200);
    const all = [...rows, ...fetched.filter((f) => f.status === 200)];
    const offenders = all.filter((r) => r.hits.length);

    return {
      coverage: [
        ['street pages read off the crawl', rows.length],
        ['other sitemap pages fetched', fetched.length],
        ['sitemap pages not read (non-200)', unread.length],
      ],
      assertions: [
        ['pages read == sitemap URLs', all.length + unread.length, streets.length + others.length],
        ['sitemap pages not read', unread.length, 0],
        ['pages with catchment vocabulary in a title or a meta tag', offenders.length, 0],
      ],
      examples: [
        ...unread.slice(0, 3).map((f) => `${f.url} -> ${f.status}`),
        ...offenders.slice(0, 6).map((r) => `${r.url} · ${r.hits[0]}`),
      ],
    };
  },
};
