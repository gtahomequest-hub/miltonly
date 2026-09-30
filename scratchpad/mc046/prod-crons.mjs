// MC-046: the cron list a deployment carries, read from the Vercel API with the CLI's stored token.
// Prints paths (query strings redacted) and schedules only; the token is never printed.
import fs from 'node:fs';
import path from 'node:path';
const auth = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'com.vercel.cli', 'Data', 'auth.json'), 'utf8'));
const repo = JSON.parse(fs.readFileSync('.vercel/repo.json', 'utf8'));
const proj = repo.projects?.[0] ?? repo;
const team = proj.orgId;
const target = process.argv[2]; // deployment URL host
const r = await fetch(`https://api.vercel.com/v13/deployments/${target}?teamId=${team}`, { headers: { authorization: `Bearer ${auth.token}` } });
const d = await r.json();
if (!r.ok) { console.log(`api ${r.status} ${d.error?.code ?? ''}`); process.exit(1); }
console.log(`deployment ${d.url} sha ${d.meta?.githubCommitSha?.slice(0, 7)} state ${d.readyState} target ${d.target}`);
const crons = d.crons ?? [];
console.log(`crons ${crons.length}`);
for (const c of crons) console.log(`  ${c.schedule.padEnd(16)} ${c.path.replace(/\?.*$/, '?…')}`);
console.log(`brief/send present: ${crons.some((c) => c.path.startsWith('/api/brief/send'))}`);
