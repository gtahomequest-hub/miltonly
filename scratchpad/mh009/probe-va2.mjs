import puppeteer from "puppeteer";
const base = process.env.BASE;
const browser = await puppeteer.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  const orig = document.head.appendChild.bind(document.head);
  window.__appended = [];
  document.head.appendChild = function (n) { if (n && n.src) window.__appended.push(n.src); return orig(n); };
  const origRm = Node.prototype.removeChild;
  window.__removed = [];
  Node.prototype.removeChild = function (n) { if (n && n.src) window.__removed.push(n.src); return origRm.call(this, n); };
});
await page.goto(base + "/", { waitUntil: "networkidle0", timeout: 90000 });
await new Promise((r) => setTimeout(r, 4000));
console.log(await page.evaluate(() => ({ appended: window.__appended, removed: window.__removed, vaq: window.vaq?.map(x => x[0]) })));
await browser.close();
