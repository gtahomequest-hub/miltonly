import fs from 'node:fs';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) { let v = m[2].replace(/\r$/, ''); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } }
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const lease = await prisma.listing.findMany({ where: { permAdvertise: true, city: 'Milton', transactionType: 'For Lease', leaseStatus: 'active', displayAddress: true }, orderBy: { listedAt: 'desc' }, take: 3, select: { mlsNumber: true, address: true, price: true } });
const sale = await prisma.listing.findMany({ where: { permAdvertise: true, city: 'Milton', status: 'active', transactionType: { not: 'For Lease' }, displayAddress: true }, orderBy: { listedAt: 'desc' }, take: 3, select: { mlsNumber: true, address: true, price: true } });
const probe = await prisma.listing.findMany({ where: { mlsNumber: { in: ['W13823258', 'W13832706'] } }, select: { mlsNumber: true, transactionType: true, status: true, leaseStatus: true } });
console.log('lease:', lease.map((l) => `${l.mlsNumber} ${l.address.split(',')[0]} $${l.price}`).join(' | '));
console.log('sale:', sale.map((l) => `${l.mlsNumber} ${l.address.split(',')[0]} $${l.price}`).join(' | '));
console.log('probe:', JSON.stringify(probe));
await prisma.$disconnect();
