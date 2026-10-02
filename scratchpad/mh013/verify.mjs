// MH-013: checks the homepage design preview on a running deployment, every option, palette and width.
// node scratchpad/mh013/verify.mjs <base>   (waits for load and fonts, not network idle)
//  1. 200, noindex and nofollow; theme-color is the palette's navy; the tab icon link is the navy SVG
//  2. the header carries the MC-047 registrant strip, both lines at 14px
//  3. NO GREEN anywhere on the page: every element and its ::before and ::after, every computed
//     colour (text, ground, borders, outline, decoration, fill, stroke) and every colour inside a
//     gradient or a shadow; a colour is green when its hue is 70 to 175 degrees and saturation > 0.15
//  4. the lead colour is painted only on lead buttons (the hero's two, a form's submit, the register
//     button), never as text or a border elsewhere; the accent orange never fills a link or button
//  5. every text element on the whole page, measured against its painted ground, is 4.5:1 or better
//  6. hero text is 16px or larger, labels (numbers, tags, the search hint, list groups) 14px or larger
//  7. every visible hero link and button is at least 44 x 44; nothing scrolls sideways
//  8. at 360x640 and 390x844 the Selling and Buying buttons are both on the first screen, Selling first
//  9. a planned row or door is not a link and holds none; option D has its Investing door
// 10. hero links carry data-hero-side and data-hero-intent; no em-dash, superlative or VOW figure
// 11. the rentals figure equals /rentals' active count; the listings row says what /listings is
// 12. /sitemap.xml, /robots.txt and / do not mention design-preview
import puppeteer from "puppeteer";
import { readFileSync } from "node:fs";
const base = process.argv[2].replace(/\/$/, "");
const tokens = readFileSync("src/components/home-design/tokens.ts", "utf8");
const pal = {};
for (const k of ["1", "2", "3"]) {
  const block = tokens.split(`"${k}": {`)[1].split("},")[0];
  pal[k] = Object.fromEntries([...block.matchAll(/(\w+): "(#[0-9a-f]{6})"/g)].map((m) => [m[1], m[2]]));
}
const rgbOf = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;

const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage();
await p.setUserAgent("miltonly-mh013-verify");
let fails = 0;
const fail = (m) => { fails++; console.log("FAIL", m); };

// 11. the counts each row states, against the pages they point to
const plain = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const rentalsHtml = plain(await (await fetch(`${base}/rentals`)).text());
const rentalsActive = Number((rentalsHtml.match(/(\d[\d,]*) active rentals/) || [])[1]?.replace(/,/g, "") ?? NaN);
const listingsHtml = await (await fetch(`${base}/listings`)).text();
const listingsH1 = (listingsHtml.match(/<h1[^>]*>([^<]*)/) || [])[1] ?? "";
console.log(`/rentals active count ${rentalsActive}; /listings H1 "${listingsH1}"`);

