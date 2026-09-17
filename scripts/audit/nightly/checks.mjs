// MA-002. Per-page checks on raw HTML. No browser, no database: everything here reads the
// document the host served and returns findings. The browser-only checks (fonts under 12 px,
// overflow at 390) live in browser.mjs.
//
// A finding is { code, sev, key, detail }. `code` names the check, `key` disambiguates within a
// page (an href, a word), and code + key + path is the identity the nightly diff compares.

// Vocabulary. Mirrors src/lib/ai/validateStreetGeneration.ts (SUPERLATIVE_PHRASES) and
// src/lib/ai/catchmentVocabulary.ts (BAN_PATTERNS) so the audit judges rendered text by the same
// lists the validators judge generated text. Kept in sync by hand; the audit cannot import TS.
export const SUPERLATIVES = [
  'best', 'unbeatable', 'nothing comes close', 'premier', 'second to none', 'finest',
  'most desirable', 'top-tier', 'world-class', 'unparalleled', 'unmatched',
];
// MA-003. Every catchment word needs school, board, zone or catchment context within twelve words.
// The two bare nouns are S2 and are never a finding in a sentence about the Town polygon or a
// distance ("Schools whose position falls inside the Town of Milton's boundary", "measured
// boundary centre to boundary centre"). The hub's disclaimer sentence is exempt outright.
// Every assignment form (zoned for, feeds into, feeder school) is S1, the locked WS4 rule.
const CATCHMENT_CONTEXT = /\b(schools?|boards?|zones?|catchments?)\b/i;
const POLYGON_OR_DISTANCE_RE = /\b(Town of Milton|Town'?s|Town polygon|polygon|inside the boundary|within the boundary|neighbourhood'?s? boundary|kilometres?|km|metres?|distance|measured|centre to|closest|nearest|within \d)\b/i;
const DISCLAIMER_RE = /a catchment is the school board.s fact/i;
const LABEL_RE = /listing agent.s remarks/i;
export const CATCHMENT = [
  { re: /\bcatchments?\b/gi, sev: 2, bareNoun: true },
  { re: /\bboundar(?:y|ies)\b/gi, sev: 2, bareNoun: true },
  { re: /\bzoned?\s+(?:for|to)\b/gi },
  { re: /\bdraws?\s+from\b/gi },
  { re: /\bdrawing\s+from\b/gi },
  { re: /\bfeeds?\s+into\b/gi },
  { re: /\bfeeding\s+into\b/gi },
  { re: /\bassigned\s+to\b/gi },
  { re: /\bschool\s+zones?\b/gi },
  { re: /\bfeeder\s+schools?\b/gi },
  { re: /\bdraws?\s+to\b/gi },
  { re: /\bdrawing\s+to\b/gi },
  { re: /\bserv(?:es?|ing)\s+the\s+(?:area|street|neighbourhood)\b/gi },
];
// The sentence around an index: from the previous full stop, question mark, exclamation mark,
// colon or line break to the next one.
function sentenceAt(text, idx) {
  const a = Math.max(text.lastIndexOf('.', idx), text.lastIndexOf('!', idx), text.lastIndexOf('?', idx), text.lastIndexOf('\n', idx), text.lastIndexOf(':', idx));
  const ends = ['.', '!', '?', '\n'].map((c) => text.indexOf(c, idx)).filter((i) => i >= 0);
  const b = ends.length ? Math.min(...ends) : text.length;
  return text.slice(a + 1, b);
}
// Feed enumerations as the TRREB feed spells them. Any of these in rendered text means a raw
// field reached the page without passing through a label map. Board attribution ("TRREB", the
// MLS mark) is required by the IDX rules and is not on this list.
export const TREB_STRINGS = [
  'Att/Row/Townhouse', 'Att/Row/Twnhouse', 'Condo Apt', 'Comm Element Condo', 'Co-Op Apt',
  'Co-Ownership Apt', 'Det Condo', 'Semi-Det Condo', 'Vacant Land Condo', 'Leasehold Condo',
  'Det W/Com Elements', 'Rural Resid', 'Multiplex', 'Sq Ft', 'W/O', 'Bsmt', 'Lrg',
  'Interboard', 'Sale Of Business', 'Bungalow-Raised', 'Sidesplit', 'Backsplit',
];
const TREB_RE = new RegExp('(?<![\\w/])(?:' + TREB_STRINGS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\w/])', 'g');
// The short tokens are remark shorthand as often as feed fields. They count only next to a slash or
// a comma, and never on a listing page, where the remarks are the seller's words.
const SHORT_FEED_TOKENS = new Set(['Lrg', 'Bsmt', 'W/O', 'Sq Ft']);

