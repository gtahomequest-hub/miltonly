// MP-002 preview proof, at a phone viewport (390 x 844).
//
//   node scratchpad/mp002/probe-door.mjs request <base> <slug> <email>
//     opens the street page, taps "Sign in free to unlock", types the email, submits.
//     Prints the /signin URL it landed on and the message shown. Screenshots 01..03.
//
//   node scratchpad/mp002/probe-door.mjs link <link> <name> <streetQuery> <password>
//   node scratchpad/mp002/probe-door.mjs login <base> <slug> <email> <password>   (MP-002b)
//   node scratchpad/mp002/probe-door.mjs wrong <base> <slug> <email> <badpassword> (MP-002b)
//     opens the emailed link, waits to land on the street's sold records, fills the
//     one-time card (name, street from the registry autocomplete, tick), submits, waits for
//     rows. Prints the landing URL, the card's presence, the row count and the first row.
//     Screenshots 04..07.
//
// Screenshots go to scratchpad/mp002/shots/.

import puppeteer from "puppeteer";
import fs from "node:fs";

const [, , mode, ...args] = process.argv;
const OUT = "scratchpad/mp002/shots";
fs.mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.setUserAgent(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const t0 = Date.now();
const mark = (label) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${label}`);


// MP-006: fill whatever the card shows (registrant radio, name, street, password x2, the terms
// tick) and report which parts were present. `registrant` is "no" | "yes".
async function fillCard(name, streetQuery, password, registrant = "no") {
  const parts = await page.evaluate(() => ({
    registrantQ: !!document.querySelector("[data-vow-registrant-question]"),
    texts: document.querySelectorAll("[data-vow-ack] input[type=text]").length,
    passwords: document.querySelectorAll("[data-vow-ack] input[type=password]").length,
    terms: !!document.querySelector("[data-vow-terms]"),
    termsVersion: document.querySelector("[data-vow-terms]")?.getAttribute("data-vow-terms-version") || null,
    clauses: document.querySelectorAll("[data-vow-terms] li[data-clause]").length,
    boldClause: document.querySelector("[data-vow-terms] li[data-clause=ix] strong") ? "ix" : null,
    heading: document.querySelector("[data-vow-ack] .vc-h")?.textContent.trim() || null,
    refused: !!document.querySelector("[data-vow-registrant]"),
  }));
  mark(`card: "${parts.heading}" registrantQ=${parts.registrantQ} texts=${parts.texts} passwords=${parts.passwords} terms=${parts.terms} v${parts.termsVersion} clauses=${parts.clauses} bold=${parts.boldClause}`);
  if (parts.refused) return parts;
  if (parts.registrantQ) await page.click(`[data-vow-registrant-question] input[value=${registrant}]`);
  if (registrant === "yes") {
    await page.click("[data-vow-ack] button[type=button]");
    await page.waitForSelector("[data-vow-registrant]", { timeout: 30000 });
    mark(`answered yes: "${await page.$eval("[data-vow-registrant] .vc-h", (h) => h.textContent.trim())}"`);
    return { ...parts, refusedAfter: true };
  }
  // Two text fields: name then street. One: the street alone (the row already has a name).
  const inputs = await page.$$("[data-vow-ack] input[type=text]");
  const streetField = inputs.length === 2 ? inputs[1] : inputs.length === 1 ? inputs[0] : null;
  if (inputs.length === 2 && name) await inputs[0].type(name);
  if (streetField && streetQuery) {
    await streetField.type(streetQuery);
    await page.waitForSelector("#vow-street-options button", { timeout: 15000 });
    mark(`autocomplete first hit "${await page.$eval("#vow-street-options button", (b) => b.textContent.trim())}"`);
    await page.click("#vow-street-options button");
  }
  const pw = await page.$$("[data-vow-ack] input[type=password]");
  for (const el of pw) await el.type(password);
  if (parts.terms) await page.click("[data-vow-ack] input[type=checkbox]");
  await shot("06-card-filled");
  await page.click("[data-vow-ack] button[type=button]");
  await page.waitForFunction(() => !document.querySelector("[data-vow-ack]") && document.querySelectorAll("#sold-records tbody tr td:not([colspan])").length > 0, { timeout: 30000 });
  return parts;
}

