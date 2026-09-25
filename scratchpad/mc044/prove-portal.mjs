// MC-044 proof 1: MP-006 on production.
//
//   node scratchpad/mc044/prove-portal.mjs <base> <street-slug>
//
// A. THE CARD, v4, TEN NUMBERED CLAUSES, CLAUSE 9 BOLD, rendered by production's own bundle
//    and stylesheet. No real row owes the card (both rows are current on v4), and stepping the
//    desk's row back to v3 would write a false history row into VowConsent (the v4 text carried
//    as "version 3"), the table PropTx may audit. So the browser answers the island's two
//    fetches the way production answers a signed-in row that owes re-consent
//    (sold-records route: {canSee:false, needsAcknowledgement:true}; /api/auth/me: needsReconsent)
//    and production's client code renders its card. Nothing is submitted.
// B. THE TRAIL: a real password sign-in as VERIFY_PORTAL_EMAIL through the street's gate, the
//    sold records read, then the VowAccessLog row that read wrote, from DB1.
// C. THE EXPORT: /api/admin/vow-access without the admin cookie (401), and with it (CSV).
//
// Secrets (the portal password, ADMIN_PASSWORD, the cookies) are read from .env.local and never
// printed. Emails and IPs are masked in the output.
import fs from "node:fs";
import puppeteer from "puppeteer";

for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const [base, slug] = process.argv.slice(2);
if (!base || !slug) throw new Error("usage: prove-portal.mjs <base> <street-slug>");
const EMAIL = process.env.VERIFY_PORTAL_EMAIL;
const PASSWORD = process.env.VERIFY_PORTAL_PASSWORD;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const OUT = "scratchpad/mc044/shots";
fs.mkdirSync(OUT, { recursive: true });
const maskEmail = (e) => String(e || "").replace(/^(.{3}).*(@.*)$/, "$1…$2");
const maskIp = (ip) => String(ip || "").replace(/(\d+\.\d+)\.\d+\.\d+/, "$1.x.x");
const mark = (s) => console.log(`[${new Date().toISOString()}] ${s}`);
let failures = 0;
const check = (ok, label) => { if (!ok) failures++; mark(`${ok ? "PASS" : "FAIL"} ${label}`); };

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--no-sandbox"],
});

// ── A. the card ─────────────────────────────────────────────────────────────────────────
{
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.pathname === `/api/streets/${slug}/sold-records`)
      return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ canSee: false, needsAcknowledgement: true, records: [] }) });
    if (u.pathname === "/api/auth/me")
      return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { email: "proof@example.invalid", firstName: "Proof", needsAcknowledgement: true, needsReconsent: true, needsPassword: false, needsPasswordRenewal: false, needsRegistrantAnswer: false } }) });
    if (req.method() !== "GET") return req.abort(); // nothing is ever sent from this page
    return req.continue();
  });
  await page.goto(`${base}/streets/${slug}`, { waitUntil: "networkidle2", timeout: 90_000 });
  await page.waitForSelector("[data-vow-terms] li[data-clause]", { timeout: 30_000 });
  const card = await page.evaluate(() => {
    const terms = document.querySelector("[data-vow-terms]");
    const ol = terms.querySelector("ol.vc-terms");
    const lis = [...terms.querySelectorAll("li[data-clause]")];
    const olStyle = getComputedStyle(ol);
    return {
      heading: document.querySelector("[data-vow-ack] .vc-h")?.textContent.trim() || null,
      version: terms.getAttribute("data-vow-terms-version"),
      head: terms.querySelector(".vc-terms-head")?.textContent.trim(),
      olListStyle: olStyle.listStyleType,
      clauses: lis.map((li) => {
        const s = li.querySelector("strong");
        const cs = getComputedStyle(s || li);
        return { key: li.getAttribute("data-clause"), display: getComputedStyle(li).display, bold: !!s, fontWeight: cs.fontWeight, start: li.textContent.trim().slice(0, 70) };
      }),
    };
  });
  mark(`card heading "${card.heading}", terms head "${card.head}", data-vow-terms-version=${card.version}, ol list-style-type=${card.olListStyle}`);
  card.clauses.forEach((c, i) => mark(`  ${i + 1}. [${c.key}] display=${c.display} weight=${c.fontWeight}${c.bold ? " <strong>" : ""} "${c.start}…"`));
  check(card.version === "4", "terms version 4 on the card");
  check(card.clauses.length === 10, `ten clauses (${card.clauses.length})`);
  check(card.olListStyle === "decimal" && card.clauses.every((c) => c.display === "list-item"), "numbered: ol decimal, every li a list-item");
  const bold = card.clauses.filter((c) => Number(c.fontWeight) >= 600);
  check(bold.length === 1 && card.clauses.indexOf(bold[0]) === 8 && bold[0].key === "ix", `clause 9 (ix) is the only bold clause (${bold.map((b) => b.key).join(",")})`);
  // The card element itself, not the viewport: a scroll-then-viewport shot missed it on the first run.
  await (await page.$("[data-vow-ack]")).screenshot({ path: `${OUT}/card-v4-terms.png` });
  await page.close();
}
if (process.env.CARD_ONLY) {
  await browser.close();
  mark(failures ? `CARD: ${failures} FAILED` : "CARD: ALL PASS");
  process.exit(failures ? 1 : 0);
}

