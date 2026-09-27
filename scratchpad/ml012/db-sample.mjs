// ML-012 evidence: the 48 newest public leases per view, their Listing.streetSlug, and whether that
// slug is a published street page (StreetContent published AND a ResidentialStreet entity, the
// same set publishedStreetPageSlugs() serves). Read only.
import fs from 'node:fs';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) { let v = m[2].replace(/\r$/, ''); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; }
}
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const PUBLIC_LEASE_WHERE = { permAdvertise: true, city: 'Milton', transactionType: 'For Lease', leaseStatus: 'active' };
const [pub, ents] = await Promise.all([
  prisma.streetContent.findMany({ where: { status: 'published' }, select: { streetSlug: true } }),
  prisma.residentialStreet.findMany({ select: { slug: true } }),
]);
const entSet = new Set(ents.map((r) => r.slug));
const published = new Set(pub.map((r) => r.streetSlug).filter((s) => entSet.has(s)));
console.log(`published street pages: ${published.size} (StreetContent published ${pub.length}, entities ${ents.length})`);
const views = [['all', {}]];
for (const slug of ['timberlea', 'harrison']) {
  const n = await prisma.neighbourhood.findUnique({ where: { slug }, select: { rawStrings: true, name: true } });
  views.push([slug, n ? { neighbourhood: { in: n.rawStrings } } : null]);
}
const out = {};
for (const [name, scopeWhere] of views) {
  if (!scopeWhere) { console.log(`${name}: no Neighbourhood row`); continue; }
  const rows = await prisma.listing.findMany({ where: { ...PUBLIC_LEASE_WHERE, ...scopeWhere }, orderBy: { listedAt: 'desc' }, take: 48, select: { mlsNumber: true, address: true, streetSlug: true, displayAddress: true } });
  const withheld = rows.filter((r) => !r.displayAddress).length;
  const linkable = rows.filter((r) => r.displayAddress && published.has(r.streetSlug));
  const unlinkable = rows.filter((r) => r.displayAddress && !published.has(r.streetSlug));
  const suffixed = unlinkable.filter((r) => published.has(`${r.streetSlug}-milton`)).length;
  console.log(`\n== ${name}: ${rows.length} rows, withheld ${withheld}, published-street ${linkable.length}, no page ${unlinkable.length} (of which ${suffixed} would match with -milton appended)`);
  console.log('  sample streetSlug values:', rows.slice(0, 6).map((r) => r.streetSlug).join(' | '));
  console.log('  no page:', unlinkable.map((r) => `${r.streetSlug} <${r.address.split(',')[0]}>`).join(' ; '));
  out[name] = { rows: rows.length, withheld, linkable: linkable.length, unlinkable: unlinkable.map((r) => r.streetSlug), linkableSlugs: linkable.map((r) => r.streetSlug) };
}
fs.writeFileSync('scratchpad/ml012/db-sample.json', JSON.stringify(out, null, 1));
await prisma.$disconnect();