try {
  if (mode === "request") {
    const [base, slug, email] = args;
    await page.goto(`${base}/streets/${slug}`, { waitUntil: "networkidle2", timeout: 90000 });
    await page.waitForSelector("#sold-records .s-gate-btn", { timeout: 30000 });
    await page.evaluate(() => document.querySelector("#sold-records").scrollIntoView({ block: "center" }));
    await new Promise((r) => setTimeout(r, 500));
    await shot("01-street-gate");
    const gateText = await page.$eval("#sold-records .s-gate-btn", (a) => a.textContent.trim());
    const href = await page.$eval("#sold-records .s-gate-btn", (a) => a.getAttribute("href"));
    mark(`gate button "${gateText}" -> ${href}`);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.click("#sold-records .s-gate-btn")]);
    mark(`landed ${page.url()}`);
    await page.waitForSelector("#signin-email", { timeout: 30000 });
    await page.type("#signin-email", email);
    await shot("02-signin-email");
    await page.$eval("#signin-email", (el) => el.form.querySelector('button[type="submit"]').click());
    await page.waitForSelector("#signin-password", { timeout: 30000 });
    mark("password step shown");
    await shot("02b-signin-password-step");
    await page.click("#signin-link-instead");
    await page.waitForSelector("#signin-code", { timeout: 30000 });
    const msg = await page.$eval("#signin-code", (el) => el.form.innerText.split("\n").slice(0, 3).join(" | "));
    mark(`code step shown: ${msg}`);
    await shot("03-signin-code-step");
  } else if (mode === "link") {
    const [link, name, streetQuery, password] = args;
    await page.goto(link, { waitUntil: "networkidle2", timeout: 90000 });
    await page.waitForFunction(() => location.pathname.startsWith("/streets/"), { timeout: 60000 });
    mark(`link landed ${page.url()}`);
    await page.waitForSelector("[data-vow-ack]", { timeout: 30000 });
    await page.evaluate(() => document.querySelector("#sold-records").scrollIntoView({ block: "start" }));
    await new Promise((r) => setTimeout(r, 400));
    await shot("04-card");
    const registrant = args[4] || "no";
    const parts = await fillCard(name, streetQuery, password, registrant);
    if (parts.refused || parts.refusedAfter) {
      await shot("13-registrant-refused");
      mark("registrant refused: no records");
    } else {
    const rows = await page.$$eval("#sold-records tbody tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()).join(" · ")));
    mark(`acknowledged; ${rows.length} rows; first: ${rows[0]}`);
    const gated = await page.$eval("#sold-records", (el) => el.classList.contains("s-gated"));
    mark(`gated class present: ${gated}`);
    await page.evaluate(() => document.querySelector("#sold-records").scrollIntoView({ block: "start" }));
    await new Promise((r) => setTimeout(r, 400));
    await shot("07-records");
    }
    const me = await page.evaluate(() => fetch("/api/auth/me").then((r) => r.json()));
    mark(`/api/auth/me: ${JSON.stringify(me)}`);
  } else if (mode === "login" || mode === "wrong") {
    const [base, slug, email, password] = args;
    await page.goto(`${base}/streets/${slug}`, { waitUntil: "networkidle2", timeout: 90000 });
    await page.waitForSelector("#sold-records .s-gate-btn", { timeout: 30000 });
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.click("#sold-records .s-gate-btn")]);
    await page.waitForSelector("#signin-email", { timeout: 30000 });
    await page.type("#signin-email", email);
    await page.$eval("#signin-email", (el) => el.form.querySelector('button[type="submit"]').click());
    await page.waitForSelector("#signin-password", { timeout: 30000 });
    await page.type("#signin-password", password);
    await shot(mode === "login" ? "08-login-password" : "10-wrong-password");
    await page.$eval("#signin-password", (el) => el.form.querySelector('button[type="submit"]').click());
    if (mode === "wrong") {
      await page.waitForFunction(() => /do not match/.test(document.body.innerText), { timeout: 30000 });
      const msg = await page.$eval("#signin-password", (el) => [...el.form.querySelectorAll("p")].map((p) => p.textContent.trim()).find((t) => /do not match/.test(t)));
      mark(`refused: "${msg}"; still on ${page.url()}`);
      await shot("11-wrong-password-refused");
    } else {
      await page.waitForFunction(() => location.pathname.startsWith("/streets/"), { timeout: 60000 });
      mark(`login landed ${page.url()}`);
      await page.waitForFunction(() => document.querySelectorAll("#sold-records tbody tr td:not([colspan])").length > 0 || document.querySelector("[data-vow-ack]"), { timeout: 30000 });
      let card = !!(await page.$("[data-vow-ack]"));
      if (card) {
        await page.evaluate(() => document.querySelector("#sold-records").scrollIntoView({ block: "start" }));
        await new Promise((r) => setTimeout(r, 300));
        await shot("14-card-on-login");
        const parts = await fillCard(null, null, password, args[4] || "no");
        if (parts.refused || parts.refusedAfter) {
          await shot("13-registrant-refused");
          mark("registrant wall shown; no records");
          card = null;
        } else {
          card = !!(await page.$("[data-vow-ack]"));
        }
      }
      if (card === null) {
        // the wall: nothing more to read
      } else {
      const rows = await page.$$eval("#sold-records tbody tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()).join(" · ")));
      mark(`card shown now: ${card}; ${rows.length} rows; first: ${rows[0]}`);
      await page.evaluate(() => document.querySelector("#sold-records").scrollIntoView({ block: "start" }));
      await new Promise((r) => setTimeout(r, 400));
      await shot("09-login-records");
      }
    }
  } else {
    throw new Error("mode: request | link | login | wrong");
  }
} finally {
  await browser.close();
}
