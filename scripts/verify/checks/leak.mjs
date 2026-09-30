// MC-046: THE LEAK TEST, as a battery check. It runs scripts/verify/leak.mjs against the same
// target (every page type, HTML and RSC, JSON-LD, the signed-out API routes, the card and OG, the
// sitemaps, a 404 and the 500) and asserts zero findings. The script prints totals only; this
// check carries its summary line and its exit code, never a value.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'leak.mjs');

export default {
  id: 'leak',
  title: 'A signed-out client finds no VOW-derived value in any page, payload or signed-out API',
  wholeCorpusOnly: true,

  async finish(_rows, { base }) {
    const rsc = process.env.LEAK_RSC || 'all';
    const r = spawnSync(process.execPath, [SCRIPT, '--pages=all', `--rsc=${rsc}`], {
      env: { ...process.env, BASE: base },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 40 * 60 * 1000,
    });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const summary = out.split('\n').find((l) => /^(CLEAN|LEAK) · /.test(l)) ?? 'no summary line';
    const failing = out.split('\n').filter((l) => l.startsWith('FAIL ')).map((l) => l.replace(/\s+/g, ' ').slice(0, 160));
    return {
      coverage: [['leak test', summary], ...failing.map((l) => ['failing surface', l])],
      assertions: [
        ['the leak test ran to completion (exit 0 clean, 1 findings; 2 is could-not-run)', r.status === 2 || r.status === null ? 'did not run' : 'ran', 'ran'],
        ['VOW-derived findings on anonymous surfaces', r.status === 0 ? 0 : (Number((summary.match(/(\d+) findings/) || [])[1]) || 'unknown'), 0],
      ],
    };
  },
};