for (const option of ["d", "c"]) for (const palette of ["1", "2", "3"]) for (const [w, h] of [[360, 640], [390, 844], [1280, 800]]) {
  const P = pal[palette];
  await p.setViewport({ width: w, height: h });
  const url = `${base}/design-preview/home?option=${option}&palette=${palette}`;
  const r = await p.goto(url, { waitUntil: "load", timeout: 180000 });
  await p.evaluate(() => document.fonts.ready);
  await new Promise((res) => setTimeout(res, 800));
  const tag = `${option}${palette} @${w}x${h}`;
  if (r.status() !== 200) fail(`${tag} status ${r.status()}`);
  const head = await p.evaluate(() => ({
    robots: document.querySelector('meta[name="robots"]')?.content ?? "",
    theme: document.querySelector('meta[name="theme-color"]')?.content ?? "",
    icons: [...document.querySelectorAll('link[rel="icon"]')].map((l) => l.getAttribute("href")),
  }));
  if (!/noindex/.test(head.robots) || !/nofollow/.test(head.robots)) fail(`${tag} robots "${head.robots}"`);
  if (head.theme.toLowerCase() !== P.navy) fail(`${tag} theme-color ${head.theme}, expected ${P.navy}`);
  if (!head.icons.includes("/design-preview/home/icon.svg")) fail(`${tag} no navy tab icon: ${head.icons.join(" ")}`);

  const res = await p.evaluate((P, LEAD, ACCENT) => {
    const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b); let hh = 0, s = 0; const l = (M + m) / 2; if (M !== m) { const d = M - m; s = l > 0.5 ? d / (2 - M - m) : d / (M + m); hh = M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; } return [hh, s]; };
    const colours = (s) => [...String(s).matchAll(/rgba?\(([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:[,/]\s*([\d.]+))?\)/g)].map((m) => [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]);
    const isGreen = ([r, g, bb, a]) => { if (a === 0) return false; const [hh, s] = hsl(r, g, bb); return hh >= 70 && hh <= 175 && s > 0.15; };
    const PROPS = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor", "textDecorationColor", "fill", "stroke", "backgroundImage", "boxShadow", "caretColor", "accentColor", "webkitTextFillColor"];
    const greens = [];
    const all = [...document.querySelectorAll("body *")];
    for (const el of all) {
      for (const pseudo of [null, "::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === "none" || cs.content === "normal")) continue;
        for (const prop of PROPS) {
          const v = cs[prop];
          if (!v || v === "none") continue;
          if (colours(v).some(isGreen)) { greens.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}${pseudo ?? ""} ${prop}: ${v.slice(0, 80)}`); break; }
        }
      }
    }
    // lead colour: on lead buttons only, and only as their fill
    const leadButton = (el) => el.matches(".hd-btn-lead, .m-vow a[role='button'], .m-vow button") || (el.tagName === "BUTTON" && el.type === "submit" && !el.closest("[role='search']") && !!el.closest("form"));
    const leadMisuse = [];
    const accentFill = [];
    for (const el of all) {
      const cs = getComputedStyle(el);
      const bgLead = cs.backgroundColor === LEAD;
      if (bgLead && !leadButton(el)) leadMisuse.push(`fill on ${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} "${el.textContent.trim().slice(0, 30)}"`);
      if (cs.color === LEAD) leadMisuse.push(`text on ${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
      for (const bc of ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"]) if (cs[bc] === LEAD && parseFloat(cs[bc.replace("Color", "Width")]) > 0 && !leadButton(el)) { leadMisuse.push(`border on ${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`); break; }
      if (cs.backgroundColor === ACCENT && el.matches("a, button")) accentFill.push(el.textContent.trim().slice(0, 30));
    }
    const leadButtons = all.filter((el) => getComputedStyle(el).backgroundColor === LEAD).map((el) => el.textContent.trim().slice(0, 30));
    // contrast, the whole page
    const lum = ([r, g, bb]) => { const c = [r, g, bb].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    // The painted ground under a text element: a door's underlay (an aria-hidden sibling in the same
    // grid) when the text sits on one, else the first opaque ancestor colour, or every stop of the first
    // ancestor gradient (the ratio is then taken against the worst stop).
    const underlays = [...document.querySelectorAll(".hd-door-bg")];
    const grounds = (el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (const u of underlays) {
        const ur = u.getBoundingClientRect();
        if (u.parentElement.contains(el) && cx >= ur.left && cx <= ur.right && cy >= ur.top && cy <= ur.bottom) {
          for (let e = el; e && e !== u.parentElement; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.5)) return [c.slice(0, 3)]; }
          return [rgb(getComputedStyle(u).backgroundColor).slice(0, 3)];
        }
      }
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const c = rgb(cs.backgroundColor);
        if (c.length === 3 || (c.length === 4 && c[3] > 0.5)) return [c.slice(0, 3)];
        if (/gradient/.test(cs.backgroundImage)) {
          const stops = [...cs.backgroundImage.matchAll(/rgba?\(([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:[,/]\s*([\d.]+))?\)/g)].filter((m) => m[4] === undefined || +m[4] > 0.5).map((m) => [+m[1], +m[2], +m[3]]);
          if (stops.length) return stops;
        }
      }
      return [[255, 255, 255]];
    };
    const ground = (el) => grounds(el)[0];
    const visible = (el) => { const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") return false; const rr = el.getBoundingClientRect(); return el.getClientRects().length > 0 && rr.width > 1 && rr.height > 1; };
    const overImage = (el) => { for (let e = el; e; e = e.parentElement) { if (e.querySelector(":scope > img, :scope > video, :scope > picture")) return true; if (getComputedStyle(e).backgroundImage.includes("url(")) return true; if (getComputedStyle(e).backgroundColor !== "rgba(0, 0, 0, 0)" && rgb(getComputedStyle(e).backgroundColor)[3] !== 0) return false; } return false; };
    const low = [];
    let min = 99, n = 0;
    for (const el of all) {
      if (el.closest("svg, script, style, noscript")) continue;
      const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      if (!own || !visible(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.color === "rgba(0, 0, 0, 0)") continue;
      const fg = rgb(cs.color);
      const a = fg.length === 4 ? fg[3] : 1;
      let ratio = 99;
      for (const bg of grounds(el)) {
        const mix = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
        const [x, y] = [lum(mix), lum(bg)].sort((q, z) => z - q);
        ratio = Math.min(ratio, (x + 0.05) / (y + 0.05));
      }
      n++;
      if (ratio < min) min = ratio;
      if (ratio < 4.5) low.push({ text: el.textContent.trim().slice(0, 40), cls: `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`, ratio: +ratio.toFixed(2), overImage: overImage(el), inHero: !!el.closest("[data-hero-option]"), inNav: !!el.closest("nav") });
    }
    // the hero
    const hero = document.querySelector("[data-hero-option]");
    const LABEL = ".hd-door-num, .hd-tag, .hd-search-hint, .hd-drop-group";
    const small = [];
    for (const el of hero.querySelectorAll("*")) {
      const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      if (!own || !visible(el)) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      const floor = el.closest(LABEL) ? 14 : 16;
      if (px < floor) small.push(`${el.className} "${el.textContent.trim().slice(0, 30)}" ${px}px`);
    }
    const links = [...hero.querySelectorAll("a, button")].map((el) => ({ text: el.textContent.trim().slice(0, 40), side: el.dataset.heroSide, intent: el.dataset.heroIntent, visible: visible(el), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }));
    const planned = [...hero.querySelectorAll('[data-hero-status="planned"]')];
    const plannedLinks = planned.filter((el) => el.matches("a") || el.closest("a") || el.querySelector("a")).length;
    const sell = hero.querySelector('.hd-btn-lead[data-hero-side="sell"]');
    const buy = hero.querySelector('.hd-btn-lead[data-hero-side="buy"]');
    const box = (el) => el.getBoundingClientRect();
    const inView = (el) => el && visible(el) && box(el).top >= 0 && box(el).bottom <= innerHeight;
    // side by side (no horizontal overlap): Selling is the left one; stacked: Selling is the upper one
    const sideBySide = sell && buy && (box(sell).right <= box(buy).left || box(buy).right <= box(sell).left);
    const sellFirst = sell && buy && (sideBySide ? box(sell).left < box(buy).left : box(sell).top < box(buy).top);
    // placeholders, against the field they sit in
    const phLow = [];
    for (const f of document.querySelectorAll("input[placeholder], textarea[placeholder]")) {
      if (!visible(f)) continue;
      const pc = rgb(getComputedStyle(f, "::placeholder").color);
      const pa = pc.length === 4 ? pc[3] : 1;
      const bg = ground(f);
      const mix = pc.slice(0, 3).map((v, i) => v * pa + bg[i] * (1 - pa));
      const [x, y] = [lum(mix), lum(bg)].sort((q, z) => z - q);
      const pr = (x + 0.05) / (y + 0.05);
      if (pr < 4.5) phLow.push(`${f.getAttribute("placeholder").slice(0, 30)} ${pr.toFixed(2)}`);
    }
    const reg = document.querySelector("nav [data-registrant]");
    const regPx = reg ? Math.min(...[...reg.querySelectorAll("[data-registrant-name], [data-registrant-brokerage]")].map((e) => parseFloat(getComputedStyle(e).fontSize))) : 0;
    const rentText = hero.querySelector('[data-hero-intent="rentals"]')?.textContent ?? "";
    const listingsRow = hero.querySelector('[data-hero-intent="new-listings"]');
    return {
      greens, leadMisuse, accentFill, leadButtons, low, min, n, small, links, plannedCount: planned.length, plannedLinks, phLow,
      invest: !!hero.querySelector('.hd-invest[data-hero-status="planned"]'),
      first: { sell: inView(sell), buy: inView(buy), sellBottom: Math.round(box(sell).bottom), buyBottom: Math.round(box(buy).bottom), sellFirst },
      regText: reg?.textContent ?? "", regPx, text: hero.innerText, overflow: document.documentElement.scrollWidth - innerWidth,
      rent: Number((rentText.match(/(\d[\d,]*)/) || [])[1]?.replace(/,/g, "") ?? NaN),
      listings: { href: listingsRow?.getAttribute("href"), label: listingsRow?.querySelector(".hd-row-label")?.textContent ?? "" },
      h1: [...document.querySelectorAll("h1")].map((e) => e.textContent.trim()),
    };
  }, P, rgbOf(P.lead), rgbOf(P.accent));

  if (res.greens.length) fail(`${tag} green: ${res.greens.length} (${res.greens.slice(0, 6).join(" | ")})`);
  if (res.leadMisuse.length) fail(`${tag} lead colour off a lead button: ${res.leadMisuse.slice(0, 6).join(" | ")}`);
  if (res.accentFill.length) fail(`${tag} accent fills a control: ${res.accentFill.join(" | ")}`);
  const lowReal = res.low.filter((l) => !l.overImage);
  if (lowReal.length) fail(`${tag} text under 4.5:1: ${JSON.stringify(lowReal.slice(0, 6))}`);
  if (res.small.length) fail(`${tag} hero text too small: ${res.small.slice(0, 6).join(" | ")}`);
  if (res.phLow.length) fail(`${tag} placeholders under 4.5:1: ${res.phLow.join(" | ")}`);
  const bare = res.links.filter((l) => !l.side || !l.intent);
  if (bare.length) fail(`${tag} hero links without data-hero-*: ${JSON.stringify(bare)}`);
  const tiny = res.links.filter((l) => l.visible && (l.w < 44 || l.h < 44));
  if (tiny.length) fail(`${tag} tap targets under 44px: ${tiny.map((t) => `${t.text} ${Math.round(t.w)}x${Math.round(t.h)}`).join(" | ")}`);
  if (res.overflow > 0) fail(`${tag} sideways scroll ${res.overflow}px`);
  if (w < 760 && (!res.first.sell || !res.first.buy)) fail(`${tag} first screen ${JSON.stringify(res.first)}`);
  if (!res.first.sellFirst) fail(`${tag} Selling is not first ${JSON.stringify(res.first)}`);
  if (res.plannedLinks) fail(`${tag} a planned row is a link`);
  if (res.plannedCount !== 2) fail(`${tag} expected 2 planned items, found ${res.plannedCount}`);
  if (option === "d" && !res.invest) fail(`${tag} no Investing door`);
  if (res.h1.length !== 1) fail(`${tag} ${res.h1.length} H1s`);
  if (!/Aamir Yaqoob, Sales Representative/.test(res.regText) || !/RE\/MAX Realty Specialists Inc\., Brokerage/.test(res.regText) || res.regPx < 14) fail(`${tag} registrant strip ${res.regPx}px`);
  if (/\u2014/.test(res.text)) fail(`${tag} em-dash in the hero`);
  const sup = res.text.match(/\b(best|#1|number one|leading|top-rated|unbeatable|guaranteed)\b/i);
  if (sup) fail(`${tag} superlative "${sup[0]}"`);
  const vow = res.text.match(/\d[\d,.]*\s*(sales|sold|leases|leased|days on market)|sold-to-ask|\$\d/i);
  if (vow) fail(`${tag} a VOW-shaped figure "${vow[0]}"`);
  if (res.rent !== rentalsActive) fail(`${tag} rentals ${res.rent} vs /rentals ${rentalsActive}`);
  if (res.listings.href !== "/listings" || !/^Every home for sale, newest first$/.test(res.listings.label)) fail(`${tag} listings row ${JSON.stringify(res.listings)}`);
  console.log(`${tag}: ${r.status()} theme=${head.theme} green=${res.greens.length} leadButtons=[${res.leadButtons.join(" | ")}] texts=${res.n} minContrast=${res.min.toFixed(2)} lowOverImage=${res.low.filter((l) => l.overImage).length} smallHero=${res.small.length} tiny=${tiny.length} overflow=${res.overflow} first=${JSON.stringify(res.first)} rent=${res.rent}`);
}
for (const path of ["/sitemap.xml", "/robots.txt", "/"]) {
  const t = await (await fetch(base + path)).text();
  if (t.includes("design-preview")) fail(`${path} mentions design-preview`);
  console.log(`${path}: mentions design-preview: ${t.includes("design-preview")}`);
}
for (const q of ["c", "d&p2", "d&p3&script"]) {
  await p.goto(`${base}/design-preview/home?${q}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const got = await p.evaluate(() => ({ o: document.querySelector("[data-hero-option]")?.dataset.heroOption, p: document.querySelector(".bp")?.dataset.palette, w: document.querySelector(".bp")?.className.match(/bp-wm-(\w+)/)?.[1] }));
  console.log(`?${q}: ${JSON.stringify(got)}`);
}
await b.close();
console.log(fails ? `FAIL · ${fails}` : "PASS");
process.exit(fails ? 1 : 0);
