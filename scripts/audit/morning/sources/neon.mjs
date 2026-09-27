// MA-008. Neon: compute and egress per project, month to date, every project the key can see,
// each labelled by what reads it (config.json). The Launch plan's API exposes usage, not
// dollars, and consumption_history is a Scale-plan endpoint, so the dollar line is an estimate
// from the plan's published rates and says so. A project with no label is reported as
// "no known Miltonly reader", never as unused.
import { json, redact, CONFIG } from '../lib.mjs';

const API = 'https://console.neon.tech/api/v2';

export async function gatherNeon(prev) {
  const key = process.env.NEON_API_KEY;
  if (!key) return { ok: false, error: 'NEON_API_KEY unset' };
  const H = { authorization: `Bearer ${key}`, accept: 'application/json' };
  try {
    const orgs = (await json(`${API}/users/me/organizations`, { headers: H })).organizations || [];
    const projects = [];
    for (const o of orgs) {
      const list = (await json(`${API}/projects?org_id=${o.id}&limit=100`, { headers: H })).projects || [];
      for (const p of list) {
        const d = (await json(`${API}/projects/${p.id}`, { headers: H })).project || {};
        const computeHours = (d.compute_time_seconds || 0) / 3600;
        const egressBytes = d.data_transfer_bytes || 0;
        const prevRow = prev?.neon?.projects?.find((x) => x.id === p.id) ?? null;
        projects.push({
          id: p.id, name: p.name, org: o.name, plan: o.plan,
          label: CONFIG.neon.labels[p.id] ?? 'no known Miltonly reader (owner unknown to this report; not unused)',
          computeHours: +computeHours.toFixed(1), activeHours: +((d.active_time_seconds || 0) / 3600).toFixed(1), egressBytes,
          egressShareOfAllowance: +((egressBytes / 1e9) / CONFIG.neon.egressAllowanceGbPerProject).toFixed(3),
          period: { start: (d.consumption_period_start || '').slice(0, 10), end: (d.consumption_period_end || '').slice(0, 10) },
          computeHoursDelta: prevRow ? +(computeHours - prevRow.computeHours).toFixed(1) : null,
          egressDeltaBytes: prevRow ? egressBytes - prevRow.egressBytes : null,
        });
      }
    }
    projects.sort((a, b) => b.computeHours - a.computeHours);
    // Dollars, estimated per organisation on the Launch plan: base, plus compute beyond the included hours.
    const byOrg = {};
    for (const p of projects) { byOrg[p.org] = byOrg[p.org] || { org: p.org, plan: p.plan, computeHours: 0, projects: 0 }; byOrg[p.org].computeHours += p.computeHours; byOrg[p.org].projects++; }
    const orgRows = Object.values(byOrg).map((o) => ({ ...o, computeHours: +o.computeHours.toFixed(1), estimatedUsd: +(CONFIG.neon.launchBaseUsd + Math.max(0, o.computeHours - CONFIG.neon.launchIncludedComputeHours) * CONFIG.neon.computeUsdPerHourBeyond).toFixed(2) }));
    const miltonly = projects.filter((p) => /Miltonly DB/.test(p.label));
    const miltonlyComputeHours = +miltonly.reduce((a, p) => a + p.computeHours, 0).toFixed(1);
    // Miltonly's share of the estimated bill: its compute hours priced at the marginal rate, plus its share of the base.
    const miltonlyUsd = +orgRows.reduce((a, o) => { const share = miltonly.filter((p) => p.org === o.org).reduce((s, p) => s + p.computeHours, 0); return a + (o.computeHours ? o.estimatedUsd * (share / o.computeHours) : 0); }, 0).toFixed(2);
    return { ok: true, projects, orgRows, miltonlyComputeHours, miltonlyUsd, pricingAssumed: `Launch: $${CONFIG.neon.launchBaseUsd} an organisation with ${CONFIG.neon.launchIncludedComputeHours} CU-h included, $${CONFIG.neon.computeUsdPerHourBeyond} a CU-h beyond; egress ${CONFIG.neon.egressAllowanceGbPerProject} GB a project` };
  } catch (e) {
    return { ok: false, error: redact(e.message) };
  }
}