// Host leaks: any absolute URL that is not the canonical host.
const LEAK_RE = /https?:\/\/(?:[a-z0-9-]+\.)*(?:vercel\.app|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?)|http:\/\/(?:www\.)?miltonly\.com|https:\/\/www\.miltonly\.com/gi;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', copy: '\u00a9', reg: '\u00ae' };
export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}

// Visible text: the body without scripts, styles, templates and tags. Block tags become
// newlines so words on either side of a tag do not fuse.
export function visibleText(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<\/?(p|div|li|h[1-6]|br|tr|td|th|section|article|header|footer|nav|dt|dd|blockquote|figcaption|summary)\b[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  return decode(s).replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')); return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null; };
const hasAttr = (tag, name) => new RegExp(`\\s${name}(\\s|=|>|/)`, 'i').test(tag);

export function excerpt(text, idx, len = 90) {
  const a = Math.max(0, idx - Math.floor(len / 2)); const b = Math.min(text.length, idx + Math.floor(len / 2));
  return (a > 0 ? '\u2026' : '') + text.slice(a, b).replace(/\s+/g, ' ') + (b < text.length ? '\u2026' : '');
}

// Parse the parts of the document the checks need.
export function parse(html) {
  const bodyAt = html.search(/<body\b/i);
  const head = html.slice(0, bodyAt > 0 ? bodyAt : html.length);
  let body = bodyAt > 0 ? html.slice(bodyAt) : html;
  // MA-003: blocks Core labels as the listing agent's remarks (a data-remarks attribute) are the
  // seller's words. They leave the body before the vocabulary checks; each one must carry the
  // visible label "Listing agent's remarks", inside it or just before it.
  const remarks = [];
  const openRe = /<([a-z][a-z0-9-]*)\b[^>]*\sdata-remarks(?:=|\s|>|\/)[^>]*>/gi;
  let o;
  while ((o = openRe.exec(body))) {
    const tag = o[1].toLowerCase();
    const pair = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    pair.lastIndex = o.index + o[0].length;
    let depth = 1; let end = -1; let p;
    while ((p = pair.exec(body))) { depth += p[1] ? -1 : 1; if (depth === 0) { end = p.index + p[0].length; break; } }
    if (end < 0) end = Math.min(body.length, o.index + o[0].length + 20000);
    const block = body.slice(o.index, end);
    const around = body.slice(Math.max(0, o.index - 300), o.index);
    const lastLine = visibleText(around).split('\n').filter((l) => l.trim()).pop() || '';
    const labelled = LABEL_RE.test(visibleText(block)) || LABEL_RE.test(lastLine);
    remarks.push({ index: remarks.length, labelled, text: visibleText(block).slice(0, 80) });
    body = body.slice(0, o.index) + ' '.repeat(end - o.index) + body.slice(end);
    openRe.lastIndex = end;
  }
  const title = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const metaByName = (n) => { const t = metas.find((m) => (attr(m, 'name') || '').toLowerCase() === n || (attr(m, 'property') || '').toLowerCase() === n); return t ? attr(t, 'content') : null; };
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const canonicalTag = links.find((l) => (attr(l, 'rel') || '').toLowerCase() === 'canonical');
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => visibleText(m[1]));
  const jsonld = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => attr(m[0], 'href')).filter((h) => h != null);
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const ids = new Set([...html.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((m) => m[1]).concat([...html.matchAll(/\sname\s*=\s*"([^"]+)"/g)].map((m) => m[1])));
  return { title: title == null ? null : decode(title).replace(/\s+/g, ' ').trim(), description: metaByName('description'), ogUrl: metaByName('og:url'), robots: metaByName('robots'), canonical: canonicalTag ? attr(canonicalTag, 'href') : null, h1s, jsonld, anchors, imgs, ids, remarks, text: visibleText(body) };
}

function proper(text, idx, len) {
  // A capitalised match reads as a proper noun ("Premier Ford", "Best Buy") when it is not at the
  // start of a sentence, or when the next word is capitalised too. The validator masks grounded
  // proper nouns; this is the cheap equivalent.
  const ch = text[idx]; if (ch !== ch.toUpperCase()) return false;
  const before = text.slice(Math.max(0, idx - 3), idx);
  const midSentence = !/(^|[.!?\n]\s*)$/.test(before) && before.trim() !== '';
  const next = text.slice(idx + len).match(/^\s+([A-Z])/);
  return midSentence || !!next;
}

// Voice checks over a string. `voice` is false on pages whose body is third-party text (listing
// remarks): there the em-dash and superlative checks are off, the catchment check needs school
// context, and the short feed tokens do not count.
export function vocabularyFindings(text, { voice = true, where = 'text' } = {}) {
  const out = [];
  if (voice) {
    const dashes = [...text.matchAll(/\u2014/g)];
    if (dashes.length) out.push({ code: 'em-dash', sev: 3, key: where, detail: `${dashes.length} in ${where}: ${excerpt(text, dashes[0].index)}` });
    for (const w of SUPERLATIVES) {
      const re = new RegExp(`\\b${w.replace(/[-\s]+/g, '[-\\s]+')}\\b`, 'gi');
      let m; while ((m = re.exec(text))) { if (!proper(text, m.index, m[0].length)) { out.push({ code: 'superlative', sev: 3, key: `${where}:${w}`, detail: `"${m[0]}" in ${where}: ${excerpt(text, m.index)}` }); break; } }
    }
  }
  for (const { re, bareNoun, sev = 1 } of CATCHMENT) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(text))) {
      // MA-003: a catchment word counts only within twelve words of school, board, zone or
      // catchment context, never inside the hub's own disclaimer, and the bare nouns never in a
      // sentence about the Town polygon or a distance.
      // The match itself supplies context when it names a school or a zone ("school zone", "feeder
      // school"); otherwise the twelve words on either side must.
      const before = text.slice(Math.max(0, m.index - 400), m.index).split(/\s+/).slice(-12).join(' ');
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 400).split(/\s+/).slice(0, 13).join(' ');
      if (!CATCHMENT_CONTEXT.test(m[0]) && !CATCHMENT_CONTEXT.test(`${before} ${after}`)) continue;
      const sentence = sentenceAt(text, m.index);
      if (DISCLAIMER_RE.test(sentence)) continue;
      if (bareNoun && POLYGON_OR_DISTANCE_RE.test(sentence)) continue;
      out.push({ code: 'catchment', sev, key: `${where}:${m[0].toLowerCase()}`, detail: `"${m[0]}" in ${where}: ${excerpt(text, m.index)}` }); break;
    }
  }
  TREB_RE.lastIndex = 0; let t; const seen = new Set();
  while ((t = TREB_RE.exec(text))) {
    const s = t[0];
    if (SHORT_FEED_TOKENS.has(s) && (!voice || !/[\/,]/.test(text.slice(Math.max(0, t.index - 2), t.index + s.length + 2)))) continue;
    if (seen.has(s)) continue; seen.add(s);
    out.push({ code: 'treb-string', sev: 2, key: `${where}:${s}`, detail: `"${s}" in ${where}: ${excerpt(text, t.index)}` });
  }
  return out;
}

