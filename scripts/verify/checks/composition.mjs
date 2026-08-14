// Every published street page is a street that exists.
//
// Either the Town of Milton registry holds it, or it is on the off-registry allowlist — the
// Region/rural roads the Town does not administer but which carry real sales. Nothing may be
// published off both lists.
//
// All three sides are derived: the published set from the live sitemap, the registry and the
// allowlist by reading the two source files in this working tree. "423 / 3 / 0" is a RESULT
// printed by this check, never an expectation held inside it.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../lib/env.mjs';

const DIRECTIONS = new Set(['north', 'south', 'east', 'west', 'n', 's', 'e', 'w']);
/** The identity a page unions over: {base, type}, direction dropped. */
const identity = (slug) => {
  const parts = slug.replace(/-milton$/, '').split('-').filter((p) => !DIRECTIONS.has(p));
  return `${parts.slice(0, -1).join('-')}||${parts[parts.length - 1]}`;
};

export default {
  id: 'composition',
  title: 'Every published page is a street that exists',
  wholeCorpusOnly: true,

  finish(_rows, { slugs }) {
    const registrySrc = fs.readFileSync(path.join(REPO_ROOT, 'src/data/miltonStreetRegistry.ts'), 'utf8');
    const allowSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/data/offRegistryStreets.ts'), 'utf8');
    const registry = new Set([...registrySrc.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]));
    const allowlist = new Set([...allowSrc.matchAll(/^\s*"([a-z0-9-]+)",?\s*$/gm)].map((m) => m[1]));
    if (!registry.size || !allowlist.size) throw new Error('registry or allowlist source read empty — check the parsers, not the data');

    const registryIds = new Set([...registry].map(identity));
    const allowIds = new Set([...allowlist].map(identity));

    const inRegistry = slugs.filter((s) => registry.has(s) || registryIds.has(identity(s)));
    const inAllowlist = slugs.filter((s) => !inRegistry.includes(s) && (allowlist.has(s) || allowIds.has(identity(s))));
    const neither = slugs.filter((s) => !inRegistry.includes(s) && !inAllowlist.includes(s));

    return {
      coverage: [
        ['registry entries read', registry.size],
        ['off-registry allowlist entries read', allowlist.size],
        ['published street pages', slugs.length],
        ['in the Town registry', inRegistry.length],
        ['on the off-registry allowlist', `${inAllowlist.length} (${inAllowlist.join(', ')})`],
      ],
      assertions: [
        ['published off BOTH lists', neither.length, 0],
        ['parts do not sum to the published set', inRegistry.length + inAllowlist.length + neither.length === slugs.length ? 0 : 1, 0],
      ],
      examples: neither.slice(0, 8).map((s) => `neither: ${s}`),
    };
  },
};
