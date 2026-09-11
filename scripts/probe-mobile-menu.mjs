// Mobile menu at 380px: open the burger on / and /streets and report the panel's rendered
// box against the viewport, plus every ancestor that would trap position:fixed.
// Usage: node scripts/probe-mobile-menu.mjs [BASE]   (BASE defaults to production)
import puppeteer from 'puppeteer';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = (process.argv[2] || 'https://miltonly.com').replace(/\/$/, '');
const b = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] });

for (const [url, tag] of [[`${BASE}/`, 'home'], [`${BASE}/streets`, 'streets']]) {
  const pg = await b.newPage();
  await pg.setViewport({ width: 380, height: 780 });
  await pg.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await pg.click('.sn-burger');
  await new Promise((r) => setTimeout(r, 400));

  const out = await pg.evaluate(() => {
    const panel = document.querySelector('.sn-panel');
    if (!panel) return { error: 'no panel' };
    const r = panel.getBoundingClientRect();
    // Walk ancestors looking for what creates a containing block for position:fixed
    const traps = [];
    let el = panel.parentElement;
    while (el && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      const why = [];
      if (cs.transform !== 'none') why.push(`transform:${cs.transform}`);
      if (cs.filter !== 'none') why.push(`filter:${cs.filter}`);
      if (cs.backdropFilter && cs.backdropFilter !== 'none') why.push(`backdrop-filter:${cs.backdropFilter}`);
      if (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none') why.push(`-webkit-backdrop-filter:${cs.webkitBackdropFilter}`);
      if (cs.perspective !== 'none') why.push(`perspective:${cs.perspective}`);
      if (cs.contain && /paint|layout|strict|content/.test(cs.contain)) why.push(`contain:${cs.contain}`);
      if (cs.willChange && /transform|filter/.test(cs.willChange)) why.push(`will-change:${cs.willChange}`);
      if (why.length) {
        const er = el.getBoundingClientRect();
        traps.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), why, h: Math.round(er.height), w: Math.round(er.width) });
      }
      el = el.parentElement;
    }
    const acc = document.querySelector('.sn-acc');
    const accR = acc ? acc.getBoundingClientRect() : null;
    const firstSummary = document.querySelector('.sn-acc-item summary');
    const sR = firstSummary ? firstSummary.getBoundingClientRect() : null;
    return {
      panel: { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width), scrollH: panel.scrollHeight, position: getComputedStyle(panel).position, overflowY: getComputedStyle(panel).overflowY },
      viewportH: innerHeight,
      accordion: accR ? { top: Math.round(accR.top), height: Math.round(accR.height), visibleInViewport: accR.top < innerHeight && accR.bottom > 0 } : null,
      firstSummary: sR ? { top: Math.round(sR.top), height: Math.round(sR.height), belowPanelBottom: sR.top > r.bottom } : null,
      containingBlockTraps: traps,
    };
  });
  console.log(tag, JSON.stringify(out, null, 1));
  await pg.close();
}
await b.close();
