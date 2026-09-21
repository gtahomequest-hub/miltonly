// THE PHONE, AT 390: NO TEXT CLIPPED BY THE VIEWPORT (MH-008).
//
// Aamir's phone review of 2026-09-16 found the street page's "Your move on" card cut off on
// the right, the listing page's remarks and details running past the screen, and the GUIDES
// eyebrow at x=0. Every one of those was a box whose min-content was wider than the phone:
// a grid item with min-width auto, a flex row that would not wrap, a padding reset. None of
// them was a finding anywhere, because every gate read the served HTML or a desktop viewport.
//
// So, in a real browser at 390 by 844, on the four page types a phone reaches most (home,
// street, hub, listing) and the two review pages beside them (the rentals index, a guide):
// every visible text node's rendered box must sit inside the viewport. A text node inside a
// horizontally scrollable container is allowed to (a table may scroll, per the design rules);
// so is one inside an aria-hidden wrapper (the honeypots sit at -10000px on purpose) and an
// SVG (map labels). Nothing else may be past the edge, and the document itself must not
// scroll sideways.
//
// The page set is derived, never a literal: the street is the first published slug, the hub
// the first published hub, the listing the first card on /listings.
import { get } from '../lib/http.mjs';

const WIDTH = 390;
const HEIGHT = 844;

async function launchBrowser() {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch (e) {
    throw new Error(`puppeteer is not installed: ${e.message}`);
  }
  const opts = { headless: 'new', args: ['--no-sandbox'] };
  try {
    return await puppeteer.launch(opts);
  } catch (e) {
    const fallback = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    return puppeteer.launch({ ...opts, executablePath: fallback });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every visible text node whose box passes the viewport's edges, with what it says. */
const CLIPPED_JS = () => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, scrollW: document.documentElement.scrollWidth, clipped: [] };
  const scrollsX = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 1) return true;
    }
    return false;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('svg, script, style, [aria-hidden="true"], [hidden]')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((b) => b.width > 0 && b.height > 0);
    if (!rects.length) continue;
    // a fixed or absolute element parked off-screen on purpose (left: -9999px) is not clipped text
    const b = rects.find((r) => r.right > vw + 1 || r.left < -1);
    if (!b) continue;
    if (b.right < 0 || b.left > vw + 2000) continue;
    if (scrollsX(el)) continue;
    out.clipped.push({
      text: n.textContent.trim().replace(/\s+/g, ' ').slice(0, 48),
      left: Math.round(b.left),
      right: Math.round(b.right),
      where: (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : el.tagName.toLowerCase()),
    });
    if (out.clipped.length >= 30) break;
  }
  return out;
};

async function pageSet(base, slugs, hubRecord) {
  const r = await get(base + '/listings');
  const m = r.status === 200 ? r.body.match(/href="(\/listings\/[A-Z][^"?#]+)"/) : null;
  return [
    ['home', '/'],
    ['street', `/streets/${slugs[0]}`],
    ['hub', `/neighbourhoods/${hubRecord.publishedSlugs[0]}`],
    ['listing', m ? m[1] : null],
    ['rentals', '/rentals'],
    ['guide', '/guides/what-milton-neighbourhoods-cost'],
  ];
}

export default {
  id: 'phone-390',
  title: 'At 390 no text is clipped by the viewport on the home, street, hub, listing, rentals and guide pages',
  wholeCorpusOnly: true,
  needsHubRecord: true,

  async finish(_rows, { base, slugs, hubRecord }) {
    const pages = await pageSet(base, slugs, hubRecord);
    const read = [];
    const clipped = [];
    const sideways = [];
    const ladder = [];
    let runs = 0;
    let browserError = null;
    try {
      const browser = await launchBrowser();
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: WIDTH, height: HEIGHT, isMobile: true, hasTouch: true });
        for (const [name, path] of pages) {
          if (!path) { read.push(`${name}: no url`); continue; }
          const res = await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 90000 });
          if (!res || res.status() !== 200) { read.push(`${name} -> ${res ? res.status() : 'no response'}`); continue; }
          await sleep(600);
          // the whole page, so lazily mounted sections below the fold render too
          await page.evaluate(async () => {
            for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 60));
            }
            window.scrollTo(0, 0);
          });
          await sleep(300);
          const r = await page.evaluate(CLIPPED_JS);
          // THE LADDER IS ONE SCREEN AT MOST (MH-005, MA-001 change 8). On the street page the
          // address ladder's track (open, if it is collapsed behind the field) must not be taller
          // than the viewport, and the section around it must reach the next section within two.
          if (name === 'street') {
            const l = await page.evaluate(() => {
              const sec = document.getElementById('addresses');
              const track = sec?.querySelector('.s-addr-lad');
              if (!sec || !track) return { present: false };
              const btn = sec.querySelector('.s-addr-showall');
              if (btn instanceof HTMLElement) btn.click();
              const h = track.getBoundingClientRect().height;
              const cs = getComputedStyle(track);
              return { present: true, trackH: Math.round(h), scrolls: cs.overflowY === 'auto' || cs.overflowY === 'scroll', vh: innerHeight, sectionH: Math.round(sec.getBoundingClientRect().height), hasField: !!sec.querySelector('.s-addr-find input') };
            });
            if (l.present) {
              if (!l.hasField) ladder.push(`${name} ${path}: the ladder has no house-number field`);
              if (l.trackH > l.vh) ladder.push(`${name} ${path}: the ladder track is ${l.trackH}px in an ${l.vh}px viewport`);
              if (!l.scrolls) ladder.push(`${name} ${path}: the ladder track does not scroll inside itself on a phone`);
            }
          }
          read.push(`${name} ok`);
          runs++;
          if (r.scrollW > r.vw + 1) sideways.push(`${name} ${path}: the document scrolls sideways (${r.scrollW} > ${r.vw})`);
          for (const c of r.clipped) clipped.push(`${name} ${path}: "${c.text}" at ${c.left}..${c.right} (${c.where})`);
        }
      } finally {
        await browser.close();
      }
    } catch (e) {
      browserError = e.message;
    }
    const expected = pages.filter(([, p]) => p).length;
    return {
      coverage: [
        ['pages read at 390', read.join(' · ')],
        ['browser runs', `${runs} of ${expected}${browserError ? ` · browser: ${browserError}` : ''}`],
      ],
      assertions: [
        ['pages rendered at 390', runs, expected],
        ['pages that scroll sideways', sideways.length, 0],
        ['text nodes clipped by the viewport', clipped.length, 0],
        ['the street ladder at 390: a house-number field, a track no taller than the viewport that scrolls inside itself', ladder.length, 0],
      ],
      examples: [...sideways, ...clipped, ...ladder],
    };
  },
};
