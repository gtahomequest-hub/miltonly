// MC-044 proof 2: Web Analytics is SERVED and a real, non-headless view is RECORDED.
//
//   node scratchpad/mc044/prove-analytics.mjs <path> [base]
//
// 1. Reads the path's production page views for the current hour from Vercel's Web Analytics
//    Query API (GET api.vercel.com/v1/query/web-analytics/visits/aggregate, by=hour, filtered to
//    the path). The bearer is the Vercel CLI's own login (%APPDATA%/com.vercel.cli/Data/auth.json);
//    it is never printed or written.
// 2. Opens the page in a HEADED Chrome with the automation switch off, so navigator.webdriver is
//    false and the user agent carries no "Headless": the two things the served script checks
//    before it sends anything (MA-009's zero came from a headless browser).
// 3. Records every request to the analytics base path: the script, and the /view beacon with its
//    response status.
// 4. Polls the Query API until the path's count for the visit's hour has gone up, or 20 minutes.
import fs from "node:fs";
import puppeteer from "puppeteer";

const path = process.argv[2];
const base = process.argv[3] || "https://miltonly.com";
if (!path || !path.startsWith("/")) throw new Error("usage: prove-analytics.mjs /path [base]");

const token = JSON.parse(fs.readFileSync(`${process.env.APPDATA}/com.vercel.cli/Data/auth.json`, "utf8")).token;
const proj = JSON.parse(fs.readFileSync(".vercel/repo.json", "utf8")).projects.find((p) => p.name === "miltonly");
const t0 = Date.now();
const mark = (s) => console.log(`[${new Date().toISOString()}] ${s}`);

async function hourly(sinceMs) {
  const q = new URLSearchParams({
    projectId: proj.id,
    teamId: proj.orgId,
    since: String(sinceMs),
    until: String(Date.now() + 3_600_000),
    filter: `requestPath eq '${path}'`,
  });
  q.append("by", "hour");
  const r = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/aggregate?${q}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`query API ${r.status}`);
  const j = await r.json();
  return (j.data || []).map((d) => ({ hour: d.timestamp, pageviews: d.pageviews, visitors: d.visitors }));
}
const hourOf = (ms) => new Date(Math.floor(ms / 3_600_000) * 3_600_000).toISOString();
// Summed from the visit's hour onward: the beacon fires seconds after the page's Date header, so a
// visit on the hour lands in the next bucket (MC-044's own run: page 14:59:59Z, view in 15:00).
const countAt = (rows, hourIso) => rows.filter((r) => new Date(r.hour).toISOString() >= hourIso).reduce((a, r) => a + r.pageviews, 0);

const since = t0 - 6 * 3_600_000;
const before = await hourly(since);
mark(`before: ${path} by hour (last 6 h, production): ${JSON.stringify(before.filter((r) => r.pageviews))}`);

const browser = await puppeteer.launch({
  headless: false,
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled", "--window-size=1280,900"],
  defaultViewport: null,
});
const page = await browser.newPage();
const seen = [];
page.on("response", (res) => {
  const u = new URL(res.url());
  if (u.host !== new URL(base).host) return;
  if (/\/(script(\.debug)?\.js|view|event|vitals)$/.test(u.pathname) && !u.pathname.startsWith("/_next/"))
    seen.push({ at: new Date().toISOString(), method: res.request().method(), path: u.pathname, status: res.status() });
});
const ua = await browser.userAgent();
// The visit's hour bucket is taken from the server's Date header, not this desk's clock (it ran 12.4 s
// ahead on 2026-09-25, enough to put a visit in the wrong bucket near the hour).
const resp = await page.goto(base + path, { waitUntil: "networkidle2", timeout: 90_000 });
const visitLocal = Date.now();
const visitMs = Date.parse(resp.headers()["date"]) || visitLocal;
await new Promise((r) => setTimeout(r, 6000));
const env = await page.evaluate(() => ({ webdriver: navigator.webdriver, ua: navigator.userAgent, headless: navigator.userAgent.includes("Headless") }));
mark(`browser: headed, navigator.webdriver=${env.webdriver}, "Headless" in UA=${env.headless}, UA=${ua}`);
for (const s of seen) mark(`request: ${s.method} ${s.path} -> ${s.status}`);
const beacon = seen.find((s) => s.method === "POST" && s.path.endsWith("/view"));
mark(beacon ? `beacon FIRED: POST ${beacon.path} answered ${beacon.status}` : "beacon NOT seen");
await browser.close();

const visitHour = hourOf(visitMs);
const n0 = countAt(before, visitHour);
mark(`visit at ${new Date(visitMs).toISOString()} (hour bucket ${visitHour}); count from that bucket on, before: ${n0}`);
let recorded = null;
for (let i = 0; i < 40 && !recorded; i++) {
  await new Promise((r) => setTimeout(r, 30_000));
  const now = await hourly(since);
  const n1 = countAt(now, visitHour);
  if (n1 > n0) recorded = { n0, n1, after_s: Math.round((Date.now() - visitLocal) / 1000) };
  else if (i % 4 === 3) mark(`still ${n1} from ${visitHour} on after ${Math.round((Date.now() - visitLocal) / 1000)} s`);
}
mark(recorded ? `RECORDED: ${path} page views from ${visitHour} on ${recorded.n0} -> ${recorded.n1}, visible in the Query API ${recorded.after_s} s after the visit` : "NOT RECORDED within 20 minutes");
process.exit(beacon && recorded ? 0 : 1);
