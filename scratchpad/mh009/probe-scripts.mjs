// MH-009: does the analytics script get injected? Loads BASE, waits for idle, lists every
// script src mentioning vercel/insights, and every network request to those hosts/paths.
import puppeteer from "puppeteer";
const base = process.env.BASE;
const path = process.env.PATHNAME || "/";
const browser = await puppeteer.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage();
const hits = [];
page.on("request", (r) => {
  const u = r.url();
  if (/_vercel\/insights|va\.vercel-scripts\.com|vercel-analytics|vitals\.vercel/.test(u)) hits.push(`${r.method()} ${u}${r.method()==="POST" ? "  body=" + (r.postData()||"").slice(0,300) : ""}`);
});
await page.goto(base + path, { waitUntil: "networkidle0", timeout: 90000 });
await new Promise((r) => setTimeout(r, 3000));
const tags = await page.$$eval("script[src]", (s) => s.map((x) => x.src).filter((u) => /vercel|insights/.test(u)));
console.log("URL:", base + path);
console.log("script tags matching vercel/insights:", tags.length, tags);
console.log("network requests to analytics:", hits.length);
for (const h of hits) console.log("  ", h);
await browser.close();
