// MH-012: checks the homepage hero design preview on a running deployment.
// node scratchpad/mh012/verify.mjs <base>   (waits for load and fonts, not network idle: a preview holds a connection open)
//  1. every option answers 200 with noindex, nofollow; the header carries the registrant strip at 14px or more
//  2. every hero link (a, button) carries data-hero-side and data-hero-intent; a planned row is not a link
//  3. every hero element painted #00ff80 is an .hd-btn-cta, and every one links to a lead-capture page
//     (the live nav and the live sections below the hero are the homepage's own, unchanged)
//  4. every hero text element's colour against its painted ground, measured in the browser, >= 4.5:1
//  5. every visible hero tap target is at least 44 x 44 px; no sideways scroll at 360, 390 and 1280
//  6. the hero's text has no em-dash, no superlative and no sold, leased or market-pace wording
//  7. the first screen at 360x640 and 390x844 shows each side's next step (option A: the buyer's
//     button and the Selling lane; B: the buyer's button and the "I'm selling" chip; C: both buttons)
//  8. /sitemap.xml, /robots.txt and the homepage do not mention design-preview
import puppeteer from "puppeteer";
const base = process.argv[2].replace(/\/$/, "");
const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage();
await p.setUserAgent("miltonly-mh012-verify");
let fails = 0;
const fail = (m) => { fails++; console.log("FAIL", m); };
const LEAD_PAGES = ["/book?ref=%2F", "/sell"];

