// MH-011: screenshots of the street design preview, every palette x view x width.
// Usage: node scratchpad/mh011/shoot.mjs <base> [outDir] [--n=12]
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3111";
const out = process.argv[3] ?? "scratchpad/mh011/shots";
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage();
const results = [];
for (const palette of ["a", "b", "c"]) {
  for (const view of ["visitor", "registered"]) {
    for (const [w, h, tag] of [[1280, 900, "desktop"], [390, 844, "phone"]]) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: tag === "phone" ? 2 : 1 });
      const url = `${base}/design-preview/street?palette=${palette}&view=${view}&n=12`;
      const res = await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const file = `${out}/${palette}-${view}-${tag}-${w}.png`;
      await page.screenshot({ path: file, fullPage: true });
      results.push({ palette, view, tag, status: res.status(), overflow, file });
    }
  }
}
await browser.close();
console.log(JSON.stringify(results, null, 1));
