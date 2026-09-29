// MC-047, A6: clearing a held reviewer on /admin/vow sends its sign-in link. Run against a
// deployment that carries the fix.
// usage: node scratchpad/mc047/a6-proof.mjs <base> <step>
//   step "setup":  insert a held reviewer row (the address below), print its id
//   step "clear":  sign in to the admin desk in a real browser, click "Clear hold" on that row,
//                  print the desk's message and the row's state after
//   step "follow": <link> as the 3rd argument: open the emailed link in a browser and print who
//                  /api/auth/me says is signed in
//   step "cleanup": delete the row
// Reads DATABASE_URL and ADMIN_PASSWORD from .env.local; prints neither.
import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';
import puppeteer from 'puppeteer';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*?)\r?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const [base, step, arg] = process.argv.slice(2);
const EMAIL = 'gtahomequest+mc047reviewer@gmail.com';
const sql = neon(process.env.DATABASE_URL);
const row = async () => (await sql`SELECT id, "reviewFlag" flag, verified, "verifyCode" IS NULL no_code, "verifyTokenHash" IS NOT NULL has_link, to_char("verifyExpiry" AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') expiry FROM public."User" WHERE email = ${EMAIL}`)[0];

if (step === 'setup') {
  await sql`INSERT INTO public."User" (id, email, "firstName", verified, "reviewFlag", "reviewFlaggedAt", "createdAt", "updatedAt")
            VALUES ('mc047rev' || substr(md5(random()::text), 1, 18), ${EMAIL}, 'MC-047 proof', true, 'reviewer-hold', NOW(), NOW(), NOW())
            ON CONFLICT (email) DO UPDATE SET "reviewFlag" = 'reviewer-hold', "reviewFlaggedAt" = NOW(), "verifyTokenHash" = NULL, "verifyExpiry" = NULL`;
  console.log('setup', JSON.stringify(await row()));
} else if (step === 'clear') {
  const r = await row();
  const opts = { headless: 'new', args: ['--no-sandbox'] };
const browser = await puppeteer.launch(opts).catch(() => puppeteer.launch({ ...opts, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }));
  const page = await browser.newPage();
  await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
  const auth = await page.evaluate(async (pw) => (await fetch('/api/admin/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) })).status, process.env.ADMIN_PASSWORD);
  console.log('admin sign-in', auth);
  await page.goto(`${base}/admin/vow`, { waitUntil: 'networkidle2' });
  const sel = `tr[data-held-row="${EMAIL}"] button[data-action="clear-hold"]`;
  const present = await page.$(sel);
  console.log('held row on the desk', !!present, r?.id);
  if (present) {
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click(sel)]);
    console.log('desk url', new URL(page.url()).search);
    const msg = await page.evaluate(() => document.body.innerText.match(/Hold cleared[^\n]*/)?.[0] ?? '(no message)');
    console.log('desk says', msg);
  }
  await browser.close();
  console.log('after', JSON.stringify(await row()));
} else if (step === 'follow') {
  const opts = { headless: 'new', args: ['--no-sandbox'] };
const browser = await puppeteer.launch(opts).catch(() => puppeteer.launch({ ...opts, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }));
  const page = await browser.newPage();
  await page.goto(arg, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));
  console.log('landed', new URL(page.url()).pathname);
  const me = await page.evaluate(async () => { const r = await fetch('/api/auth/me'); return { status: r.status, body: await r.json().catch(() => null) }; });
  console.log('me', me.status, me.body?.user?.email ?? null, 'reviewer label cleared:', JSON.stringify(await row()));
  await browser.close();
} else if (step === 'cleanup') {
  const r = await row();
  if (r) {
    await sql`DELETE FROM public."VowAccessLog" WHERE "userId" = ${r.id}`.catch(() => {});
    await sql`DELETE FROM public."VowConsent" WHERE "userId" = ${r.id}`.catch(() => {});
    await sql`DELETE FROM public."User" WHERE id = ${r.id}`;
  }
  console.log('cleanup', JSON.stringify(await row()) ?? 'row gone');
}
