#!/usr/bin/env node
// MA-005. Where the hub's four intent squares and two closing CTAs land, seen from a phone.
//
//   BASE=https://miltonly.com node scripts/audit/hub-intents.mjs [--only=slug]
//
// For each audit hub, opens every intent destination at 390 px and records the title, H1, the
// first screen's text, whether the hub's name appears above the fold, the count the page states
// against the count the hub promised, the forms and their fields, and the first CTA. Read-only:
// nothing is typed, nothing is submitted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) { console.error('BASE is required'); process.exit(2); }
const OUT = path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-005');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const HUBS = JSON.parse(fs.readFileSync(path.join(HERE, 'hubs.json'), 'utf8')).filter((s) => !only.length || only.includes(s.slug));
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] });
const out = [];
for (const hub of HUBS) {
  const rec = JSON.parse(fs.readFileSync(path.join(OUT, `${hub.slug}.mobile.json`), 'utf8'));
  const targets = [
    ...rec.intents.map((i) => ({ kind: `intent:${i.label}`, promise: i.sub, href: i.href })),
    ...rec.ctaCards.map((c) => ({ kind: `card:${c.heading}`, promise: c.body, href: c.href })),
    { kind: 'nav CTA', promise: rec.ctas[0]?.text, href: rec.ctas[0]?.href },
  ];
  for (const t of targets) {
    const page = await browser.newPage();
    await page.setUserAgent(MOBILE_UA);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const url = t.href.startsWith('http') ? t.href : `${BASE}${t.href}`;
    let r;
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
      await new Promise((res) => setTimeout(res, 1500));
      r = await page.evaluate((hubName) => {
        const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
        const q = (s) => Array.from(document.querySelectorAll(s));
        const visible = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
        const fold = [];
        for (const el of q('body *')) { if (!visible(el)) continue; const b = el.getBoundingClientRect(); if (b.top + scrollY >= 844) continue; const own = Array.from(el.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent.trim()).filter(Boolean).join(' '); if (own) fold.push(own); }
        const foldText = fold.join(' | ');
        const bodyText = txt(document.body);
        const counts = [...bodyText.matchAll(/(\d[\d,]*)\s+(homes?|listings?|results?|sales?|leases?|properties|for sale|for rent)/gi)].slice(0, 8).map((m) => m[0]);
        const forms = q('form').filter(visible).map((f) => ({ top: Math.round(f.getBoundingClientRect().top + scrollY), inputs: q('input:not([type="hidden"]),select,textarea').filter((i) => f.contains(i) && visible(i)).map((i) => i.name || i.type), button: txt(f.querySelector('button[type="submit"],button:not([type])')) }));
        const cards = q('[class*="card"], article, [class*="listing"], [class*="tile"]').filter(visible).length;
        const h1 = q('h1').map(txt);
        return { title: document.title, h1, robots: document.querySelector('meta[name="robots"]')?.content ?? null, canonical: document.querySelector('link[rel="canonical"]')?.href ?? null, hubInFold: foldText.toLowerCase().includes(hubName.toLowerCase()), hubMentions: (bodyText.match(new RegExp(hubName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length, foldText: foldText.slice(0, 700), counts, forms, cards, screens: +(document.documentElement.scrollHeight / 844).toFixed(1), emDashes: (bodyText.match(/—/g) || []).length, median: (bodyText.match(/median/gi) || []).length };
      }, rec.hero.h1);
      r.status = resp?.status();
      r.finalUrl = page.url();
    } catch (e) { r = { error: e.message }; }
    await page.screenshot({ path: path.join(OUT, 'shots', `${hub.slug}.dest.${t.kind.replace(/[^a-z]+/gi, '-').toLowerCase()}.png`), fullPage: false }).catch(() => {});
    await page.close();
    out.push({ hub: hub.slug, ...t, ...r });
    console.log(`${hub.slug} ${t.kind} -> ${t.href} ${r.status} | ${r.title} | h1=${JSON.stringify(r.h1)} | hubInFold=${r.hubInFold} mentions=${r.hubMentions} | counts=${JSON.stringify(r.counts)} | forms=${JSON.stringify(r.forms)} | robots=${r.robots}`);
  }
}
fs.writeFileSync(path.join(OUT, 'intents.json'), JSON.stringify(out, null, 1));
await browser.close();
