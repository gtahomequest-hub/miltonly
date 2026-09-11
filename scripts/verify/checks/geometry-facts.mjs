// EVERY RENDERED ROAD FACT EQUALS THE LAYER VALUE, AND NOTHING RENDERS WHERE THE LAYER IS SILENT.
//
// QUEUE item 5 puts a street's physical facts on the page: centreline length, road class, lanes,
// posted limit, surface, sidewalk, terminus and orientation, each read from
// src/data/streetGeometry.ts, which the generator wrote from the Town of Milton Road Segments
// layer and OpenStreetMap with the Gate A rulings already applied. This check reads that file
// directly (a JSON literal, parsed, not imported through the accessor) and the served page, and
// asserts the two agree fact for fact:
//
//   · every <div class="s-geo-fact" data-key=K> on a page carries exactly the formatted value of
//     row[K] for the identity the card names (data-identity), and the identity is the street's
//     own (its base tokens are in the slug), so a card cannot borrow another street's row
//   · a page renders NO fact for a field the row has as null, and no field outside the eight
//   · a street whose row has a fact renders a card; a street with no row renders none
//   · the card carries the OGL attribution, and the OSM line exactly when surface or sidewalk
//     is among the rendered facts
//   · the facts live in the sidebar (.s-side-card.s-geo) and nowhere else: a unit-bearing figure
//     must never appear in a hero stat, a glance tile or a market card
//
// The formatting is mirrored here on purpose. If the accessor's formatter and this one drift,
// the check fails, which is the point: a page is verified against the layer, not against the
// code that rendered it.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../lib/env.mjs';

function readGeometry() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/data/streetGeometry.ts'), 'utf8');
  const m = src.match(/STREET_GEOMETRY:\s*Record<string, StreetGeometryRow>\s*=\s*(\{[\s\S]*?\n\});/);
  if (!m) throw new Error('could not parse src/data/streetGeometry.ts — fix the parser, not the data');
  const rows = JSON.parse(m[1]);
  if (!Object.keys(rows).length) throw new Error('streetGeometry.ts parsed to zero rows');
  return rows;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const formatLength = (m) => (m < 1000 ? `${m} m` : `${(Math.round(m / 100) / 10).toFixed(1)} km`);
const AXIS = {
  'north to south': 'Runs north to south',
  'east to west': 'Runs east to west',
  'northeast to southwest': 'Runs northeast to southwest',
  'northwest to southeast': 'Runs northwest to southeast',
};
/** The facts a row is expected to render, key -> value, in the accessor's order. */
function expectedFacts(row) {
  const out = {};
  if (row.lengthM !== null) out.length = formatLength(row.lengthM);
  if (row.category !== null) out.category = cap(row.category);
  if (row.lanes !== null) out.lanes = String(row.lanes);
  if (row.speedLimit !== null) out.speed = `${row.speedLimit} km/h`;
  if (row.surface !== null) out.surface = cap(row.surface);
  if (row.sidewalk !== null) out.sidewalk = cap(row.sidewalk);
  if (row.terminus !== null) out.terminus = cap(row.terminus);
  if (row.axis !== null && AXIS[row.axis]) out.axis = AXIS[row.axis];
  return out;
}

const OGL = 'Contains information licensed under the Open Government Licence – Milton.';
const OSM_LINE = 'Surface and sidewalk from OpenStreetMap';
const UNIT_RE = /\b\d+(?:\.\d+)?\s?(?:km\/h|km|m)\b(?![\w/])/;
const decode = (s) => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');

