// MH-012: screenshots of the homepage hero design preview.
// node scratchpad/mh012/shoot.mjs <base> [outDir]
// Per option and width: the first screen (what a visitor sees before scrolling) and the hero in full
// (the section, clipped). 1280x800 and 390x844 are the brief's widths; 360x640 is the small-phone
// first screen. Option A also gets its Selling lane at 390.
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
const base = (process.argv[2] ?? "http://localhost:3112").replace(/\/$/, "");
const out = process.argv[3] ?? "scratchpad/mh012/shots";
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage();
await page.setUserAgent("miltonly-mh012-shoot");
const results = [];
const settle = async () => {
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
};
const heroShot = async (file) => {
  const el = await page.$("[data-hero-option]");
  const box = await el.boundingBox();
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: box.width, height: Math.ceil(box.y + box.height) }, captureBeyondViewport: true });
};
for (const option of ["a", "b", "c"]) {
  for (const [w, h, tag] of [[1280, 800, "desktop"], [390, 844, "phone"], [360, 640, "small"]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: tag === "desktop" ? 1 : 2 });
    const res = await page.goto(`${base}/design-preview/home?option=${option}`, { waitUntil: "load", timeout: 180000 });
    await settle();
    const first = `${out}/${option}-${tag}-${w}-first-screen.png`;
    await page.screenshot({ path: first });
    results.push({ option, w, file: first, status: res.status() });
    if (tag !== "small") {
      const full = `${out}/${option}-${tag}-${w}-hero.png`;
      await heroShot(full);
      results.push({ option, w, file: full });
    }
    if (option === "a" && tag === "phone") {
      await page.click(".hd-tab-sell");
      await settle();
      const sell = `${out}/a-phone-390-selling-lane.png`;
      await heroShot(sell);
      results.push({ option, w, file: sell });
    }
  }
}
// the search, typed, at 390 (suggestions open over the hero)
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(`${base}/design-preview/home?option=c`, { waitUntil: "load", timeout: 180000 });
await settle();
await page.click("#hd-q");
await page.type("#hd-q", "farm", { delay: 60 });
await new Promise((r) => setTimeout(r, 1200));
const typed = `${out}/c-phone-390-search-typed.png`;
await page.screenshot({ path: typed });
results.push({ option: "c", w: 390, file: typed });
await browser.close();
console.log(JSON.stringify(results, null, 1));
