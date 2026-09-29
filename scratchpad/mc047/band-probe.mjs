import puppeteer from 'puppeteer';
const opts = { headless: 'new', args: ['--no-sandbox'] };
const b = await puppeteer.launch(opts).catch(() => puppeteer.launch({ ...opts, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }));
for (const base of ['http://localhost:3100', 'https://miltonly.com']) {
  const p = await b.newPage(); await p.setViewport({ width: 1024, height: 768 });
  await p.goto(base + '/', { waitUntil: 'networkidle2' });
  const t = await p.$('#m-mega-buy'); 
  await p.click('button[aria-controls="m-mega-buy"]'); await new Promise(r => setTimeout(r, 500));
  const r = await p.evaluate(() => { const band = document.querySelector('.m-band'); const bb = band.getBoundingClientRect(); const nav = document.querySelector('nav').getBoundingClientRect(); return { navBottom: nav.bottom, bandTop: bb.top, bandBottom: bb.bottom, maxH: getComputedStyle(band).maxHeight, scroll: band.scrollHeight, client: band.clientHeight }; });
  console.log(base, JSON.stringify(r));
}
await b.close();
