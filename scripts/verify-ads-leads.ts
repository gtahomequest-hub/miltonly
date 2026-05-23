// One-off verification that the Prisma client can talk to ads.leads.
// Expected output on first run: "ads.leads row count: 0"
// Run with: npx tsx scripts/verify-ads-leads.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.adsLead.count();
  console.log(`ads.leads row count: ${count}`);
}

main()
  .catch((err) => {
    console.error("verify-ads-leads failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