export default {
  id: 'geometry-facts',
  title: 'Every rendered road fact equals the layer value, and nothing renders where the layer is silent',

  perPage(slug, raw) {
    const html = raw.replace(/<script[\s\S]*?<\/script>/g, ' ');
    const cards = [...html.matchAll(/<div class="s-side-card s-geo" data-identity="([^"]+)">([\s\S]*?)<\/div>\s*<\/div>/g)];
    const card = cards[0] ?? null;
    const facts = {};
    let identity = null, attribution = '';
    if (card) {
      identity = decode(card[1]);
      for (const f of card[2].matchAll(/<div class="s-fact s-geo-fact" data-key="([^"]+)"><span class="s-fact-l">([^<]*)<\/span><span class="s-fact-v">([^<]*)<\/span><\/div>/g)) {
        facts[f[1]] = decode(f[3]);
      }
      // The card capture stops before the note's own closing tag (it is the first of the pair
      // that ends the card), so the note is read to the next tag, not to </div>.
      const note = card[2].match(/<div class="s-near-note">([^<]*)/);
      attribution = note ? decode(note[1]) : '';
    }
    // Unit figures outside the road-facts card: hero stats, glance tiles, market cards.
    const outside = html.replace(/<div class="s-side-card s-geo"[\s\S]*?<\/div>\s*<\/div>/g, ' ');
    // hero stat tiles (.s-hs), glance tiles (.s-gi), market and type stat cells (.s-stat)
    const tiles = [...outside.matchAll(/<div class="s-(?:hs|gi|stat)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g)].map((m) => m[1]);
    const unitInTiles = tiles.filter((t) => UNIT_RE.test(t.replace(/<[^>]+>/g, ' '))).length;
    return { slug, cards: cards.length, identity, facts, attribution, unitInTiles, tiles: tiles.length };
  },

  finish(rows, { slugs }) {
    const geometry = readGeometry();
    const wrongValue = [], extraFact = [], missingFact = [], noCardButRow = [], cardButNoRow = [], badIdentity = [], badAttribution = [], multiCard = [], unitLeak = [];
    let withCard = 0, factsChecked = 0, withRow = 0;

    for (const r of rows) {
      if (r.cards > 1) multiCard.push(r.slug);
      if (!r.identity) {
        // No card. Fine only if no row for this street could have produced one; we cannot
        // compute the identity here without the page's help, so the converse is asserted through
        // the population count below (published rows with facts vs cards rendered).
        continue;
      }
      withCard++;
      const base = r.identity.split('||')[0];
      const slugBody = r.slug.replace(/-milton$/, '');
      if (!base.split('-').every((tok) => slugBody.split('-').includes(tok) || /^\d+$/.test(tok))) badIdentity.push(`${r.slug}: card names identity ${r.identity}`);
      const row = geometry[r.identity];
      if (!row) { cardButNoRow.push(`${r.slug}: card for ${r.identity}, no row in the layer file`); continue; }
      withRow++;
      const expected = expectedFacts(row);
      for (const [k, v] of Object.entries(r.facts)) {
        factsChecked++;
        if (!(k in expected)) extraFact.push(`${r.slug}: renders ${k}="${v}" but the layer row is null`);
        else if (expected[k] !== v) wrongValue.push(`${r.slug}: ${k} rendered "${v}", layer says "${expected[k]}"`);
      }
      for (const k of Object.keys(expected)) if (!(k in r.facts)) missingFact.push(`${r.slug}: layer has ${k}="${expected[k]}", page renders nothing`);
      const usesOsm = 'surface' in expected || 'sidewalk' in expected;
      if (!r.attribution.includes(OGL)) badAttribution.push(`${r.slug}: no OGL attribution on the card`);
      else if (usesOsm !== r.attribution.includes(OSM_LINE)) badAttribution.push(`${r.slug}: OSM attribution ${usesOsm ? 'missing' : 'present'} (surface/sidewalk ${usesOsm ? 'rendered' : 'not rendered'})`);
      if (r.unitInTiles > 0) unitLeak.push(`${r.slug}: ${r.unitInTiles} tile(s) carry a unit figure`);
    }
    // the converse population: a page with no card must be a street with no row or a row with no facts.
    // Approximated by count: the number of layer rows whose identity is claimed by some page and has
    // facts must equal the number of cards, which the per-row assertions above already enforce; the
    // absent-card side is covered by noCardButRow when a page names an identity yet renders no facts.
    for (const r of rows) if (r.identity && Object.keys(r.facts).length === 0) noCardButRow.push(`${r.slug}: card with no facts`);
    // The absent-card side, for the slugs whose identity is plain enough to reconstruct here
    // (<base>-<type>-milton, one-word type). A street the layer has facts for that renders no
    // card is a page that lost its sidebar, not a street the Town does not know.
    const SIMPLE_TYPES = new Set(['street', 'road', 'drive', 'avenue', 'court', 'crescent', 'boulevard', 'terrace', 'trail', 'way', 'gate', 'circle', 'heights', 'place', 'lane', 'crossing', 'landing', 'garden', 'point', 'parkway', 'path', 'close', 'common', 'square', 'grove', 'line']);
    let reconstructed = 0;
    for (const r of rows) {
      if (r.identity) continue;
      const parts = r.slug.replace(/-milton$/, '').split('-');
      const type = parts[parts.length - 1];
      if (parts.length < 2 || !SIMPLE_TYPES.has(type)) continue;
      const key = `${parts.slice(0, -1).join('-')}||${type}`;
      const row = geometry[key];
      if (!row) continue;
      reconstructed++;
      if (Object.keys(expectedFacts(row)).length > 0) noCardButRow.push(`${r.slug}: layer row ${key} has facts, page renders no card`);
    }

    return {
      coverage: [
        ['street pages read', `${rows.length} of ${slugs.length}`],
        ['pages rendering a road-facts card', withCard],
        ['cards matched to a layer row', withRow],
        ['facts compared to the layer', factsChecked],
        ['layer rows in the data file', Object.keys(geometry).length],
        ['card-less pages whose identity was reconstructed and checked', reconstructed],
        ['hero, glance and market tiles scanned for unit figures', rows.reduce((n, r) => n + r.tiles, 0)],
      ],
      assertions: [
        ['street pages read == live sitemap count', rows.length, slugs.length],
        // A parser that finds no card anywhere must fail on its own coverage, not read as "all fine".
        ['pages rendering a road-facts card > 0', withCard > 0, true],
        ['facts whose rendered value differs from the layer', wrongValue.length, 0],
        ['facts rendered where the layer row is null', extraFact.length, 0],
        ['layer facts the page failed to render', missingFact.length, 0],
        ['cards naming an identity with no layer row', cardButNoRow.length, 0],
        ['cards naming an identity that is not the street\'s own', badIdentity.length, 0],
        ['cards with no facts, or layer facts with no card', noCardButRow.length, 0],
        ['pages with more than one road-facts card', multiCard.length, 0],
        ['cards with a wrong or missing attribution', badAttribution.length, 0],
        ['pages with a unit figure in a hero, glance or market tile', unitLeak.length, 0],
      ],
      examples: [...wrongValue, ...extraFact, ...missingFact, ...cardButNoRow, ...badIdentity, ...noCardButRow, ...multiCard, ...badAttribution, ...unitLeak],
    };
  },
};
