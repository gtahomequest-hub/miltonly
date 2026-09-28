// MC-049: every Vercel deployment of this project for one Git branch (or commit), newest first.
//   node scratchpad/mc049/branch-deploys.mjs <branch> [sha-prefix]
import fs from "node:fs";
const token = JSON.parse(fs.readFileSync(`${process.env.APPDATA}/com.vercel.cli/Data/auth.json`, "utf8")).token;
const rp = JSON.parse(fs.readFileSync(".vercel/repo.json", "utf8")).projects.find((p) => p.name === "miltonly");
const [branch, sha] = process.argv.slice(2);
const rows = [];
let until = null;
for (let page = 0; page < 10; page++) {
  const q = new URLSearchParams({ projectId: rp.id, teamId: rp.orgId, limit: "100", ...(until ? { until: String(until) } : {}) });
  const j = await (await fetch(`https://api.vercel.com/v6/deployments?${q}`, { headers: { authorization: `Bearer ${token}` } })).json();
  for (const d of j.deployments || []) {
    const ref = d.meta?.githubCommitRef ?? d.meta?.gitCommitRef ?? null;
    const s = d.meta?.githubCommitSha ?? d.meta?.gitCommitSha ?? "";
    if (ref === branch || (sha && s.startsWith(sha))) rows.push({ created: new Date(d.created).toISOString(), url: d.url, state: d.state ?? d.readyState, source: d.source, ref, sha: s.slice(0, 7) });
  }
  if (!j.pagination?.next) break;
  until = j.pagination.next;
}
console.log(`${rows.length} deployment(s) for ${branch}${sha ? ` or commit ${sha}` : ""}:`);
for (const r of rows) console.log(`  ${r.created} ${r.state} ${r.source} ${r.ref} ${r.sha} ${r.url}`);
