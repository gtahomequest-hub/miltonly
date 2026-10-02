// MH-013: element clips for the report.
// node scratchpad/mh013/clips.mjs <base> <outDir> <mh012PreviewBase>
//   wordmark-live.png        production's nav wordmark (the gold-to-red gradient on forest)
//   wordmark-script-p<n>.png the preview's nav, Kaushan in solid white, per palette
//   wordmark-serif-p<n>.png  the preview's nav, Fraunces with "ly" in light orange, per palette
//   cards-mh012-<w>.png      MH-012's option C doors (its preview, c7fd3ee), 1280 and 390
//   cards-mh013-d-p1-<w>.png MH-013's option D doors, palette 1, 1280 and 390
//   cards-compare-<w>.png    the two side by side (1280) or one above the other (390)
import puppeteer from "puppeteer";
import { mkdirSync, readFileSync } from "node:fs";
const [base, out, old] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage();
const go = async (url, w, h = 900, dpr = 1) => {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  await p.goto(url, { waitUntil: "load", timeout: 180000 });
  await p.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 600));
};
const clipEl = async (sel, file, pad = 12) => {
  const box = await (await p.$(sel)).boundingBox();
  await p.screenshot({ path: file, clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 }, captureBeyondViewport: true });
};
const clipRect = async (rect, file) => p.screenshot({ path: file, clip: rect, captureBeyondViewport: true });

// the wordmarks: the bar's left end
await go("https://miltonly.com/", 1280);
await clipRect({ x: 0, y: 0, width: 420, height: 100 }, `${out}/wordmark-live.png`);
for (const pal of ["1", "2", "3"]) for (const wm of ["script", "serif"]) {
  await go(`${base}/design-preview/home?option=d&palette=${pal}&wordmark=${wm}`, 1280);
  await clipRect({ x: 0, y: 0, width: 420, height: 100 }, `${out}/wordmark-${wm}-p${pal}.png`);
}
// the cards, MH-012 beside MH-013
const doorsBox = async () => p.evaluate(() => {
  const els = [...document.querySelectorAll(".hd-door-bg, .hd-invest")];
  const rs = els.map((e) => e.getBoundingClientRect());
  const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top)) + scrollY;
  const right = Math.max(...rs.map((r) => r.right)), bottom = Math.max(...rs.map((r) => r.bottom)) + scrollY;
  return { x: Math.max(0, x - 16), y: Math.max(0, y - 16), width: right - x + 32, height: bottom - y + 32 };
});
for (const [w, dpr] of [[1280, 1], [390, 2]]) {
  await go(`${old}/design-preview/home?option=c`, w, 900, dpr);
  const r1 = await doorsBox();
  await clipRect({ ...r1, width: Math.min(r1.width, w - r1.x) }, `${out}/cards-mh012-${w}.png`);
  await go(`${base}/design-preview/home?option=d&palette=1`, w, 900, dpr);
  const r2 = await doorsBox();
  await clipRect({ ...r2, width: Math.min(r2.width, w - r2.x) }, `${out}/cards-mh013-d-p1-${w}.png`);
}
// the comparison sheets
const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
for (const [w, dir] of [[1280, "row"], [390, "column"]]) {
  const html = `<html><body style="margin:0;background:#ffffff;font:15px/1.4 system-ui;color:#14213a">
    <div style="display:flex;flex-direction:${dir};gap:24px;padding:24px;align-items:flex-start">
      <figure style="margin:0"><figcaption style="margin-bottom:8px">MH-012 · option C, forest and green</figcaption><img src="${img(`${out}/cards-mh012-${w}.png`)}" style="max-width:${dir === "row" ? 1180 : 800}px;width:100%;border:1px solid #dddddd"></figure>
      <figure style="margin:0"><figcaption style="margin-bottom:8px">MH-013 · option D, palette 1 (Harbour)</figcaption><img src="${img(`${out}/cards-mh013-d-p1-${w}.png`)}" style="max-width:${dir === "row" ? 1180 : 800}px;width:100%;border:1px solid #dddddd"></figure>
    </div></body></html>`;
  await p.setViewport({ width: dir === "row" ? 2440 : 900, height: 900, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: "load" });
  await p.screenshot({ path: `${out}/cards-compare-${w}.png`, fullPage: true });
}
await b.close();
console.log("clips written to", out);
