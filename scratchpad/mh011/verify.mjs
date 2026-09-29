// MH-011: checks the street design preview on a running deployment.
// node scratchpad/mh011/verify.mjs <base>
// 1. every palette x view answers 200 with a noindex robots meta
// 2. the visitor HTML carries no sold price, no typical price, no gated fact value
// 3. every element painted #00ff80 is a .sd-btn-cta (lead capture)
// 4. every text element's colour against its painted ground, measured in the browser, >= 4.5:1
// 5. no horizontal scroll at 390 and 1280
// 6. /sitemap.xml and the homepage do not mention /design-preview
import puppeteer from "puppeteer";
const base = process.argv[2];
const SOLD = ["$1,212,000", "$1,085,000", "$1,158,000", "$1,049,000", "$1,265,000", "$1,098,000", "$1,132,500", "$1,189,000", "$1,040,000", "$1,175,000", "$1,210,000", "$1,119,000", "$1,068,000", "$1,099,900"];
const GATED = ["14 sales", "9 of 14", "5 of 14", "12 days", "13 days", "Brookvale"];
const b = await puppeteer.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage();
let fails = 0;
const fail = (m) => { fails++; console.log("FAIL", m); };
for (const palette of ["a", "b", "c"]) for (const view of ["visitor", "registered"]) for (const w of [390, 1280]) {
  await p.setViewport({ width: w, height: 900 });
  const url = `${base}/design-preview/street?palette=${palette}&view=${view}&n=12`;
  const r = await p.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
  const html = await r.text();
  const robots = await p.$eval('meta[name="robots"]', (m) => m.content).catch(() => "");
  if (r.status() !== 200) fail(`${url} status ${r.status()}`);
  if (!/noindex/.test(robots)) fail(`${url} robots "${robots}"`);
  if (view === "visitor") {
    const leak = [...SOLD, ...GATED].filter((s) => html.includes(s));
    if (leak.length) fail(`${url} visitor leaks ${leak.join(", ")}`);
  } else if (!SOLD.every((s) => html.includes(s))) fail(`${url} registered missing a sale`);
  const res = await p.evaluate(() => {
    const lum = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const ground = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.5)) return c.slice(0, 3); } return [255, 255, 255]; };
    const green = [...document.querySelectorAll(".sd *")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(0, 255, 128)").map((e) => ({ cls: e.className, text: e.textContent.trim() }));
    let min = 99, worst = null, n = 0;
    for (const el of document.querySelectorAll(".sd *")) {
      if (el.closest("svg")) continue;
      const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || el.getClientRects().length === 0) continue;
      if (cs.webkitTextFillColor === "rgba(0, 0, 0, 0)" || cs.color === "rgba(0, 0, 0, 0)") continue; // the gradient wordmark
      const fg = rgb(cs.color).slice(0, 3), bg = ground(el);
      const [x, y] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = (x + 0.05) / (y + 0.05);
      n++;
      if (ratio < min) { min = ratio; worst = `${el.tagName}.${el.className} "${el.textContent.trim().slice(0, 40)}" ${cs.color} on rgb(${bg})`; }
    }
    return { green, min, worst, n, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  const badGreen = res.green.filter((g) => !String(g.cls).includes("sd-btn-cta"));
  if (badGreen.length) fail(`${url} #00ff80 off a CTA: ${JSON.stringify(badGreen)}`);
  if (res.min < 4.5) fail(`${url} contrast ${res.min.toFixed(2)} ${res.worst}`);
  if (res.overflow > 0) fail(`${url} horizontal overflow ${res.overflow}px`);
  console.log(`${palette} ${view} ${w}: ${r.status()} robots="${robots}" texts=${res.n} minContrast=${res.min.toFixed(2)} green=${res.green.map((g) => g.text).join(" | ")} overflow=${res.overflow}`);
}
for (const path of ["/sitemap.xml", "/"]) {
  const r = await p.goto(base + path, { waitUntil: "domcontentloaded" });
  const t = await r.text();
  if (t.includes("design-preview")) fail(`${path} mentions design-preview`);
  console.log(`${path}: ${r.status()} mentions design-preview: ${t.includes("design-preview")}`);
}
await b.close();
console.log(fails ? `FAIL · ${fails}` : "PASS");
process.exit(fails ? 1 : 0);
