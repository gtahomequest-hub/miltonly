// MH-013: screenshots of the homepage design preview.
// node scratchpad/mh013/shoot.mjs <base> [outDir] [--only=d1,c2] [--full]
// For every option (c, d) and palette (1, 2, 3): the first screen and the hero at 1280x800 and
// 390x844, and the first screen at 360x640. --full adds the whole page at 1280 and 390.
// Waits for load and fonts, not network idle (a preview holds a connection open).
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
const base = (process.argv[2] ?? "http://localhost:3127").replace(/\/$/, "");
const out = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : "scratchpad/mh013/shots";
const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
const full = process.argv.includes("--full");
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage();
await page.setUserAgent("miltonly-mh013-shoot");
const settle = async () => {
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 600));
};
const heroShot = async (file) => {
  const el = await page.$("[data-hero-option]");
  const box = await el.boundingBox();
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: box.width, height: Math.ceil(box.y + box.height) }, captureBeyondViewport: true });
};
const results = [];
for (const option of ["d", "c"]) for (const palette of ["1", "2", "3"]) {
  if (only.length && !only.includes(option + palette)) continue;
  for (const [w, h, tag] of [[1280, 800, "desktop"], [390, 844, "phone"], [360, 640, "small"]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: tag === "desktop" ? 1 : 2 });
    const res = await page.goto(`${base}/design-preview/home?option=${option}&palette=${palette}`, { waitUntil: "load", timeout: 180000 });
    await settle();
    const stem = `${out}/${option}-p${palette}-${tag}-${w}`;
    await page.screenshot({ path: `${stem}-first-screen.png` });
    results.push({ file: `${stem}-first-screen.png`, status: res.status() });
    if (tag !== "small") {
      await heroShot(`${stem}-hero.png`);
      results.push({ file: `${stem}-hero.png` });
      if (full) {
        await page.screenshot({ path: `${stem}-page.png`, fullPage: true });
        results.push({ file: `${stem}-page.png` });
      }
    }
  }
}
await browser.close();
console.log(JSON.stringify(results, null, 1));
