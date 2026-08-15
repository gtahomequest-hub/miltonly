// Pull the Town of Milton open-data layers this repo derives from.
//
//   node scripts/town/fetch-layers.mjs            (writes scripts/town/.cache/*.json)
//
// Source: Town of Milton ArcGIS REST, https://api.milton.ca/arcgis/rest/services/Datasets/
// Portal: https://discover-milton.hub.arcgis.com/
// Licence: Open Government Licence – Milton v2.0 — worldwide, royalty-free, perpetual,
//          non-exclusive, commercial use expressly granted. Attribution required:
//          "Contains information licensed under the Open Government Licence – Milton."
//
// The cache is NOT committed. The generated src/data/*.ts files are — they are the reviewable
// artifact. Re-run this, then the generators, when the portal republishes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE = path.join(HERE, '.cache');

export const LAYERS = {
  roads: {
    url: 'https://api.milton.ca/arcgis/rest/services/Datasets/Roads/MapServer/0',
    // Town of Milton active road centreline, segmented by intersection.
    geometry: true,
    recordCount: 9999,
  },
  addressPoints: {
    url: 'https://api.milton.ca/arcgis/rest/services/Datasets/Address_Pts/MapServer/0',
    // One point per municipal address.
    geometry: true,
    recordCount: 99999,
  },
};

/** outSR=4326 asks the service to reproject from its native UTM 17N (wkid 26917) to WGS84.
 *  We ASSERT the result rather than trusting the parameter — see assertMilton below. */
export async function fetchLayer(name) {
  const l = LAYERS[name];
  const q = `${l.url}/query?where=1%3D1&outFields=*&returnGeometry=${l.geometry}&outSR=4326&f=json&resultRecordCount=${l.recordCount}`;
  const r = await fetch(q, { headers: { 'user-agent': 'miltonly-town-ingest' } });
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`${name}: ${JSON.stringify(j.error)}`);
  if (j.exceededTransferLimit) throw new Error(`${name}: transfer limit exceeded — raise resultRecordCount`);
  if (!Array.isArray(j.features) || !j.features.length) throw new Error(`${name}: no features returned`);
  return j;
}

/** Milton's bounding box, generously drawn. The reprojection is ASSERTED, never assumed:
 *  a silently-ignored outSR would hand back UTM metres (≈600000, ≈4800000) and every one of
 *  those passes a null check while being nowhere near Ontario. */
export const MILTON_BBOX = { minLng: -80.3, maxLng: -79.6, minLat: 43.3, maxLat: 43.75 };

export function assertMilton(points, label) {
  const bad = points.filter(([lng, lat]) =>
    !Number.isFinite(lng) || !Number.isFinite(lat) ||
    lng < MILTON_BBOX.minLng || lng > MILTON_BBOX.maxLng ||
    lat < MILTON_BBOX.minLat || lat > MILTON_BBOX.maxLat);
  if (bad.length) {
    throw new Error(
      `${label}: ${bad.length} of ${points.length} coordinates fall outside Milton's bounding box — ` +
      `the layer did not reproject to WGS84. First: ${JSON.stringify(bad[0])}`);
  }
  return points.length;
}

// No TOP-LEVEL await: the generators are .ts run through tsx, which transpiles to CJS and cannot
// require() an async module. Wrapping the CLI in an IIFE keeps this importable from both sides.
if (process.argv[1]?.endsWith('fetch-layers.mjs')) {
  void (async () => {
    fs.mkdirSync(CACHE, { recursive: true });
    for (const name of Object.keys(LAYERS)) {
      const j = await fetchLayer(name);
      fs.writeFileSync(path.join(CACHE, `${name}.json`), JSON.stringify(j));
      console.log(`${name}: ${j.features.length} features -> .cache/${name}.json`);
    }
    console.log(`pulled ${new Date().toISOString().slice(0, 10)}`);
  })();
}