// All raw-HTML findings for one page. `finalPath` is the path the document was served from.
// `listing` marks a listing page: until Core labels the remarks block, its body is the seller's
// words and the voice checks stand down; once a data-remarks block exists, the block leaves the
// body and everything left is our own copy, checked in full.
export function pageFindings({ html, path: finalPath, base, listing = false }) {
  const d = parse(html);
  const f = [];
  const voice = !listing || d.remarks.length > 0;
  for (const r of d.remarks) if (!r.labelled) f.push({ code: 'remarks-unlabelled', sev: 2, key: String(r.index), detail: `data-remarks block ${r.index + 1} has no "Listing agent's remarks" label: "${r.text}"` });
  if (listing && !d.remarks.length) f.push({ code: 'remarks-unmarked', sev: 3, key: '', detail: 'no data-remarks block, so the remarks cannot be told from our copy; voice checks stood down on the body' });
  const host = new URL(base).host;

  if (d.title == null || !d.title) f.push({ code: 'title-missing', sev: 2, key: '', detail: 'no <title>' });
  else if (d.title.length < 20 || d.title.length > 65) f.push({ code: 'title-length', sev: 3, key: '', detail: `${d.title.length} chars: "${d.title}"` });
  if (d.description == null || !d.description.trim()) f.push({ code: 'meta-missing', sev: 2, key: '', detail: 'no meta description' });
  else if (d.description.length < 50 || d.description.length > 165) f.push({ code: 'meta-length', sev: 3, key: '', detail: `${d.description.length} chars: "${d.description.slice(0, 80)}${d.description.length > 80 ? '\u2026' : ''}"` });
  if (d.h1s.length === 0) f.push({ code: 'h1-missing', sev: 2, key: '', detail: 'no <h1>' });
  else if (d.h1s.length > 1) f.push({ code: 'h1-multiple', sev: 2, key: '', detail: `${d.h1s.length} h1: ${d.h1s.map((h) => `"${h.slice(0, 40)}"`).join(', ')}` });

  const expectCanonical = `${base}${finalPath}`;
  if (!d.canonical) f.push({ code: 'canonical-missing', sev: 2, key: '', detail: 'no rel=canonical' });
  else {
    let c; try { c = new URL(d.canonical, base); } catch { c = null; }
    const got = c ? `${c.origin}${c.pathname.replace(/\/$/, '') || '/'}` : d.canonical;
    if (got !== expectCanonical) f.push({ code: 'canonical-mismatch', sev: 2, key: '', detail: `canonical ${d.canonical}, served at ${finalPath}` });
  }

  d.jsonld.forEach((raw, i) => {
    try { const j = JSON.parse(raw); const types = [].concat(j['@graph'] || j).map((x) => x && x['@type']).filter(Boolean); if (!types.length) f.push({ code: 'jsonld-parse', sev: 1, key: String(i), detail: `block ${i + 1} has no @type` }); }
    catch (e) { f.push({ code: 'jsonld-parse', sev: 1, key: String(i), detail: `block ${i + 1}: ${e.message.slice(0, 80)}` }); }
  });

  const leaks = new Set([...html.matchAll(LEAK_RE)].map((m) => m[0]));
  for (const l of leaks) f.push({ code: 'host-leak', sev: 1, key: l, detail: `${l} in the document` });

  f.push(...vocabularyFindings(d.text, { voice, where: 'text' }));
  // The title and the description are always the site's own words, whatever the body is.
  if (d.title) f.push(...vocabularyFindings(d.title, { voice: true, where: 'title' }));
  if (d.description) f.push(...vocabularyFindings(d.description, { voice: true, where: 'meta' }));

  const noAlt = d.imgs.filter((t) => !hasAttr(t, 'alt'));
  if (noAlt.length) f.push({ code: 'img-alt-missing', sev: 3, key: '', detail: `${noAlt.length} <img> without alt, first: ${(attr(noAlt[0], 'src') || '').slice(0, 80)}` });

  // Dead anchors: same-page fragments to no id.
  const dead = new Set();
  for (const h of d.anchors) {
    let frag = null;
    if (h.startsWith('#')) frag = h.slice(1);
    else if (h.startsWith(`${finalPath}#`)) frag = h.slice(finalPath.length + 1);
    else if (h.startsWith(`${base}${finalPath}#`)) frag = h.slice(`${base}${finalPath}#`.length);
    if (frag && frag !== 'top' && frag !== '' && !d.ids.has(decodeURIComponent(frag))) dead.add(h);
  }
  for (const h of dead) f.push({ code: 'dead-anchor', sev: 3, key: h, detail: `${h} matches no id on the page` });

  // Internal links out, normalised to path + search. The run aggregates them by target, so a slug
  // linked from a hundred pages is one finding with a hundred referrers, not a hundred findings.
  const internal = new Map();
  const crossAnchors = [];
  for (const h of d.anchors) {
    if (/^(mailto:|tel:|sms:|javascript:|#)/i.test(h)) continue;
    let u; try { u = new URL(h, base); } catch { continue; }
    if (u.host !== host) continue;
    const p = (u.pathname.replace(/\/+$/, '') || '/') + u.search;
    if (/^\/(_next|api)\//.test(p) || /\.(png|jpe?g|webp|svg|ico|xml|txt|pdf|mp4|webm)$/i.test(u.pathname)) continue;
    internal.set(p, (internal.get(p) || 0) + 1);
    if (u.hash && u.pathname !== finalPath) crossAnchors.push({ path: u.pathname.replace(/\/+$/, '') || '/', frag: decodeURIComponent(u.hash.slice(1)) });
  }
  return { findings: f, internal, crossAnchors, ids: d.ids, meta: { title: d.title, h1: d.h1s[0] ?? null, robots: d.robots } };
}
