import { prisma } from "@/lib/prisma";
import { parseLivingAreaRange } from "@/lib/sync/parse-utils";

const TREB_API_URL = process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property";
const TREB_TOKEN = process.env.TREB_API_TOKEN || "";
const PAGE_SIZE = 1000;

const SELECT_FIELDS = [
  "ListingKey", "ListPrice", "City", "CityRegion",
  "StreetNumber", "StreetName", "StreetSuffix", "UnitNumber",
  "PostalCode", "StateOrProvince",
  "BedroomsTotal", "BathroomsTotalInteger",
  "PropertyType", "PropertySubType", "TransactionType",
  "MlsStatus", "LivingAreaRange", "Basement",
  "ParkingTotal",
  "PublicRemarks", "OriginalEntryTimestamp",
  "ListOfficeName", "UnparsedAddress", "Latitude", "Longitude",
  "PetsAllowed", "RentIncludes", "LaundryFeatures",
  "Cooling", "HeatType", "HeatSource", "Furnished", "PossessionDetails",
  "MinimumRentalTermMonths", "Locker",
  "LotSizeArea", "LotDepth", "LotWidth", "GarageType",
  "Roof", "FoundationDetails", "ConstructionMaterials",
  "ExteriorFeatures", "InteriorFeatures",
  "FireplaceYN", "ArchitecturalStyle", "ApproximateAge",
  "TaxAnnualAmount", "TaxYear", "AssociationFee",
  "DirectionFaces", "CrossStreet", "Sewer", "WaterSource",
  "VirtualTourURLUnbranded", "ListOfficeName",
  "RoomsTotal", "NumberOfKitchens",
].join(",");

interface AmpProperty {
  ListingKey: string;
  ListPrice: number;
  City: string;
  CityRegion: string | null;
  StreetNumber: string | null;
  StreetName: string | null;
  StreetSuffix: string | null;
  UnitNumber: string | null;
  PostalCode: string | null;
  StateOrProvince: string | null;
  BedroomsTotal: number | null;
  BathroomsTotalInteger: number | null;
  PropertyType: string | null;
  PropertySubType: string | null;
  TransactionType: string | null;
  MlsStatus: string | null;
  LivingAreaRange: string | null;
  Basement: string[] | null;
  ParkingTotal: number | null;
  PublicRemarks: string | null;
  OriginalEntryTimestamp: string | null;
  UnparsedAddress: string | null;
  Latitude: number | null;
  Longitude: number | null;
  PetsAllowed: string[] | null;
  RentIncludes: string[] | null;
  LaundryFeatures: string[] | null;
  Cooling: string[] | null;
  HeatType: string | null;
  HeatSource: string | null;
  Furnished: string | null;
  PossessionDetails: string | null;
  MinimumRentalTermMonths: number | null;
  Locker: string | null;
  LotSizeArea: number | null;
  LotDepth: number | null;
  LotWidth: number | null;
  GarageType: string | null;
  Roof: string[] | null;
  FoundationDetails: string[] | null;
  ConstructionMaterials: string[] | null;
  ExteriorFeatures: string[] | null;
  InteriorFeatures: string[] | null;
  FireplaceYN: boolean | null;
  ArchitecturalStyle: string[] | null;
  ApproximateAge: string | null;
  TaxAnnualAmount: number | null;
  TaxYear: number | null;
  AssociationFee: number | null;
  DirectionFaces: string | null;
  CrossStreet: string | null;
  Sewer: string[] | null;
  WaterSource: string[] | null;
  VirtualTourURLUnbranded: string | null;
  ListOfficeName: string | null;
  RoomsTotal: number | null;
  NumberOfKitchens: number | null;
}

export interface SyncResult {
  total: number;
  added: number;
  updated: number;
  skipped: number;
  errors: number;
  duration: number;
}

function slugifyStreet(name: string | null, suffix: string | null): string {
  const parts = [name, suffix].filter(Boolean).join(" ");
  return parts.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-milton";
}

