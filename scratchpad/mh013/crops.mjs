// MH-013: the page in horizontal slices, for reviewing the recoloured sections and footer.
// node scratchpad/mh013/crops.mjs <url> <outPrefix> [width] [sliceHeight]
import puppeteer from "puppeteer";
const [url, prefix, w = "1280", sh = "1400"] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage();
await p.setViewport({ width: Number(w), height: 900, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: "load", timeout: 180000 });
await p.evaluate(() => document.fonts.ready);
const H = await p.evaluate(() => document.documentElement.scrollHeight);
let i = 0;
for (let y = 0; y < H; y += Number(sh)) {
  await p.screenshot({ path: `${prefix}-${i++}.png`, clip: { x: 0, y, width: Number(w), height: Math.min(Number(sh), H - y) }, captureBeyondViewport: true });
}
console.log(`${i} slices of ${H}px`);
await b.close();
