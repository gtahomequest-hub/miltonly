// MC-016 recon: bytes the battery's own record loaders pull from Neon, measured at the socket
// by wrapping fetch (the Neon HTTP driver is fetch). Also the per-check page loads are HTML
// from Vercel, not Neon; what matters is what a page RENDER pulls, measured separately.
const totals = {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  const res = await realFetch(input, init);
  if (/neon\.tech/.test(url)) {
    const host = new URL(url).host.split(".")[0];
    const clone = res.clone();
    const buf = await clone.arrayBuffer();
    const t = totals[host] ?? (totals[host] = { bytes: 0, calls: 0 });
    t.bytes += buf.byteLength; t.calls++;
  }
  return res;
};
const { loadRecord, loadHubRecord, loadHomeRecord } = await import("../../scripts/verify/lib/db.mjs");
const snap = () => JSON.parse(JSON.stringify(totals));
const diff = (a, b) => Object.fromEntries(Object.keys(b).map((k) => [k, { MB: +(((b[k].bytes) - (a[k]?.bytes ?? 0)) / 1e6).toFixed(2), calls: b[k].calls - (a[k]?.calls ?? 0) }]));
let s = snap(); await loadRecord(); let e = snap(); console.log("loadRecord (denials/claims/tiles/consistency/composition/coordinates):", JSON.stringify(diff(s, e)));
s = snap(); await loadHubRecord(); e = snap(); console.log("loadHubRecord (hub-meta/hub-page):", JSON.stringify(diff(s, e)));
s = snap(); await loadHomeRecord(); e = snap(); console.log("loadHomeRecord (homepage):", JSON.stringify(diff(s, e)));
console.log("battery direct total:", JSON.stringify(totals));
