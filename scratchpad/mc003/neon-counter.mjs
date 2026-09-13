import { readFileSync } from "node:fs";
const cred = JSON.parse(readFileSync(`${process.env.HOME || process.env.USERPROFILE}/.config/neon/credentials.json`, "utf8"));
const H = { authorization: `Bearer ${cred.access_token}`, accept: "application/json" };
const api = async (p) => { const r = await fetch(`https://console.neon.tech/api/v2${p}`, { headers: H }); return r.json(); };
const out = {};
for (const [label, id] of [["DB1", "fancy-bread-13256110"], ["DB2", "winter-leaf-52425555"], ["DB3?", "lingering-sea-07597558"]]) {
  const brs = await api(`/projects/${id}/branches`);
  const b = (brs.branches ?? []).find((x) => x.default) ?? brs.branches[0];
  out[label] = { gb: +((b.data_transfer_bytes ?? 0) / 1e9).toFixed(3), activeH: +((b.active_time_seconds ?? 0) / 3600).toFixed(2), at: new Date().toISOString().slice(11, 19) };
}
console.log(JSON.stringify(out));
