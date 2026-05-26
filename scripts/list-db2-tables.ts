import { PrismaClient } from "@prisma/client";

const soldDb = new PrismaClient({
  datasources: { db: { url: process.env.SOLD_DATABASE_URL! } },
});

async function main() {
  // Just the address-related columns
  const columns = await soldDb.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_schema = 'sold' AND table_name = 'sold_records'
     AND (column_name ILIKE '%address%' OR column_name ILIKE '%street%' OR column_name ILIKE '%neighbourhood%' OR column_name ILIKE '%community%')
     ORDER BY column_name`
  );
  console.log("Address/street/neighbourhood columns:");
  for (const c of columns) console.log("  " + c.column_name);
  
  console.log("");
  // Sample 3 rows so we can see actual address values
  const samples = await soldDb.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM sold.sold_records LIMIT 3`
  );
  if (samples.length > 0) {
    console.log("Sample row keys (first row only, address-relevant filter):");
    const firstRow = samples[0];
    for (const key of Object.keys(firstRow).sort()) {
      if (/address|street|neighbourhood|community/i.test(key)) {
        console.log("  " + key + " = " + JSON.stringify(firstRow[key]));
      }
    }
  }
  
  await soldDb.$disconnect();
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
