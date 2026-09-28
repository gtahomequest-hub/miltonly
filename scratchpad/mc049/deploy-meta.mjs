// MC-049: a deployment's build timing and machine, from the Vercel API (the CLI's own login; the
// token is never printed).   node scratchpad/mc049/deploy-meta.mjs <deployment host or id> [...]
import fs from "node:fs";
const token = JSON.parse(fs.readFileSync(`${process.env.APPDATA}/com.vercel.cli/Data/auth.json`, "utf8")).token;
const rp = JSON.parse(fs.readFileSync(".vercel/repo.json", "utf8")).projects.find((p) => p.name === "miltonly");
const H = { authorization: `Bearer ${token}` };
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
for (const id of process.argv.slice(2)) {
  const d = await (await fetch(`https://api.vercel.com/v13/deployments/${id}?teamId=${rp.orgId}`, { headers: H })).json();
  const machine = d.buildMachineType ?? d.build?.machineType ?? d.config?.buildMachineType ?? d.buildMachine ?? null;
  const keys = Object.keys(d).filter((k) => /machine|build|region|cpu/i.test(k));
  const secs = d.buildingAt && d.ready ? ((d.ready - d.buildingAt) / 1000).toFixed(1) : null;
  console.log(JSON.stringify({ url: d.url, target: d.target ?? "preview", source: d.source, ref: d.meta?.githubCommitRef ?? d.meta?.gitCommitRef ?? null, sha: (d.meta?.githubCommitSha ?? d.meta?.gitCommitSha ?? "").slice(0, 7), readyState: d.readyState, createdAt: iso(d.createdAt), buildingAt: iso(d.buildingAt), ready: iso(d.ready), buildToReadySeconds: secs, machine, machineKeys: keys, buildMachine: d.buildMachine ?? null, buildMachineType: d.buildMachineType ?? null }));
}
