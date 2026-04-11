import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.exclusiveListing.updateMany({
    where: { slug: "1005-nadalin-heights-411-milton" },
    data: { photos: [] },
  });
  console.log(`Cleared photos on ${updated.count} listing(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
