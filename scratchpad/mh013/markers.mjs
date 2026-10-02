// MH-013: the leak test's own marker regexes (scripts/verify/leak.mjs) on every option and palette, HTML
// and RSC, plus the count of JSON-LD blocks. node scratchpad/mh013/markers.mjs <base>
const base = process.argv[2].replace(/\/$/, "");
const MH = /\sdata-vow(?=[\s=>\/])/, MR = /"data-vow"\s*:/;
for (const o of ["c", "d"]) for (const p of ["1", "2", "3"]) {
  const u = `${base}/design-preview/home?option=${o}&palette=${p}`;
  const h = await (await fetch(u)).text();
  const r = await (await fetch(u, { headers: { RSC: "1" } })).text();
  console.log(`?option=${o}&palette=${p} marker html=${MH.test(h)} rsc=${MR.test(r) || MH.test(r)} jsonld=${(h.match(/application\/ld\+json/g) || []).length}`);
}