for (const option of ["a", "b", "c"]) for (const [w, h] of [[360, 640], [390, 844], [1280, 800]]) {
  await p.setViewport({ width: w, height: h });
  const url = `${base}/design-preview/home?option=${option}`;
  const r = await p.goto(url, { waitUntil: "load", timeout: 180000 });
  await p.evaluate(() => document.fonts.ready);
  await new Promise((res) => setTimeout(res, 800));
  const robots = await p.$eval('meta[name="robots"]', (m) => m.content).catch(() => "");
  if (r.status() !== 200) fail(`${url} status ${r.status()}`);
  if (!/noindex/.test(robots) || !/nofollow/.test(robots)) fail(`${url} robots "${robots}"`);
  const res = await p.evaluate((LEAD) => {
    const hero = document.querySelector("[data-hero-option]");
    const lum = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const ground = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.5)) return c.slice(0, 3); } return [255, 255, 255]; };
    const visible = (el) => { const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && el.getClientRects().length > 0 && !(el.getBoundingClientRect().width <= 1 && el.getBoundingClientRect().height <= 1); };
    // the registrant strip, in the live header
    const reg = document.querySelector("nav [data-registrant]");
    const regName = reg?.querySelector("[data-registrant-name]");
    const regBrk = reg?.querySelector("[data-registrant-brokerage]");
    const strip = reg ? { name: regName?.textContent.trim(), brokerage: regBrk?.textContent.trim(), px: Math.min(parseFloat(getComputedStyle(regName).fontSize), parseFloat(getComputedStyle(regBrk).fontSize)), shown: visible(reg) } : null;
    // links and attributes
    const links = [...hero.querySelectorAll("a, button")].map((el) => ({ tag: el.tagName, href: el.getAttribute("href"), side: el.dataset.heroSide, intent: el.dataset.heroIntent, text: el.textContent.trim().slice(0, 50), visible: visible(el), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, cta: el.classList.contains("hd-btn-cta") }));
    const plannedLinks = [...hero.querySelectorAll('[data-hero-status="planned"]')].filter((el) => el.tagName === "A" || el.closest("a")).length;
    const plannedRows = hero.querySelectorAll('[data-hero-status="planned"]').length;
    // #00ff80
    const green = [...hero.querySelectorAll("*")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(0, 255, 128)" && visible(e)).map((e) => ({ cls: String(e.className), text: e.textContent.trim().slice(0, 40), href: e.getAttribute("href") }));
    // contrast
    let min = 99, worst = null, n = 0;
    for (const el of hero.querySelectorAll("*")) {
      if (el.closest("svg")) continue;
      const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      if (!own || !visible(el)) continue;
      const cs = getComputedStyle(el);
      let fg = rgb(cs.color).slice(0, 3);
      const bg = ground(el);
      const ratio = (() => { const [x, y] = [lum(fg), lum(bg)].sort((a, b) => b - a); return (x + 0.05) / (y + 0.05); })();
      n++;
      if (ratio < min) { min = ratio; worst = `${el.tagName}.${el.className} "${el.textContent.trim().slice(0, 40)}" ${cs.color} on rgb(${bg})`; }
    }
    // placeholder text counts too
    const input = hero.querySelector("input");
    const ph = input ? (() => { const fg = rgb(getComputedStyle(input, "::placeholder").color).slice(0, 3); const bg = ground(input); const [x, y] = [lum(fg), lum(bg)].sort((a, b) => b - a); return (x + 0.05) / (y + 0.05); })() : 99;
    // first screen
    const inView = (el) => el && visible(el) && el.getBoundingClientRect().bottom <= innerHeight && el.getBoundingClientRect().top >= 0;
    const opt = hero.dataset.heroOption;
    const buyCta = hero.querySelector('.hd-btn-cta[data-hero-side="buy"]');
    const sellCta = hero.querySelector('.hd-btn-cta[data-hero-side="sell"]');
    const sellWhere = opt === "a" ? (innerWidth >= 760 ? sellCta : hero.querySelector(".hd-tab-sell")) : opt === "b" ? (innerWidth >= 760 ? sellCta : hero.querySelector(".hd-jump-sell")) : sellCta;
    const firstScreen = { buy: inView(buyCta), sell: inView(sellWhere), buyBottom: Math.round(buyCta?.getBoundingClientRect().bottom ?? -1), sellBottom: Math.round(sellWhere?.getBoundingClientRect().bottom ?? -1), searchBottom: Math.round(hero.querySelector(".hd-search-field")?.getBoundingClientRect().bottom ?? -1) };
    return { strip, links, plannedLinks, plannedRows, green, min, worst, n, ph, firstScreen, text: hero.innerText, overflow: document.documentElement.scrollWidth - innerWidth, h1: [...document.querySelectorAll("h1")].map((e) => e.textContent.trim()) };
  }, LEAD_PAGES);

  if (!res.strip || !res.strip.shown || res.strip.px < 14 || !/Aamir Yaqoob, Sales Representative/.test(res.strip.name) || !/RE\/MAX Realty Specialists Inc\., Brokerage/.test(res.strip.brokerage)) fail(`${url} @${w} registrant strip ${JSON.stringify(res.strip)}`);
  if (res.h1.length !== 1) fail(`${url} has ${res.h1.length} H1s`);
  const bare = res.links.filter((l) => !l.side || !l.intent);
  if (bare.length) fail(`${url} hero links without data-hero-side/intent: ${JSON.stringify(bare)}`);
  if (res.plannedLinks) fail(`${url} a planned row is a link`);
  if (res.plannedRows !== 2) fail(`${url} expected 2 planned rows, found ${res.plannedRows}`);
  const offCta = res.green.filter((g) => !g.cls.includes("hd-btn-cta"));
  if (offCta.length) fail(`${url} #00ff80 off a CTA: ${JSON.stringify(offCta)}`);
  const ctaNotLead = res.green.filter((g) => !LEAD_PAGES.includes(g.href));
  if (ctaNotLead.length) fail(`${url} a green button that is not lead capture: ${JSON.stringify(ctaNotLead)}`);
  if (res.min < 4.5) fail(`${url} @${w} contrast ${res.min.toFixed(2)} ${res.worst}`);
  if (res.ph < 4.5) fail(`${url} @${w} placeholder contrast ${res.ph.toFixed(2)}`);
  const small = res.links.filter((l) => l.visible && (l.w < 44 || l.h < 44));
  if (small.length) fail(`${url} @${w} tap targets under 44px: ${JSON.stringify(small.map((s) => `${s.text} ${Math.round(s.w)}x${Math.round(s.h)}`))}`);
  if (res.overflow > 0) fail(`${url} @${w} sideways scroll ${res.overflow}px`);
  if (/\u2014/.test(res.text)) fail(`${url} em-dash in the hero`);
  const sup = res.text.match(/\b(best|#1|number one|leading|top-rated|only agent|unbeatable|guaranteed)\b/i);
  if (sup) fail(`${url} superlative "${sup[0]}"`);
  const vow = res.text.match(/\b(sold|leased|days on market|sold-to-ask|sale price|typical price|median)\b/i);
  if (vow) fail(`${url} sold/leased wording "${vow[0]}"`);
  if (w < 760 && (!res.firstScreen.buy || !res.firstScreen.sell)) fail(`${url} @${w}x${h} first screen ${JSON.stringify(res.firstScreen)}`);
  console.log(`${option} ${w}x${h}: ${r.status()} robots="${robots}" strip=${res.strip?.px}px links=${res.links.length} planned=${res.plannedRows} texts=${res.n} minContrast=${res.min.toFixed(2)} placeholder=${res.ph.toFixed(2)} green=[${res.green.map((g) => g.text).join(" | ")}] smallTargets=${small.length} overflow=${res.overflow} firstScreen=${JSON.stringify(res.firstScreen)}`);
}
// the bare ?b and ?c switches resolve to the same options as ?option=
for (const k of ["b", "c"]) {
  const r = await p.goto(`${base}/design-preview/home?${k}`, { waitUntil: "domcontentloaded" });
  const got = await p.$eval("[data-hero-option]", (e) => e.dataset.heroOption).catch(() => "none");
  if (got !== k) fail(`?${k} rendered option ${got}`);
  console.log(`?${k}: ${r.status()} option=${got}`);
}
for (const path of ["/sitemap.xml", "/robots.txt", "/"]) {
  const r = await p.goto(base + path, { waitUntil: "domcontentloaded" });
  const t = await r.text();
  if (t.includes("design-preview")) fail(`${path} mentions design-preview`);
  console.log(`${path}: ${r.status()} mentions design-preview: ${t.includes("design-preview")}`);
}
await b.close();
console.log(fails ? `FAIL · ${fails}` : "PASS");
process.exit(fails ? 1 : 0);
