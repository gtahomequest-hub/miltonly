// ML-013: drive one lead form on production as a phone browser and record what happened.
//   node scratchpad/ml013/drive.mjs <plan.json> [--dry]
// A plan: { name, url, steps: [ {op, selector?, value?, text?, ms?, optional?} ], success: "<regex on body text>",
//           settleMs? }. ops: goto (url), tap (selector or text=…), type (selector, value), select (selector, value),
//           check (selector), wait (ms), waitFor (selector), scroll (selector), eval (js). Every /api/leads/create and
//           /api/auth/* request and response is captured. Nothing here fills the honeypot: the driver only types
//           into the selectors the plan names, which come from the JSX.
import fs from 'node:fs';
import puppeteer, { KnownDevices } from 'puppeteer';
const planPath = process.argv[2];
const DRY = process.argv.includes('--dry');
if (!planPath) { console.error('usage: node drive.mjs <plan.json> [--dry]'); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.emulate(KnownDevices['iPhone 13']);
const out = { name: plan.name, url: plan.url, startedAt: new Date().toISOString(), requests: [], steps: [], success: null, error: null, screenshot: null };
page.on('request', (r) => { if (/\/api\/(leads|auth)\//.test(r.url())) out.requests.push({ at: new Date().toISOString(), method: r.method(), url: r.url().replace(/^https:\/\/[^/]+/, ''), body: (r.postData() || '').slice(0, 800) }); });
page.on('response', async (r) => { if (/\/api\/(leads|auth)\//.test(r.url()) && r.request().method() !== 'OPTIONS') { let body = ''; try { body = (await r.text()).slice(0, 600); } catch {} out.requests.push({ at: new Date().toISOString(), status: r.status(), url: r.url().replace(/^https:\/\/[^/]+/, ''), response: body }); } });
page.on('dialog', async (d) => { out.steps.push({ dialog: d.message() }); await d.dismiss().catch(() => {}); });
const findByText = async (text) => page.evaluateHandle((t) => { const els = [...document.querySelectorAll('button, a, [role=button], label, summary, div, span')]; return els.find((e) => e.offsetParent !== null && e.textContent.trim().replace(/\s+/g, ' ') === t) || els.find((e) => e.offsetParent !== null && e.textContent.trim().replace(/\s+/g, ' ').startsWith(t)) || null; }, text);
try {
  await page.goto(plan.url, { waitUntil: 'networkidle2', timeout: 90000 });
  for (const s of plan.steps) {
    // The last step of every plan is the submit; a dry run rehearses everything before it and stops.
    if (DRY && s === plan.steps[plan.steps.length - 1]) { out.steps.push({ op: s.op, selector: s.selector, text: s.text, skipped: 'dry run: the submit step' }); break; }
    const rec = { op: s.op, selector: s.selector, text: s.text, value: s.value && s.value.length > 60 ? s.value.slice(0, 60) + '…' : s.value };
    try {
      if (s.op === 'goto') { await page.goto(s.value, { waitUntil: 'networkidle2', timeout: 90000 }); }
      else if (s.op === 'wait') { await new Promise((r) => setTimeout(r, s.ms || 1000)); }
      else if (s.op === 'waitFor') { await page.waitForSelector(s.selector, { visible: true, timeout: s.ms || 15000 }); }
      else if (s.op === 'scroll') { await page.$eval(s.selector, (el) => el.scrollIntoView({ block: 'center' })); await new Promise((r) => setTimeout(r, 400)); }
      else if (s.op === 'tap') {
        if (s.text) { const h = await findByText(s.text); if (!h || !(await h.asElement())) throw new Error(`no visible element with text "${s.text}"`); await h.asElement().evaluate((el) => el.scrollIntoView({ block: 'center' })); await h.asElement().click(); }
        else { await page.waitForSelector(s.selector, { visible: true, timeout: s.ms || 15000 }); await page.$eval(s.selector, (el) => el.scrollIntoView({ block: 'center' })); await page.click(s.selector); }
        await new Promise((r) => setTimeout(r, 500));
      }
      else if (s.op === 'type') { await page.waitForSelector(s.selector, { visible: true, timeout: s.ms || 15000 }); await page.$eval(s.selector, (el) => el.scrollIntoView({ block: 'center' })); await page.click(s.selector, { clickCount: 3 }); await page.type(s.selector, s.value, { delay: 15 }); }
      else if (s.op === 'select') { await page.waitForSelector(s.selector, { timeout: s.ms || 15000 }); await page.select(s.selector, s.value); }
      else if (s.op === 'check') { await page.waitForSelector(s.selector, { timeout: s.ms || 15000 }); const checked = await page.$eval(s.selector, (el) => el.checked); if (!checked) { await page.$eval(s.selector, (el) => el.scrollIntoView({ block: 'center' })); await page.$eval(s.selector, (el) => el.click()); } rec.checked = await page.$eval(s.selector, (el) => el.checked); }
      else if (s.op === 'eval') { rec.result = await page.evaluate(s.value); }
      else throw new Error(`unknown op ${s.op}`);
      rec.ok = true;
    } catch (e) { rec.ok = false; rec.error = e.message; out.steps.push(rec); if (s.optional) continue; throw e; }
    out.steps.push(rec);
  }
  if (DRY) { out.success = 'dry run: stopped before submit'; }
  else {
    await new Promise((r) => setTimeout(r, plan.settleMs || 4000));
    const body = await page.evaluate(() => document.body.innerText);
    out.success = new RegExp(plan.success, 'i').test(body);
    out.bodyTail = body.replace(/\s+/g, ' ').slice(0, 200);
    if (!out.success) { const m = body.match(new RegExp(`.{0,120}(${plan.successHint || 'thank|sent|received|check your|we.ll|you.re|success|error|try again|too many'}).{0,120}`, 'i')); out.nearby = m ? m[0].replace(/\s+/g, ' ') : null; }
  }
} catch (e) { out.error = e.message; }
const shot = `scratchpad/ml013/shots/${plan.name}${DRY ? '-dry' : ''}.png`;
fs.mkdirSync('scratchpad/ml013/shots', { recursive: true });
try { await page.screenshot({ path: shot, fullPage: false }); out.screenshot = shot; } catch {}
await browser.close();
fs.mkdirSync('scratchpad/ml013/runs', { recursive: true });
fs.writeFileSync(`scratchpad/ml013/runs/${plan.name}${DRY ? '-dry' : ''}.json`, JSON.stringify(out, null, 1));
console.log(`${plan.name}: ${out.error ? 'ERROR ' + out.error : DRY ? 'dry ok' : out.success ? 'SUCCESS' : 'NO SUCCESS SIGNAL'}`);
for (const s of out.steps) if (!s.ok) console.log(`  step failed: ${s.op} ${s.selector || s.text || ''}: ${s.error}`);
for (const r of out.requests) console.log(`  ${r.method ? r.method + ' ' + r.url + ' ' + r.body.slice(0, 300) : r.status + ' ' + r.url + ' ' + r.response.slice(0, 200)}`);
if (out.nearby) console.log(`  nearby: ${out.nearby}`);