function mapPropertyType(type: string | null, subType: string | null): string {
  const sub = (subType || "").toLowerCase();
  if (sub.includes("detach") && !sub.includes("semi")) return "detached";
  if (sub.includes("semi")) return "semi";
  if (sub.includes("town") || sub.includes("row")) return "townhouse";
  if (sub.includes("condo") || sub.includes("apart") || sub.includes("strata")) return "condo";
  const t = (type || "").toLowerCase();
  if (t.includes("condo")) return "condo";
  if (t.includes("residential")) return "detached";
  return "other";
}

function mapStatus(mlsStatus: string | null, txType: string | null): string {
  const s = (mlsStatus || "").toLowerCase();
  if (s.includes("sold")) return "sold";
  if (s.includes("lease") || (txType || "").toLowerCase().includes("lease")) return "rented";
  if (s.includes("expired") || s.includes("terminated") || s.includes("suspended")) return "expired";
  return "active";
}

const MEDIA_URL = "https://query.ampre.ca/odata/Media";

async function fetchPhotos(listingKey: string): Promise<string[]> {
  try {
    const filter = encodeURIComponent(`ResourceRecordKey eq '${listingKey}'`);
    const url = `${MEDIA_URL}?$filter=${filter}&$top=100&$orderby=Order%20asc&$select=MediaURL,Order,ImageSizeDescription`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TREB_TOKEN}`, Accept: "application/json" },
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!data.value) return [];

    // Get the largest version of each unique photo (deduplicate by Order)
    const byOrder = new Map<number, string>();
    for (const m of data.value) {
      const size = (m.ImageSizeDescription || "").toLowerCase();
      // Prefer "largest" or high-res versions
      if (!byOrder.has(m.Order) || size.includes("large") || size.includes("1920") || size.includes("3840")) {
        if (m.MediaURL) byOrder.set(m.Order, m.MediaURL);
      }
    }

    return Array.from(byOrder.values());
  } catch {
    return [];
  }
}

async function fetchPage(skip: number): Promise<{ items: AmpProperty[]; total: number }> {
  const filter = encodeURIComponent("City eq 'Milton'");
  const url = `${TREB_API_URL}?$select=${SELECT_FIELDS}&$filter=${filter}&$top=${PAGE_SIZE}&$skip=${skip}&$count=true&$orderby=OriginalEntryTimestamp%20desc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TREB_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`TREB API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    items: data.value || [],
    total: data["@odata.count"] ?? 0,
  };
}

export async function syncMiltonListings(): Promise<SyncResult> {
  const start = Date.now();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let totalFetched = 0;
  let totalAvailable = 0;

  // Paginate through all Milton listings
  let skip = 0;
  while (true) {
    const { items, total } = await fetchPage(skip);
    totalAvailable = total;

    if (items.length === 0) break;

    for (const item of items) {
      // Skip commercial properties
      if ((item.PropertyType || "").toLowerCase().includes("commercial")) {
        skipped++;
        continue;
      }

      // Skip if no listing key
      if (!item.ListingKey) {
        skipped++;
        continue;
      }

      try {
        const streetSlug = slugifyStreet(item.StreetName, item.StreetSuffix);
        const address = item.UnparsedAddress || [
          item.StreetNumber, item.StreetName, item.StreetSuffix,
          item.UnitNumber ? `Unit ${item.UnitNumber}` : null,
        ].filter(Boolean).join(" ");

        const listingData = {
          mlsNumber: item.ListingKey,
          address,
          streetSlug,
          neighbourhood: item.CityRegion || "Milton",
          city: "Milton",
          price: item.ListPrice || 0,
          bedrooms: item.BedroomsTotal || 0,
          bathrooms: item.BathroomsTotalInteger || 0,
          parking: item.ParkingTotal || 0,
          basement: Array.isArray(item.Basement) ? item.Basement.length > 0 : false,
          sqft: parseLivingAreaRange(item.LivingAreaRange),
          propertyType: mapPropertyType(item.PropertyType, item.PropertySubType),
          status: mapStatus(item.MlsStatus, item.TransactionType),
          description: item.PublicRemarks || null,
          latitude: item.Latitude || 0,
          longitude: item.Longitude || 0,
          photos: await fetchPhotos(item.ListingKey),
          transactionType: item.TransactionType || null,
          petsAllowed: Array.isArray(item.PetsAllowed) ? item.PetsAllowed.join(", ") : (item.PetsAllowed as unknown as string) || null,
          rentIncludes: Array.isArray(item.RentIncludes) ? item.RentIncludes : [],
          laundryFeatures: Array.isArray(item.LaundryFeatures) ? item.LaundryFeatures.join(", ") : null,
          cooling: Array.isArray(item.Cooling) ? item.Cooling.join(", ") : null,
          heatType: item.HeatType || null,
          furnished: item.Furnished || null,
          possessionDetails: item.PossessionDetails || null,
          minLeaseTerm: item.MinimumRentalTermMonths || null,
          locker: item.Locker || null,
          lotSize: item.LotSizeArea ? String(item.LotSizeArea) : null,
          lotDepth: item.LotDepth || null,
          lotWidth: item.LotWidth || null,
          garageType: item.GarageType || null,
          heatSource: item.HeatSource || null,
          roof: Array.isArray(item.Roof) ? item.Roof.join(", ") : null,
          foundation: Array.isArray(item.FoundationDetails) ? item.FoundationDetails.join(", ") : null,
          construction: Array.isArray(item.ConstructionMaterials) ? item.ConstructionMaterials.join(", ") : null,
          exteriorFeatures: Array.isArray(item.ExteriorFeatures) ? item.ExteriorFeatures : [],
          interiorFeatures: Array.isArray(item.InteriorFeatures) ? item.InteriorFeatures : [],
          fireplace: item.FireplaceYN || false,
          architecturalStyle: Array.isArray(item.ArchitecturalStyle) ? item.ArchitecturalStyle.join(", ") : null,
          approximateAge: item.ApproximateAge || null,
          taxAmount: item.TaxAnnualAmount || null,
          taxYear: item.TaxYear || null,
          maintenanceFeeAmt: item.AssociationFee || null,
          directionFaces: item.DirectionFaces || null,
          crossStreet: item.CrossStreet || null,
          sewer: Array.isArray(item.Sewer) ? item.Sewer.join(", ") : null,
          waterSource: Array.isArray(item.WaterSource) ? item.WaterSource.join(", ") : null,
          virtualTourUrl: item.VirtualTourURLUnbranded || null,
          listOfficeName: item.ListOfficeName || null,
          totalRooms: item.RoomsTotal || null,
          kitchens: item.NumberOfKitchens || null,
          listedAt: item.OriginalEntryTimestamp
            ? new Date(item.OriginalEntryTimestamp)
            : new Date(),
        };

        const existing = await prisma.listing.findUnique({
          where: { mlsNumber: item.ListingKey },
          select: { id: true },
        });

        if (existing) {
          await prisma.listing.update({
            where: { mlsNumber: item.ListingKey },
            data: listingData,
          });
          updated++;
        } else {
          await prisma.listing.create({ data: listingData });
          added++;
        }
      } catch (e) {
        errors++;
        console.error(`Error syncing ${item.ListingKey}:`, e instanceof Error ? e.message : e);
      }
    }

    totalFetched += items.length;
    skip += PAGE_SIZE;

    // Stop if we've fetched everything
    if (totalFetched >= totalAvailable || items.length < PAGE_SIZE) break;
  }

  return {
    total: totalAvailable,
    added,
    updated,
    skipped,
    errors,
    duration: Date.now() - start,
  };
}
