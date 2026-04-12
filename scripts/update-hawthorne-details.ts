import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slug = "1005-nadalin-heights-411-milton";

  const rooms = [
    { name: "Living Room", level: "Main", size: "17 x 13 ft", notes: "W/O to balcony, laminate" },
    { name: "Dining Room", level: "Main", size: "17 x 13 ft", notes: "Combined w/living, laminate" },
    { name: "Kitchen", level: "Main", size: "10 x 11 ft", notes: "Granite counter, tile floor" },
    { name: "Primary Bedroom", level: "Main", size: "9 x 12 ft", notes: "Large window, double closet" },
    { name: "Den", level: "Main", size: "8 x 6 ft", notes: "Laminate" },
    { name: "Bathroom", level: "Main", size: "—", notes: "4 piece" },
  ];

  const interiorFeatures = [
    "Ensuite Laundry",
    "Central Air",
    "Open Concept",
    "Walk-Out Balcony",
    "Underground Parking",
    "Storage Locker",
    "Stainless Steel Appliances",
    "Granite Counters",
    "Laminate Floors",
    "Breakfast Bar",
    "In-Suite Laundry",
  ];

  const updated = await prisma.exclusiveListing.update({
    where: { slug },
    data: {
      sqft: 715,
      yearBuilt: null,
      maintenance: 390,
      taxes: 2120,
      taxYear: 2024,
      heating: "Forced Air Gas",
      cooling: "Central Air",
      basement: "None",
      garage: "Underground",
      locker: "Owned #134",
      exposure: "South",
      petFriendly: false,
      lotSize: "N/A - Condo",
      interiorFeatures,
      exteriorFeatures: [],
      rooms: rooms as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(`Updated: ${updated.slug}`);
  console.log(`Rooms: ${rooms.length}, Interior features: ${interiorFeatures.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
