// MC-048: Lighthouse SEO (mobile, 390 px, the nightly's flags) on street pages, before and after.
//   LH_BIN=<lighthouse/cli/index.js> node scratchpad/mc048/lh-seo.mjs <label> <slug> [slug...]
// Writes scratchpad/mc048/lh/<label>-<slug>.json (the category, the failing SEO audits, the served
// <title> and meta description Lighthouse saw) and prints one line per street.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const [label, ...slugs] = process.argv.slice(2);
const LH = process.env.LH_BIN;
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
fs.mkdirSync("scratchpad/mc048/lh", { recursive: true });
for (const slug of slugs) {
  const url = `https://miltonly.com/streets/${slug}`;
  const raw = `scratchpad/mc048/lh/${label}-${slug}.raw.json`;
  try {
    execFileSync("node", [LH, url, "--output=json", `--output-path=${raw}`, "--quiet", "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
      "--only-categories=seo", "--form-factor=mobile", "--screenEmulation.mobile", "--screenEmulation.width=390", "--screenEmulation.height=844",
      "--screenEmulation.deviceScaleFactor=3", "--max-wait-for-load=45000"], { env: { ...process.env, CHROME_PATH: CHROME }, stdio: "ignore", timeout: 180000 });
  } catch { /* Lighthouse exits non-zero on some warnings; the JSON decides */ }
  const r = JSON.parse(fs.readFileSync(raw, "utf8"));
  const cat = r.categories.seo;
  const failing = cat.auditRefs.filter((ref) => ref.weight > 0 && r.audits[ref.id].score !== null && r.audits[ref.id].score < 1).map((ref) => ref.id);
  const out = { url, fetchTime: r.fetchTime, lighthouseVersion: r.lighthouseVersion, seo: Math.round(cat.score * 100), failing,
    title: r.audits["document-title"]?.score, metaDescription: r.audits["meta-description"]?.score };
  fs.writeFileSync(`scratchpad/mc048/lh/${label}-${slug}.json`, JSON.stringify(out, null, 1));
  fs.unlinkSync(raw);
  console.log(`${label} ${slug}: SEO ${out.seo} · failing [${failing.join(", ")}] · document-title ${out.title} · meta-description ${out.metaDescription} · ${out.fetchTime}`);
}
