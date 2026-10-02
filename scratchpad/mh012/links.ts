// MH-012: the hero's link table, from links.ts (the file the page reads), with each target's live
// status. npx tsx scratchpad/mh012/links.ts [base] > scratchpad/mh012/links.md
// A page target is fetched without following redirects; 200 is the only pass. A planned target is
// fetched too, to show it does not exist yet. tel: and in-page targets are not pages.
import { HERO_LINKS } from "../../src/components/home-design/links";

const base = (process.argv[2] ?? "https://miltonly.com").replace(/\/$/, "");

async function status(path: string) {
  const r = await fetch(base + path, { redirect: "manual", headers: { "user-agent": "miltonly-mh012" } });
  const html = r.status === 200 ? await r.text() : "";
  const robots = html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
  return { code: r.status, robots };
}

const side = { buy: "Buyer", sell: "Seller", rent: "Renter" } as const;

async function main() {
const rows: string[] = [];
const planned: string[] = [];
let bad = 0;
for (const l of HERO_LINKS) {
  const t = l.target;
  let target = "";
  let st = "";
  if (t.kind === "page") {
    const s = await status(t.href);
    target = `\`${t.href}\``;
    st = `${s.code}${s.robots ? ` · ${s.robots}` : ""}`;
    if (s.code !== 200) bad++;
  } else if (t.kind === "tel") {
    target = `\`${t.href}\``;
    st = "a phone number, not a page";
  } else if (t.kind === "focus") {
    target = `\`${t.href}\` (this hero's search field)`;
    st = "in-page; the search it opens is live";
  } else {
    const s = await status(t.path);
    target = `planned \`${t.path}\``;
    st = `${s.code} today, not built`;
    planned.push(`| ${side[l.side]} | ${l.label} | ${l.serves} | \`${t.path}\` | ${s.code} |`);
  }
  rows.push(`| ${side[l.side]} | ${l.role} | ${l.label} | \`${l.intent}\` | ${l.serves} | ${target} | ${st} |`);
}
console.log(`# MH-012 · hero links against ${base}\n`);
console.log("| Side | Role | Label | data-hero-intent | Intent it serves | Target | Status |");
console.log("|---|---|---|---|---|---|---|");
console.log(rows.join("\n"));
console.log("\n## Planned, not built\n");
console.log("| Side | Label | Intent | Planned path | Status today |");
console.log("|---|---|---|---|---|");
console.log(planned.join("\n"));
console.log(`\n${HERO_LINKS.filter((l) => l.target.kind === "page").length} page targets, ${bad} not answering 200.`);
process.exit(bad ? 1 : 0);
}
main();
