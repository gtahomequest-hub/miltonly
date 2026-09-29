// ML-014: the env-loaders prebuild gate (MC-045) fails the local build on four gitignored
// scripts/migrate-*.ts throwaways that still carry the CRLF-blind loader regex. Rewrite the regex
// in place to the CRLF-safe form the gate expects; the files are local and untracked.
import fs from 'node:fs';
const files = ['scripts/migrate-activity-check.ts', 'scripts/migrate-ads-leads.ts', 'scripts/migrate-brief-dryrun.ts', 'scripts/migrate-digest-dry.ts'];
const OLD = '/^([A-Z_][A-Z0-9_]*)=(.*)$/';
const NEW = '/^([A-Z_][A-Z0-9_]*)=(.*?)\\r?$/';
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('absent', f); continue; }
  const s = fs.readFileSync(f, 'utf8');
  const n = s.split(OLD).length - 1;
  fs.writeFileSync(f, s.split(OLD).join(NEW));
  console.log(n, 'replaced in', f, 'tracked:', !!(await import('node:child_process')).execSync(`git ls-files ${f}`).toString().trim());
}
