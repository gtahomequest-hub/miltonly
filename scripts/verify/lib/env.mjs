// Credentials come from the ENVIRONMENT. Nothing in scripts/verify/ carries a connection string,
// a token, or a host that only exists on one machine.
//
// The battery reads SOLD_DATABASE_URL and ANALYTICS_DATABASE_URL. If they are already exported
// (CI, a shell that sourced them) nothing is read from disk at all. Otherwise the repo-root .env
// and .env.local are loaded as a developer convenience — both are gitignored, and an exported
// value always wins so a local file can never override what CI set.
//
// The path is resolved FROM THIS FILE, not from process.cwd() and not from a literal absolute
// path. The scratchpad originals hardcoded C:/Users/inspe/miltonly/.env, which is why they only
// ever ran on one machine, from one directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function loadEnv() {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(REPO_ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

/** Fail loudly and by name. A missing credential must not read as "no findings". */
export function requireEnv(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    throw new Error(
      `missing required environment variable(s): ${missing.join(', ')}\n` +
      `  export them, or put them in ${path.join(REPO_ROOT, '.env.local')} (gitignored)`,
    );
  }
}

export { REPO_ROOT };
