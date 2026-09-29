// MH-011: element screenshots for close review. node clip.mjs <url> <width> <selector> <out>
import puppeteer from "puppeteer";
const [url, w, sel, out] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage();
await p.setViewport({ width: Number(w), height: 900, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: "networkidle0" });
await p.evaluate(() => document.fonts.ready);
const els = await p.$$(sel);
let i = 0;
for (const el of els) await el.screenshot({ path: out.replace(".png", `-${i++}.png`) });
await b.close();
