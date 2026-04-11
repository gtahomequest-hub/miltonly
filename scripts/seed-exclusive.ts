import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slug = "1005-nadalin-heights-411-milton";

  const existing = await prisma.exclusiveListing.findUnique({ where: { slug } });
  if (existing) {
    console.log(`Listing already exists: ${slug}`);
    return;
  }

  const created = await prisma.exclusiveListing.create({
    data: {
      title: "Bright 1+1 Condo \u2014 Hawthorne Village",
      address: "1005 Nadalin Heights, Unit 411",
      city: "Milton, ON",
      price: 2250,
      priceType: "rent",
      bedsMin: 1,
      bedsMax: 1,
      baths: 1,
      parking: 1,
      propertyType: "Condo",
      status: "active",
      badge: "For Rent",
      slug,
      description:
        "Bright and spacious 1-bedroom plus den condo in Milton's sought-after Hawthorne Village on the Escarpment. Open-concept living with modern finishes, stainless steel appliances, extended cabinetry and breakfast bar flowing into combined living and dining area with walk-out to private balcony. Generous primary bedroom with large windows and double closet. Versatile den ideal as home office or guest room. In-suite laundry, underground parking and storage locker included. Steps to parks, schools, shopping, transit and highways. 715 sq ft.",
      photos: [
        "https://drive.google.com/uc?export=view&id=1Nfae2RAxbeqnVdpbCGCaTg0O8JbEvvdj",
        "https://drive.google.com/uc?export=view&id=1a4YE5y4ljVHoBhNnU7MA_LcYxc6iCQ_F",
        "https://drive.google.com/uc?export=view&id=1tCX2jGkNH0Xs9m2BxSE6WWMWoaS_yhcm",
        "https://drive.google.com/uc?export=view&id=11LwrqBV_C_GQlYrTcMIaR_9h5c0xoY5q",
        "https://drive.google.com/uc?export=view&id=1kQETNoTQMsU7kUCBNWhFuFRwXmdUHAk5",
        "https://drive.google.com/uc?export=view&id=1x72RO_FnULNAGxCAt2WvfSERHLYfszaR",
        "https://drive.google.com/uc?export=view&id=1HJVChJo_FnU6Wi7xBB3E4lKzAIevZqeF",
        "https://drive.google.com/uc?export=view&id=1vS8lmuLxkzi7AnN5S8-YOPcXAiNmVD0X",
        "https://drive.google.com/uc?export=view&id=1Ktc1Mmh7zbatagHn4LIjuQ2NH3o_eE2w",
        "https://drive.google.com/uc?export=view&id=18GT21GLb8rBOxGfswsR2Od09_UjHq9a4",
        "https://drive.google.com/uc?export=view&id=1MfGvGx_6K7zsFu-bk3aHbASzThmP-RpP",
        "https://drive.google.com/uc?export=view&id=1ea07JSb6B-ly6pgJpkqqtAiciAozTa2i",
        "https://drive.google.com/uc?export=view&id=1cWkqoOW5lV5TlSN8V_WkRElwUDKDrt6L",
        "https://drive.google.com/uc?export=view&id=1eCwuFmvuGUhLoPj_ENrSif1xizXpMze1",
        "https://drive.google.com/uc?export=view&id=1O5COj78Ah7E2DuycTavlZG3MKmkTGElS",
        "https://drive.google.com/uc?export=view&id=1DPtNE_NWCIr4Nyk1jELPyNiUVC4DW3WW",
        "https://drive.google.com/uc?export=view&id=1CB7MToi1KoyXL0pXjkgltmwc2MTVgXB4",
        "https://drive.google.com/uc?export=view&id=1XEdvpy08H6KIfN2aUZ9UbRnfdQ-aNz2m",
        "https://drive.google.com/uc?export=view&id=1P0b0Dmz3W9vHMtEIBGhw98GT5SHIBT97",
      ],
    },
  });

  console.log(`Created: ${created.id} (${created.slug})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
