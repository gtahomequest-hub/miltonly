// MA-011. MC-045's WRONG compass sentences, which MC-048 stripped from 56 street pages, must stay gone.
// Adopted from Core's scripts/audit/verify-strip.mjs (MC-048): the same matcher, now shared by that
// CLI and the nightly. The sentences and the positive controls are frozen in banned-sentences.json
// (built by `node scripts/audit/verify-strip.mjs --freeze` from Core's two files, whose hashes it
// records), so the nightly does not depend on another task's scratchpad.
//
// The matcher reads the whole served document (prose, hero, JSON-LD, meta tag contents) after decoding HTML
// entities and JSON string escapes and folding curly quotes to straight ones on both sides, so an
// encoding difference cannot hide a match. A POSITIVE CONTROL keeps a clean result honest: on every
// stripped page a sentence the page still renders must be found by the same matcher; a page whose
// control is missing is unverified, not clean.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BANNED_FILE = path.join(HERE, 'banned-sentences.json');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—' };
export function normalize(s) {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(["\\/])/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/g, (m, n) => ENT[n] ?? m)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ');
}
export const fold = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

/** { source, pages: { slug: { sentences: [folded], controls: [folded] | null } } } */
export function loadBanned(file = BANNED_FILE) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

// Core's matcher stripped every tag, so a sentence in a meta tag's content attribute (the description,
// og: and twitter: cards) was never seen although its comment says it reads the meta tags. MA-011 reads
// those values too; it can only find more.
const metaContents = (html) => [...html.matchAll(/<meta\b[^>]*?\bcontent\s*=\s*("([^"]*)"|'([^']*)')/gi)].map((m) => m[2] ?? m[3]).join(' \n ');

/** The strip check on one served document: which banned sentences it carries, and whether its control is there. */
export function checkStrip(entry, html) {
  const doc = `${normalize(html)} ${normalize(metaContents(html))}`;
  const found = entry.sentences.filter((t) => doc.includes(t));
  const pool = entry.controls;
  const control = pool ? (pool.find((s) => doc.includes(s.startsWith('@fallback:') ? s.slice('@fallback:'.length) : s)) ?? null) : undefined;
  return { found, control: pool ? (control ? 'found' : 'missing') : 'none', controlText: control ?? null };
}

function parseCsv(t) {
  const rows = []; let f = '', row = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...b] = rows;
  return b.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, j) => [k, r[j]])));
}

/** Build the frozen file's content from Core's CSV of claims and its render controls. */
export function freezeBanned(csvPath, renderPath) {
  const csv = fs.readFileSync(csvPath, 'utf8');
  const render = fs.readFileSync(renderPath, 'utf8');
  const claims = parseCsv(csv);
  const controls = JSON.parse(render).controls || {};
  const pages = {};
  for (const c of claims) {
    const e = (pages[c.slug] ||= { claims: 0, sentences: [], controls: controls[c.slug] ? controls[c.slug].map(fold) : null });
    e.claims++;
    const t = fold(c.text); if (!e.sentences.includes(t)) e.sentences.push(t);
  }
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
  return {
    $comment: 'MA-011. Frozen from MC-045/MC-048 by scripts/audit/verify-strip.mjs --freeze. Every sentence must stay off its page; every control must stay on it. Do not edit by hand.',
    source: { csv: path.relative(path.resolve(HERE, '..', '..', '..'), csvPath).replace(/\\/g, '/'), csvSha256: sha(csv), render: path.relative(path.resolve(HERE, '..', '..', '..'), renderPath).replace(/\\/g, '/'), renderSha256: sha(render) },
    counts: { pages: Object.keys(pages).length, claims: claims.length, sentences: Object.values(pages).reduce((n, e) => n + e.sentences.length, 0), controls: Object.values(pages).filter((e) => e.controls).length },
    pages,
  };
}
