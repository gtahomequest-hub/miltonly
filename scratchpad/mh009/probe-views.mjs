// MH-009: what reaches Vercel. Masks the automation signals the analytics script checks
// (navigator.webdriver, "Headless" in the UA), visits each path, and prints every POST the
// page makes to the analytics endpoints with its body. The `o` field is the URL recorded.
import puppeteer from "puppeteer";
const base = process.env.BASE;
const paths = process.argv.slice(2);
const browser = await puppeteer.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--disable-blink-features=AutomationControlled"] });
for (const path of paths) {
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36");
  await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, "webdriver", { get: () => false }); });
  const posts = [];
  page.on("response", (r) => { if (/\/view$/.test(r.url())) console.log(`  view endpoint answered ${r.status()}`); });
  page.on("request", (r) => {
    const u = r.url();
    if (r.method() === "POST" && !/_next\/|\/api\//.test(u) && /vercel|insights|\/view|\/event|\/session/.test(u)) posts.push({ url: u, body: r.postData() || "" });
  });
  await page.goto(base + path, { waitUntil: "load", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 6000));
  const tags = await page.$$eval("script[src]", (s) => s.map((x) => x.src).filter((u) => /insights|\/script\.js$/.test(u)));
  console.log(`\nREQUESTED  ${base}${path}`);
  console.log(`  script tag(s): ${JSON.stringify(tags)}`);
  console.log(`  analytics POSTs: ${posts.length}`);
  for (const p of posts) {
    let o = ""; try { o = JSON.parse(p.body).o; } catch {}
    console.log(`    ${p.url}\n      recorded url (o): ${o}\n      body: ${p.body.slice(0, 260)}`);
  }
  await page.close();
}
await browser.close();
