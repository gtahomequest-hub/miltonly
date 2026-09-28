// ML-013: list the buttons and forms inside a container on a page, as the phone browser sees them (read only).
import fs from 'node:fs';
import puppeteer, { KnownDevices } from 'puppeteer';
const [url, scope] = process.argv.slice(2);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.emulate(KnownDevices['iPhone 13']);
await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }); await new Promise((r) => setTimeout(r, 3000));
const info = await page.evaluate((sel) => { const root = sel ? document.querySelector(sel) : document.body; if (!root) return 'no ' + sel; const out = []; for (const el of root.querySelectorAll('button, a[role=button], input[type=submit], form')) { const cs = getComputedStyle(el); out.push({ tag: el.tagName, type: el.getAttribute('type'), id: el.id || null, cls: (el.className || '').toString().slice(0, 50), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50), disabled: el.disabled || null, visible: el.offsetParent !== null && cs.visibility !== 'hidden', form: el.tagName === 'FORM' ? el.querySelectorAll('input,button').length + ' controls' : undefined }); } return out; }, scope || null);
console.log(JSON.stringify(info, null, 0).replace(/\},\{/g, '},\n{'));
await browser.close();
