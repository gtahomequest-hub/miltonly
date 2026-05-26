import { PrismaClient } from "@prisma/client";

const soldDbUrl = process.env.SOLD_DATABASE_URL;
if (!soldDbUrl) {
  console.error("SOLD_DATABASE_URL not set");
  process.exit(1);
}

const soldDb = new PrismaClient({
  datasources: { db: { url: soldDbUrl } },
});

async function main() {
  const samples = [
    "Main St",
    "Derry Rd",
    "Ontario St",
    "Gordon Krantz Ave",
    "Nadalin Hts",
    "English Mill Crt",
  ];

  for (const streetName of samples) {
    try {
      const count = await soldDb.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint as count FROM sold_records WHERE address ILIKE '%' || $1 || '%'`,
        streetName,
      );
      const c = Number(count[0]?.count || 0);
      console.log(streetName + ": " + c + " historical sold records in DB2");
    } catch (e) {
      console.log(streetName + ": query failed - " + (e as Error).message);
    }
  }

  await soldDb.$disconnect();
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
