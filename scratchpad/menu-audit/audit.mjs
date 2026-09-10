// Mega-menu audit against production. Drives the LOCAL Chrome (the Puppeteer download
// is blocked in this environment) and records what actually happens, not what the code says
// should happen. Throwaway diagnostic; findings land in findings.json + screenshots.
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'scratchpad/menu-audit';
const URL = 'https://miltonly.com/';
const MENUS = ['Buy', 'Streets', 'Sell'];
const WIDTHS = [{ w: 1440, h: 900, tag: '1440' }, { w: 1024, h: 800, tag: '1024' }, { w: 380, h: 780, tag: '380' }];
mkdirSync(OUT, { recursive: true });

const findings = [];
const rec = (o) => { findings.push(o); console.log(JSON.stringify(o)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// WCAG contrast
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const parse = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x));
  return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
};
const over = (fg, bg) => (fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a)));
const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); };

const isOpen = (pg, i) => pg.evaluate((k) => !document.querySelectorAll('.m-mega')[k].hasAttribute('hidden'), i);

const browser = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] });

for (const vp of WIDTHS) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: vp.w, height: vp.h });
  await pg.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await pg.screenshot({ path: `${OUT}/${vp.tag}-00-closed.png` });

  const chrome = await pg.evaluate(() => ({
    burgerVisible: getComputedStyle(document.querySelector('.sn-burger')).display !== 'none',
    inlineLinksVisible: getComputedStyle(document.querySelector('.m-navlinks')).display !== 'none',
  }));
  rec({ vp: vp.tag, check: 'chrome-visibility', ...chrome });

  const domState = await pg.evaluate(() => [...document.querySelectorAll('.m-mega')].map((p) => ({
    id: p.id, hidden: p.hasAttribute('hidden'), display: getComputedStyle(p).display,
    links: p.querySelectorAll('a[href]').length,
  })));
  rec({ vp: vp.tag, check: 'panels-in-dom', domState });

  if (vp.w >= 821) {
    for (const label of MENUS) {
      const idx = MENUS.indexOf(label);
      await pg.evaluate(() => window.scrollTo(0, 0));
      await wait(250);

      // HOVER
      (await pg.$$('.m-navtrigger'))[idx].hover();
      await wait(450);
      rec({ vp: vp.tag, menu: label, check: 'opens-on-hover', openOnHover: await isOpen(pg, idx) });

      // CLICK, timed
      const t0 = Date.now();
      await (await pg.$$('.m-navtrigger'))[idx].click();
      await wait(120);
      const openOnClick = await isOpen(pg, idx);
      rec({ vp: vp.tag, menu: label, check: 'opens-on-click', openOnClick, openMs: Date.now() - t0 });

      if (!openOnClick) continue;
      await pg.screenshot({ path: `${OUT}/${vp.tag}-${label}-open.png` });

      const geo = await pg.evaluate((k) => {
        const p = document.querySelectorAll('.m-mega')[k];
        const r = p.getBoundingClientRect();
        return {
          left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top),
          width: Math.round(r.width), height: Math.round(r.height),
          viewportW: innerWidth, viewportH: innerHeight,
          overflowsRight: r.right > innerWidth + 1, overflowsLeft: r.left < -1,
          bottomBelowFold: Math.round(r.bottom - innerHeight),
        };
      }, idx);
      rec({ vp: vp.tag, menu: label, check: 'panel-geometry', ...geo });

      const content = await pg.evaluate((k) => {
        const p = document.querySelectorAll('.m-mega')[k];
        return {
          rail: p.querySelectorAll('.m-mega-rail a').length,
          liveBlock: !!p.querySelector('.m-mega-live'),
          cards: p.querySelectorAll('.m-mega-cards li, .m-mega-frames li').length,
          figs: p.querySelectorAll('.m-mega-figs div').length,
          strip: p.querySelectorAll('.m-mega-strip a').length,
          brokenImgs: [...p.querySelectorAll('img')].filter((im) => im.naturalWidth === 0).length,
          totalImgs: p.querySelectorAll('img').length,
          lead: p.querySelector('.m-mega-lead')?.textContent?.trim() ?? null,
        };
      }, idx);
      rec({ vp: vp.tag, menu: label, check: 'panel-content', ...content });

      const type = await pg.evaluate((k) => {
        const p = document.querySelectorAll('.m-mega')[k];
        const out = [];
        const walk = (el) => {
          for (const c of el.children) {
            const cs = getComputedStyle(c);
            const txt = [...c.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
            if (txt) out.push({ cls: String(c.className), text: txt.slice(0, 34), px: parseFloat(cs.fontSize), color: cs.color, bg: cs.backgroundColor });
            walk(c);
          }
        };
        walk(p);
        return { panelBg: getComputedStyle(p).backgroundColor, nodes: out };
      }, idx);

      const panelBgP = parse(type.panelBg) ?? { rgb: [4, 22, 15], a: 1 };
      const below14 = type.nodes.filter((n) => n.px < 14).map((n) => ({ cls: n.cls, px: n.px, text: n.text }));
      const low = [];
      for (const n of type.nodes) {
        const f = parse(n.color);
        if (!f) continue;
        const bgNode = parse(n.bg);
        const base = bgNode && bgNode.a > 0.01 ? over(bgNode, panelBgP.rgb) : panelBgP.rgb;
        const r = ratio(over(f, base), base);
        if (r < 4.5) low.push({ cls: n.cls, px: n.px, text: n.text, ratio: Number(r.toFixed(2)) });
      }
      rec({ vp: vp.tag, menu: label, check: 'typography', panelBg: type.panelBg, nodesMeasured: type.nodes.length, below14px: below14, lowContrast: low });

      // ESC
      await pg.keyboard.press('Escape');
      await wait(180);
      rec({ vp: vp.tag, menu: label, check: 'closes-on-escape', closed: !(await isOpen(pg, idx)) });

      // outside click
      await (await pg.$$('.m-navtrigger'))[idx].click();
      await wait(150);
      await pg.mouse.click(vp.w - 10, Math.round(vp.h * 0.8));
      await wait(220);
      rec({ vp: vp.tag, menu: label, check: 'closes-on-outside-click', closed: !(await isOpen(pg, idx)) });

      // scroll
      await (await pg.$$('.m-navtrigger'))[idx].click();
      await wait(150);
      await pg.evaluate(() => window.scrollBy(0, 320));
      await wait(400);
      const navAfterScroll = await pg.evaluate(() => {
        const n = document.querySelector('.m-navlinks');
        const cs = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        return { cls: String(n.className), opacity: cs.opacity, position: cs.position, left: Math.round(r.left), pointerEvents: cs.pointerEvents };
      });
      rec({ vp: vp.tag, menu: label, check: 'closes-on-scroll', closed: !(await isOpen(pg, idx)), navAfterScroll });
      await pg.screenshot({ path: `${OUT}/${vp.tag}-${label}-after-scroll.png` });
      await pg.evaluate(() => window.scrollTo(0, 0));
      await wait(400);
    }

    // keyboard
    await pg.evaluate(() => window.scrollTo(0, 0));
    await wait(300);
    await pg.evaluate(() => document.querySelector('.m-logo')?.focus());
    const kb = [];
    for (let i = 0; i < 9; i++) {
      await pg.keyboard.press('Tab');
      kb.push(await pg.evaluate(() => {
        const a = document.activeElement;
        return {
          tag: a?.tagName, cls: typeof a?.className === 'string' ? a.className : '',
          text: (a?.textContent || '').trim().slice(0, 26),
          openPanels: [...document.querySelectorAll('.m-mega')].filter((p) => !p.hasAttribute('hidden')).map((p) => p.id),
          focusInsidePanel: !!a?.closest?.('.m-mega'),
        };
      }));
    }
    rec({ vp: vp.tag, check: 'keyboard-tab-order', steps: kb });

    await pg.evaluate(() => document.querySelector('.m-navtrigger').focus());
    await pg.keyboard.press('Enter');
    await wait(400);
    rec({ vp: vp.tag, check: 'enter-on-trigger', ...(await pg.evaluate(() => ({
      openPanels: [...document.querySelectorAll('.m-mega')].filter((p) => !p.hasAttribute('hidden')).length,
      path: location.pathname,
    }))) });
  } else {
    await pg.click('.sn-burger');
    await wait(400);
    await pg.screenshot({ path: `${OUT}/380-panel-open.png` });
    const acc = await pg.evaluate(() => {
      const items = [...document.querySelectorAll('.sn-acc-item')];
      return { count: items.length, summaries: items.map((i) => i.querySelector('summary')?.textContent?.trim()), anyOpen: items.some((i) => i.hasAttribute('open')) };
    });
    rec({ vp: '380', check: 'accordion-present', ...acc });

    if (acc.count) {
      await pg.evaluate(() => document.querySelector('.sn-acc-item summary')?.click());
      await wait(350);
      rec({ vp: '380', check: 'accordion-opens', ...(await pg.evaluate(() => {
        const it = document.querySelector('.sn-acc-item');
        const links = [...it.querySelectorAll('.sn-acc-body a')];
        return { open: it.hasAttribute('open'), links: links.length, taps: links.map((a) => { const r = a.getBoundingClientRect(); return { h: Math.round(r.height), text: a.textContent.trim().slice(0, 18) }; }) };
      })) });
      await pg.screenshot({ path: `${OUT}/380-accordion-open.png` });

      rec({ vp: '380', check: 'mobile-panel-geometry', ...(await pg.evaluate(() => {
        const p = document.querySelector('.sn-panel');
        const r = p.getBoundingClientRect();
        return { height: Math.round(r.height), viewportH: innerHeight, scrollH: p.scrollHeight, overflows: p.scrollHeight > innerHeight };
      })) });

      rec({ vp: '380', check: 'burger-tap-target', ...(await pg.$eval('.sn-burger', (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })) });

      rec({ vp: '380', check: 'mobile-live-content', ...(await pg.evaluate(() => ({
        cards: document.querySelectorAll('.sn-panel .m-mega-cards li').length,
        frames: document.querySelectorAll('.sn-panel .m-mega-frames li').length,
        figs: document.querySelectorAll('.sn-panel .m-mega-figs div').length,
        ctaTap: (() => { const a = document.querySelector('.sn-panel-cta'); if (!a) return null; const r = a.getBoundingClientRect(); return Math.round(r.height); })(),
      }))) });

      await pg.keyboard.press('Escape');
      await wait(300);
      rec({ vp: '380', check: 'mobile-escape-closes', closed: await pg.evaluate(() => !document.querySelector('.sn-panel')) });
    }
  }
  await pg.close();
}

// layout shift on open
{
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1440, height: 900 });
  await pg.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await pg.evaluate(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await wait(600);
  const before = await pg.evaluate(() => window.__cls);
  await (await pg.$$('.m-navtrigger'))[0].click();
  await wait(700);
  const after = await pg.evaluate(() => window.__cls);
  rec({ check: 'layout-shift-on-open', clsBefore: Number(before.toFixed(4)), clsAfter: Number(after.toFixed(4)), delta: Number((after - before).toFixed(4)) });
  await pg.close();
}

// every panel link resolves
{
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1440, height: 900 });
  await pg.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  const hrefs = await pg.$$eval('.m-mega a[href]', (els) => [...new Set(els.map((e) => e.getAttribute('href')))]);
  const results = [];
  for (const h of hrefs) {
    const st = await pg.evaluate(async (u) => { try { const r = await fetch(u, { method: 'GET' }); return r.status; } catch { return 0; } }, h);
    results.push({ href: h, status: st });
  }
  rec({ check: 'panel-link-status', total: hrefs.length, bad: results.filter((r) => r.status !== 200) });
  await pg.close();
}

await browser.close();
writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 1));
console.log('WROTE', findings.length, 'findings');