// ── B. the trail ────────────────────────────────────────────────────────────────────────
const user = (await sql`SELECT id, "vowAcknowledgementVersion" v, "isRegistrant" r, ("passwordSetAt" AT TIME ZONE 'UTC') p FROM public."User" WHERE email = ${EMAIL}`)[0];
mark(`sign-in row ${maskEmail(EMAIL)}: terms v${user.v}, registrant ${user.r}, password set ${user.p.toISOString()}`);
const [{ n: trailBefore }] = await sql`SELECT count(*)::int n FROM public."VowAccessLog" WHERE "userId" = ${user.id}`;
// The start is read from the database's clock, not this desk's: the desk ran 12.4 s ahead of Neon and
// Vercel on 2026-09-25, and a local start filtered out the very row the read wrote.
const startedAt = (await sql`SELECT clock_timestamp() t`)[0].t;
{
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/streets/${slug}`, { waitUntil: "networkidle2", timeout: 90_000 });
  await page.waitForSelector("#sold-records .s-gate-btn", { timeout: 30_000 });
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.click("#sold-records .s-gate-btn")]);
  await page.waitForSelector("#signin-email", { timeout: 30_000 });
  await page.type("#signin-email", EMAIL);
  await page.$eval("#signin-email", (el) => el.form.querySelector('button[type="submit"]').click());
  await page.waitForSelector("#signin-password", { timeout: 30_000 });
  await page.type("#signin-password", PASSWORD);
  await page.$eval("#signin-password", (el) => el.form.querySelector('button[type="submit"]').click());
  await page.waitForFunction(() => location.pathname.startsWith("/streets/"), { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelectorAll("#sold-records tbody tr td:not([colspan])").length > 0 || document.querySelector("[data-vow-ack]"), { timeout: 30_000 });
  const card = !!(await page.$("[data-vow-ack]"));
  const rows = await page.$$eval("#sold-records tbody tr", (trs) => trs.filter((tr) => !tr.querySelector("td[colspan]")).length);
  const me = await page.evaluate(() => fetch("/api/auth/me").then((r) => r.json()));
  const u = me.user || {};
  mark(`signed in, landed ${new URL(page.url()).pathname}; card shown: ${card}; sold rows served: ${rows}`);
  mark(`/api/auth/me: termsVersion=${u.termsVersion} needsAcknowledgement=${u.needsAcknowledgement} needsReconsent=${u.needsReconsent} needsPassword=${u.needsPassword} needsPasswordRenewal=${u.needsPasswordRenewal} needsRegistrantAnswer=${u.needsRegistrantAnswer} passwordExpiresAt=${u.passwordExpiresAt}`);
  check(!card && rows > 0, "a current row reads the street's sold records with no card");
  await page.close();
}
await new Promise((r) => setTimeout(r, 2000));
// Prisma writes these columns as zone-less timestamp(3) holding UTC; the Neon driver would read them
// as local time, so both the filter and the read go through AT TIME ZONE 'UTC'.
const trail = await sql`SELECT (at AT TIME ZONE 'UTC') at, kind, scope, path, "recordCount" n, ip, "userAgent" ua FROM public."VowAccessLog" WHERE "userId" = ${user.id} AND (at AT TIME ZONE 'UTC') >= ${startedAt.toISOString()}::timestamptz ORDER BY at`;
const [{ n: trailAfter }] = await sql`SELECT count(*)::int n FROM public."VowAccessLog" WHERE "userId" = ${user.id}`;
for (const t of trail) mark(`  trail row: ${t.at.toISOString()} ${t.kind} ${t.scope} path=${t.path} n=${t.n} ip=${maskIp(t.ip)} ua=${String(t.ua).slice(0, 40)}…`);
check(trail.some((t) => t.kind === "street-records" && t.scope === slug && t.n > 0), `a street-records row for ${slug} written by the read (${trailBefore} -> ${trailAfter} rows for this user)`);

// ── C. the export ───────────────────────────────────────────────────────────────────────
{
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const q = `/api/admin/vow-access?from=${today}&to=${tomorrow}&format=csv`;
  const anon = await fetch(base + q, { headers: { "user-agent": UA } });
  mark(`without the admin cookie: ${anon.status} ${anon.headers.get("content-type")}`);
  check(anon.status === 401, "401 without the admin cookie");
  const auth = await fetch(`${base}/api/admin/auth`, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) });
  const cookie = (auth.headers.get("set-cookie") || "").match(/miltonly_admin=([^;]+)/)?.[1];
  mark(`admin sign-in: ${auth.status}, cookie ${cookie ? "issued" : "NOT issued"}`);
  const res = await fetch(base + q, { headers: { "user-agent": UA, cookie: `miltonly_admin=${cookie}` } });
  const body = await res.text();
  const lines = body.trim().split(/\r?\n/);
  mark(`with the admin cookie: ${res.status} ${res.headers.get("content-type")}; ${res.headers.get("content-disposition")}; cache-control ${res.headers.get("cache-control")}`);
  mark(`  header: ${lines[0]}`);
  mark(`  ${lines.length - 1} data rows for ${today}; rows naming ${slug}: ${lines.filter((l) => l.includes(slug)).length}`);
  check(res.status === 200 && /text\/csv/.test(res.headers.get("content-type") || "") && lines.length > 1 && lines.some((l) => l.includes(slug)), "CSV with the admin cookie, carrying today's read");
}

await browser.close();
mark(failures ? `PORTAL PROOF: ${failures} FAILED` : "PORTAL PROOF: ALL PASS");
process.exit(failures ? 1 : 0);
