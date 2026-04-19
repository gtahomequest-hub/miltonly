// VOW sync core — pure-function mapping + SQL builders + AMPRE fetch helpers.
// Shared between:
//   - src/app/api/sync/sold/route.ts  (production, writes to Neon via soldDb)
//   - scripts/test-vow-sync-prospect.ts  (local verification, writes to prospect via pg)
//
// Single source of truth for the AMPRE → sold.sold_records column mapping.
// Do NOT duplicate mapping logic elsewhere; import from here.
//
// Probe basis: 2026-04-19 discovery against Milton Closed records (20 sample).
// See SELECT_FIELDS for the full list sent to AMPRE via $select. Every field
// populated ≥5% in the probe is requested. Ghost fields (no AMPRE source —
// year_built, appliances, flooring, fencing, internet_yn, video_link, etc.)
// exist as columns but are never written from here.

import { extractStreetName, streetNameToSlug } from "@/lib/streetUtils";

// =============================================================================
// Type: a minimal query-executor interface. Both @neondatabase/serverless's
// sql.query(text, values) form and pg.Client.query(text, values).rows fit this
// shape with thin adapters in the caller.
// =============================================================================

export type SqlExecutor = (
  text: string,
  values: unknown[]
) => Promise<Record<string, unknown>[]>;

// =============================================================================
// AMPRE $select list — every field populated ≥5% in the probe + fields the
// mapping references even if 0% (e.g., WaterExpense — 0% now, reserved for
// future AMPRE population).
// =============================================================================

export const SELECT_FIELDS: readonly string[] = [
  "ListingKey",
  // Address
  "UnparsedAddress",
  "StreetNumber", "StreetName", "StreetSuffix", "StreetDirPrefix", "StreetDirSuffix", "StreetSuffixCode",
  "UnitNumber", "ApartmentNumber",
  "City", "CityRegion", "Town", "CountyOrParish", "StateOrProvince", "Country", "PostalCode",
  "MLSAreaMunicipalityDistrict", "MLSAreaDistrictOldZone",
  "CrossStreet", "Directions", "DirectionFaces",
  "Latitude", "Longitude",
  // Pricing & lifecycle
  "ListPrice", "OriginalListPrice", "PreviousListPrice", "ClosePrice", "PercentListPrice",
  "PriceChangeTimestamp",
  "TransactionType", "MlsStatus", "StandardStatus", "PriorMlsStatus", "ContractStatus",
  "UnavailableDate", "ExpirationDate", "HoldoverDays", "ContactAfterExpiryYN",
  "ListingContractDate", "OriginalEntryTimestamp", "PurchaseContractDate",
  "SoldConditionalEntryTimestamp", "SoldEntryTimestamp",
  "PossessionDate", "PossessionType", "PossessionDetails",
  "CloseDate",
  "ModificationTimestamp", "SystemModificationTimestamp", "MajorChangeTimestamp",
  "MediaChangeTimestamp", "PhotosChangeTimestamp",
  // Property type
  "PropertyType", "PropertySubType", "ArchitecturalStyle", "StructureType",
  "BoardPropertyType", "SpecialDesignation", "LinkYN", "PictureYN",
  "NewConstructionYN", "ApproximateAge", "SquareFootSource",
  "LivingAreaRange",
  // Rooms & bath counts
  "BedroomsTotal", "BedroomsAboveGrade", "BedroomsBelowGrade",
  "BathroomsTotalInteger", "MainLevelBedrooms", "MainLevelBathrooms",
  "KitchensTotal", "KitchensAboveGrade", "KitchensBelowGrade",
  "RoomsTotal", "RoomsAboveGrade", "RoomsBelowGrade",
  "DenFamilyroomYN",
  "WashroomsType1", "WashroomsType1Pcs", "WashroomsType1Level",
  "WashroomsType2", "WashroomsType2Pcs", "WashroomsType2Level",
  "WashroomsType3", "WashroomsType3Pcs", "WashroomsType3Level",
  "WashroomsType4", "WashroomsType4Pcs", "WashroomsType4Level",
  // Interior
  "Basement", "Inclusions", "Exclusions", "RentalItems", "UnderContract",
  "InteriorFeatures", "LaundryFeatures", "LaundryLevel", "EnsuiteLaundryYN",
  "FireplaceYN", "FireplacesTotal", "FireplaceFeatures",
  "HeatType", "HeatTypeMulti", "HeatSource", "HeatSourceMulti",
  "Cooling", "CoolingYN", "HeatingYN",
  "CentralVacuumYN", "ElevatorYN", "HandicappedEquippedYN", "SeniorCommunityYN",
  "AccessibilityFeatures", "SecurityFeatures", "Winterized",
  "EnergyCertificate", "GreenPropertyInformationStatement",
  // Exterior / lot
  "ExteriorFeatures", "ConstructionMaterials", "FoundationDetails", "Roof",
  "LotWidth", "LotDepth", "LotSizeArea", "LotSizeAreaUnits", "LotSizeDimensions",
  "LotSizeRangeAcres", "LotSizeUnits", "LotSizeSource", "LotFeatures",
  "LotIrregularities", "LotShape", "LotDimensionsSource",
  "Topography", "PoolFeatures", "SpaYN", "View", "WaterfrontYN", "WaterfrontFeatures",
  "Waterfront", "OtherStructures", "PropertyFeatures",
  "Zoning", "ZoningDesignation", "ParcelNumber", "ParcelOfTiedLand", "RollNumber",
  // Parking
  "ParkingSpaces", "ParkingTotal", "CoveredSpaces", "GarageParkingSpaces", "GarageType", "GarageYN",
  "AttachedGarageYN", "ParkingFeatures", "ParkingMonthlyCost",
  "ParkingSpot1", "ParkingType1",
  // Utilities
  "Utilities",
  "ElectricYNA", "GasYNA", "SewerYNA", "WaterYNA", "CableYNA", "TelephoneYNA",
  "Water", "WaterSource", "WaterMeterYN", "WaterDeliveryFeature", "Sewage", "Sewer",
  "AccessToProperty", "AlternativePower", "DevelopmentChargesPaid", "LocalImprovements",
  "RoadAccessFee", "SeasonalDwelling", "UFFI",
  // Condo
  "CondoCorpNumber", "Locker", "LockerLevel", "LockerUnit", "Exposure",
  "PetsAllowed", "BalconyType", "LegalApartmentNumber", "LegalStories",
  "PropertyManagementCompany", "StatusCertificateYN",
  "AssociationAmenities", "AssociationFee", "AssociationFeeIncludes", "AssociationName",
  "AdditionalMonthlyFee",
  // Rental
  "LeaseTerm", "Furnished", "RentIncludes",
  // Tax & expenses
  "TaxAnnualAmount", "TaxYear", "TaxLegalDescription", "TaxAssessedValue", "AssessmentYear",
  "TaxBookNumber",
  "HeatingExpenses", "ElectricExpense", "WaterExpense", "InsuranceExpense",
  // Brokerage
  "ListOfficeName", "MainOfficeKey", "CoListOfficeName", "CoListOfficeName3", "CoListOfficePhone",
  "BuyerOfficeName", "CoBuyerOfficeName", "ListAOR",
  "OriginatingSystemID", "OriginatingSystemKey", "OriginatingSystemName",
  "SourceSystemID", "SourceSystemName",
  // Flags & compliance
  "InternetAddressDisplayYN", "InternetEntireListingDisplayYN",
  "PermissionToContactListingBrokerToAdvertise",
  "DDFYN", "VendorPropertyInfoStatement", "SignOnPropertyYN",
  "OccupantType", "ShowingRequirements", "ShowingAppointments",
  "TransactionBrokerCompensation",
  "AssignmentYN", "FractionalOwnershipYN", "IslandYN", "MortgageComment",
  // Remarks & media
  "PublicRemarks", "PublicRemarksExtras", "PrivateRemarks",
  "VirtualTourURLUnbranded", "VirtualTourURLBranded",
  "VirtualTourURLUnbranded2", "VirtualTourURLBranded2",
  "SalesBrochureUrl",
  // Misc
  "BusinessName", "BusinessType", "SurveyType",
];

// =============================================================================
// AMPRE record types — loose typing; AMPRE returns many fields nullable.
// =============================================================================

export type AmpRecord = Record<string, unknown>;

export interface AmpMediaItem {
  MediaKey: string;
  ResourceRecordKey?: string;
  MediaURL?: string | null;
  MediaCategory?: string | null;
  MediaType?: string | null;
  MediaStatus?: string | null;
  ShortDescription?: string | null;
  LongDescription?: string | null;
  ImageWidth?: number | null;
  ImageHeight?: number | null;
  Order?: number | null;
  PreferredPhotoYN?: boolean | null;
  Permission?: string[] | null;
  MediaObjectID?: string | null;
  ImageSizeDescription?: string | null;
  ImageOf?: string | null;
  ClassName?: string | null;
  ResourceName?: string | null;
  SourceSystemID?: string | null;
  SourceSystemName?: string | null;
  SourceSystemMediaKey?: string | null;
  ModificationTimestamp?: string | null;
  MediaModificationTimestamp?: string | null;
  [k: string]: unknown;
}

export interface AmpRoomItem {
  RoomKey?: string;
  ListingKey?: string;
  Order?: number | null;
  RoomType?: string | null;
  RoomLevel?: string | null;
  RoomLength?: number | null;
  RoomWidth?: number | null;
  RoomLengthWidthUnits?: string | null;
  RoomDimensions?: string | null;
  RoomFeatures?: string[] | null;
  RoomFeature1?: string | null;
  RoomFeature2?: string | null;
  RoomFeature3?: string | null;
  RoomDescription?: string | null;
  RoomArea?: number | null;
  RoomAreaUnits?: string | null;
  [k: string]: unknown;
}

// =============================================================================
// Helpers
// =============================================================================

const asArray = (v: unknown): unknown[] | null =>
  Array.isArray(v) && v.length > 0 ? v : null;

const joinArr = (v: unknown): string | null => {
  const a = asArray(v);
  return a ? a.map(String).join(", ") : null;
};

const strArr = (v: unknown): string[] | null => {
  const a = asArray(v);
  return a ? (a.map(String) as string[]) : null;
};

const toInt = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
};

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const boolOrNull = (v: unknown): boolean | null =>
  typeof v === "boolean" ? v : null;

const ynText = (v: unknown): string | null => {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return null;
};

const boolToText = (v: unknown): string | null => {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v || null;
  return null;
};

const emptyStrToNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
};

function computeDaysOnMarket(listDate: unknown, closeDate: unknown): number {
  if (!listDate || !closeDate) return 0;
  const l = new Date(String(listDate)).getTime();
  const c = new Date(String(closeDate)).getTime();
  if (!Number.isFinite(l) || !Number.isFinite(c) || c < l) return 0;
  return Math.round((c - l) / (1000 * 60 * 60 * 24));
}

function mapPropertyType(type: unknown, subType: unknown): string {
  const sub = String(subType ?? "").toLowerCase();
  if (sub.includes("detach") && !sub.includes("semi")) return "detached";
  if (sub.includes("semi")) return "semi";
  if (sub.includes("town") || sub.includes("row")) return "townhouse";
  if (sub.includes("condo") || sub.includes("apart") || sub.includes("strata")) return "condo";
  const t = String(type ?? "").toLowerCase();
  if (t.includes("condo")) return "condo";
  if (t.includes("residential")) return "detached";
  return "other";
}

// =============================================================================
// Column list — stable order used by both the INSERT column list and the
// VALUES list. Whenever the list grows, append to the end to keep diffs small.
// =============================================================================

export const SOLD_RECORD_COLUMNS: readonly string[] = [
  // Original 001-003 columns (minus id/created_at which use DEFAULTs)
  "mls_number", "address", "street_name", "street_slug", "neighbourhood", "city",
  "list_price", "sold_price", "sold_date", "list_date",
  "days_on_market", "sold_to_ask_ratio",
  "beds", "baths", "property_type", "sqft_range",
  "lat", "lng",
  "display_address", "perm_advertise",
  "mls_status", "standard_status", "transaction_type",
  "list_office_name",
  "modification_timestamp",

  // --- STEP 1.4 additions ---
  "original_list_price", "percent_list_price", "prior_mls_status",
  "sold_conditional_entry_timestamp", "sold_entry_timestamp",
  "contract_date", "possession_date", "possession_type",
  "close_price", "close_date", "expiry_date", "off_market_date",
  "status_change_timestamp", "media_change_timestamp",
  "tax_annual_amount", "tax_year", "tax_legal_description",
  "tax_assessed_value", "assessment_year", "roll_number",
  "association_fee", "association_fee_includes", "additional_monthly_fees",
  "heating_expenses", "hydro_expenses", "water_expenses", "insurance_expense",
  "approximate_age", "new_construction_yn",
  "architectural_style", "structure_type", "sub_type",
  "construction_materials", "foundation_details", "roof", "exterior",
  "kitchens_total", "rooms_total",
  "interior_features", "laundry_features",
  "fireplace_yn", "basement", "heat_type", "heat_source", "air_conditioning",
  "accessibility_features", "security_features",
  "lot_width", "lot_depth", "lot_size_units", "lot_features",
  "lot_irregularities", "lot_shape", "topography", "pool",
  "spa_yn", "view", "waterfront_yn", "waterfront_features", "other_structures",
  "parking_total", "parking_features", "garage_spaces", "garage_type",
  "covered_spaces", "parking_monthly_cost",
  "utilities", "electric", "gas", "water_source", "sewers",
  "condo_corp_number", "locker", "exposure",
  "pets_permitted", "balcony", "ensuite_laundry", "building_amenities",
  "lease_term", "furnished", "rent_includes",
  "unit_number", "street_number", "street_suffix", "street_direction",
  "postal_code", "cross_street", "directions", "zoning", "zoning_designation",
  "list_office_key", "permission_to_advertise",
  "public_remarks", "public_remarks_extras", "broker_remarks",
  "virtual_tour_url_unbranded", "virtual_tour_url_branded",

  // --- STEP 2.5 probe-discovered extras ---
  "bedrooms_above_grade", "bedrooms_below_grade",
  "kitchens_above_grade", "kitchens_below_grade",
  "rooms_above_grade", "rooms_below_grade",
  "den_familyroom_yn", "central_vacuum_yn", "elevator_yn", "attached_garage_yn",
  "handicapped_equipped_yn", "senior_community_yn", "winterized",
  "heat_type_multi", "heat_source_multi", "cooling_yn", "heating_yn",
  "fireplaces_total", "fireplace_features",
  "inclusions", "exclusions", "rental_items", "under_contract",
  "property_features", "special_designation", "hst_application", "survey_type",
  "direction_faces", "county_or_parish", "state_or_province", "country", "city_region",
  "street_dir_prefix", "street_dir_suffix", "street_suffix_code", "town",
  "parcel_number", "parcel_of_tied_land", "tax_book_number",
  "main_level_bedrooms", "main_level_bathrooms",
  "washrooms_type1", "washrooms_type1_pcs", "washrooms_type1_level",
  "washrooms_type2", "washrooms_type2_pcs", "washrooms_type2_level",
  "washrooms_type3", "washrooms_type3_pcs", "washrooms_type3_level",
  "washrooms_type4", "washrooms_type4_pcs", "washrooms_type4_level",
  "photos_change_timestamp", "major_change_timestamp",
  "original_entry_timestamp", "system_modification_timestamp", "price_change_timestamp",
  "previous_list_price", "unavailable_date",
  "purchase_contract_date", "listing_contract_date", "expiration_date",
  "holdover_days", "contact_after_expiry_yn",
  "vendor_property_info_statement", "sign_on_property_yn",
  "internet_address_display_yn", "internet_entire_listing_display_yn",
  "ddf_yn", "occupant_type", "contract_status", "possession_details",
  "showing_requirements", "showing_appointments", "transaction_broker_compensation",
  "association_amenities", "association_name", "balcony_type",
  "locker_level", "locker_unit", "legal_apartment_number", "legal_stories",
  "property_management_company", "status_certificate_yn",
  "pets_allowed", "parking_spot1", "parking_type1", "parking_spaces",
  "main_office_key", "co_list_office_name", "co_list_office_phone", "co_list_office_name3",
  "buyer_office_name", "co_buyer_office_name", "list_aor",
  "originating_system_id", "originating_system_key", "originating_system_name",
  "source_system_id", "source_system_name",
  "bathrooms_total_integer", "bedrooms_total",
  "property_type_raw", "property_sub_type", "living_area_range",
  "lot_size_area", "lot_size_area_units", "lot_size_dimensions",
  "lot_size_range_acres", "lot_size_source", "lot_dimensions_source",
  "laundry_features_array", "laundry_level",
  "mls_area_municipality_district", "mls_area_district_old_zone", "board_property_type",
  "link_yn", "picture_yn",
  "water", "water_source_array", "water_meter_yn", "water_delivery_feature", "sewage",
  "cable_yna", "telephone_yna", "sewer_yna", "water_yna",
  "access_to_property", "alternative_power", "development_charges_paid", "local_improvements",
  "road_access_fee", "seasonal_dwelling", "uffi",
  "energy_certificate", "green_property_information_statement", "sales_brochure_url",
  "waterfront", "square_foot_source",
  "assignment_yn", "fractional_ownership_yn", "island_yn", "garage_yn",
  "mortgage_comment", "business_name", "business_type",
  "virtual_tour_url_unbranded2", "virtual_tour_url_branded2",
  "raw_vow_data",
];

// Ghost columns: no AMPRE source. Kept in the schema per user's preference but
// never written from here. The mapping function does not return keys for these.
//   year_built, property_style, property_condition, appliances, flooring, fencing,
//   open_parking_spaces, water_supply_types, internet_yn, community_code, video_link,
//   approx_square_footage, list_agent_full_name, list_agent_key, co_list_agent_full_name

// =============================================================================
// AMPRE Property record → sold.sold_records column values.
// Returns a Record keyed exactly by SOLD_RECORD_COLUMNS. Caller must iterate
// SOLD_RECORD_COLUMNS in order to build the VALUES list.
// =============================================================================

export function mapAmpToSoldColumns(r: AmpRecord): Record<string, unknown> {
  const address =
    (r.UnparsedAddress as string | null) ||
    [r.StreetNumber, r.StreetName, r.StreetSuffix].filter(Boolean).join(" ");
  const streetName = extractStreetName(address);
  const streetSlug = streetNameToSlug(streetName);
  const listDate =
    (r.ListingContractDate as string | null) ??
    (r.OriginalEntryTimestamp as string | null) ??
    (r.CloseDate as string | null);
  const closeDate = r.CloseDate as string | null;
  const listPrice = toNum(r.ListPrice) ?? 0;
  const soldPrice = toNum(r.ClosePrice) ?? 0;
  const dom = computeDaysOnMarket(listDate, closeDate);
  const ratio = listPrice > 0 ? soldPrice / listPrice : 0;

  const streetDirection =
    [emptyStrToNull(r.StreetDirPrefix), emptyStrToNull(r.StreetDirSuffix)]
      .filter(Boolean)
      .join(" ") || null;

  return {
    // --- Original 001–003 fields ---
    mls_number: r.ListingKey as string,
    address,
    street_name: streetName,
    street_slug: streetSlug,
    neighbourhood: (r.CityRegion as string | null) || "Milton",
    city: (r.City as string | null) || "Milton",
    list_price: listPrice,
    sold_price: soldPrice,
    sold_date: closeDate,
    list_date: listDate,
    days_on_market: dom,
    sold_to_ask_ratio: ratio,
    beds: toInt(r.BedroomsTotal),
    baths: toNum(r.BathroomsTotalInteger),
    property_type: mapPropertyType(r.PropertyType, r.PropertySubType),
    sqft_range: r.LivingAreaRange as string | null,
    lat: toNum(r.Latitude),
    lng: toNum(r.Longitude),
    display_address: r.InternetAddressDisplayYN !== false,
    perm_advertise: r.InternetEntireListingDisplayYN !== false,
    mls_status: (r.MlsStatus as string | null) ?? "Unknown",
    standard_status: r.StandardStatus as string | null,
    transaction_type: r.TransactionType as string | null,
    list_office_name: r.ListOfficeName as string | null,
    modification_timestamp:
      (r.ModificationTimestamp as string | null) ?? new Date().toISOString(),

    // --- STEP 1.4 additions ---
    original_list_price: toNum(r.OriginalListPrice),
    percent_list_price: toNum(r.PercentListPrice),
    prior_mls_status: r.PriorMlsStatus as string | null,
    sold_conditional_entry_timestamp: r.SoldConditionalEntryTimestamp as string | null,
    sold_entry_timestamp: r.SoldEntryTimestamp as string | null,
    contract_date: r.PurchaseContractDate as string | null,        // corrected
    possession_date: r.PossessionDate as string | null,
    possession_type: r.PossessionType as string | null,
    close_price: toNum(r.ClosePrice),
    close_date: r.CloseDate as string | null,
    expiry_date: r.ExpirationDate as string | null,                // corrected
    off_market_date: r.UnavailableDate as string | null,           // corrected
    status_change_timestamp: r.MajorChangeTimestamp as string | null, // corrected
    media_change_timestamp: r.MediaChangeTimestamp as string | null,
    tax_annual_amount: toNum(r.TaxAnnualAmount),
    tax_year: toInt(r.TaxYear),
    tax_legal_description: r.TaxLegalDescription as string | null,
    tax_assessed_value: toNum(r.TaxAssessedValue),
    assessment_year: toInt(r.AssessmentYear),
    roll_number: r.RollNumber as string | null,
    association_fee: toNum(r.AssociationFee),
    association_fee_includes: joinArr(r.AssociationFeeIncludes),
    additional_monthly_fees: toNum(r.AdditionalMonthlyFee),        // corrected (singular)
    heating_expenses: toNum(r.HeatingExpenses),
    hydro_expenses: toNum(r.ElectricExpense),                      // corrected
    water_expenses: toNum(r.WaterExpense),                         // corrected (singular)
    insurance_expense: toNum(r.InsuranceExpense),
    approximate_age: r.ApproximateAge as string | null,
    new_construction_yn: boolOrNull(r.NewConstructionYN),
    architectural_style: joinArr(r.ArchitecturalStyle),
    structure_type: joinArr(r.StructureType),
    sub_type: r.PropertySubType as string | null,
    construction_materials: joinArr(r.ConstructionMaterials),
    foundation_details: joinArr(r.FoundationDetails),
    roof: joinArr(r.Roof),
    exterior: joinArr(r.ExteriorFeatures),                         // corrected
    kitchens_total: toInt(r.KitchensTotal),
    rooms_total: toInt(r.RoomsTotal),
    interior_features: joinArr(r.InteriorFeatures),
    laundry_features: joinArr(r.LaundryFeatures),
    fireplace_yn: boolOrNull(r.FireplaceYN),
    basement: joinArr(r.Basement),
    heat_type: r.HeatType as string | null,
    heat_source: r.HeatSource as string | null,
    air_conditioning: joinArr(r.Cooling),                          // corrected
    accessibility_features: joinArr(r.AccessibilityFeatures),
    security_features: joinArr(r.SecurityFeatures),
    lot_width: toNum(r.LotWidth),
    lot_depth: toNum(r.LotDepth),
    lot_size_units: r.LotSizeUnits as string | null,
    lot_features: joinArr(r.LotFeatures),
    lot_irregularities: r.LotIrregularities as string | null,
    lot_shape: r.LotShape as string | null,
    topography: joinArr(r.Topography),
    pool: joinArr(r.PoolFeatures),                                 // corrected
    spa_yn: boolOrNull(r.SpaYN),
    view: joinArr(r.View),
    waterfront_yn: boolOrNull(r.WaterfrontYN),
    waterfront_features: joinArr(r.WaterfrontFeatures),
    other_structures: joinArr(r.OtherStructures),
    parking_total: toInt(r.ParkingTotal),
    parking_features: joinArr(r.ParkingFeatures),
    garage_spaces: toInt(r.GarageParkingSpaces),
    garage_type: r.GarageType as string | null,
    covered_spaces: toInt(r.CoveredSpaces),
    parking_monthly_cost: toNum(r.ParkingMonthlyCost),
    utilities: joinArr(r.Utilities),
    electric: r.ElectricYNA as string | null,                      // corrected
    gas: r.GasYNA as string | null,                                // corrected
    water_source: joinArr(r.WaterSource),
    sewers: joinArr(r.Sewer),                                      // corrected
    condo_corp_number: r.CondoCorpNumber != null ? String(r.CondoCorpNumber) : null,
    locker: r.Locker as string | null,
    exposure: r.Exposure as string | null,
    pets_permitted: joinArr(r.PetsAllowed),                        // corrected
    balcony: r.BalconyType as string | null,                       // corrected
    ensuite_laundry: ynText(r.EnsuiteLaundryYN),                   // corrected (boolean→"Yes"/"No")
    building_amenities: joinArr(r.AssociationAmenities),           // corrected
    lease_term: r.LeaseTerm as string | null,
    furnished: r.Furnished as string | null,
    rent_includes: joinArr(r.RentIncludes),
    unit_number: r.UnitNumber as string | null,
    street_number: r.StreetNumber as string | null,
    street_suffix: r.StreetSuffix as string | null,
    street_direction: streetDirection,                             // corrected concat
    postal_code: r.PostalCode as string | null,
    cross_street: r.CrossStreet as string | null,
    directions: r.Directions as string | null,
    zoning: r.Zoning as string | null,
    zoning_designation: r.ZoningDesignation as string | null,
    list_office_key: r.MainOfficeKey as string | null,             // corrected
    permission_to_advertise: boolOrNull(r.PermissionToContactListingBrokerToAdvertise),
    public_remarks: r.PublicRemarks as string | null,
    public_remarks_extras: r.PublicRemarksExtras as string | null,
    broker_remarks: r.PrivateRemarks as string | null,
    virtual_tour_url_unbranded: r.VirtualTourURLUnbranded as string | null,
    virtual_tour_url_branded: r.VirtualTourURLBranded as string | null,

    // --- STEP 2.5 probe-discovered extras ---
    bedrooms_above_grade: toInt(r.BedroomsAboveGrade),
    bedrooms_below_grade: toInt(r.BedroomsBelowGrade),
    kitchens_above_grade: toInt(r.KitchensAboveGrade),
    kitchens_below_grade: toInt(r.KitchensBelowGrade),
    rooms_above_grade: toInt(r.RoomsAboveGrade),
    rooms_below_grade: toInt(r.RoomsBelowGrade),
    den_familyroom_yn: boolOrNull(r.DenFamilyroomYN),
    central_vacuum_yn: boolOrNull(r.CentralVacuumYN),
    elevator_yn: boolOrNull(r.ElevatorYN),
    attached_garage_yn: boolOrNull(r.AttachedGarageYN),
    handicapped_equipped_yn: boolOrNull(r.HandicappedEquippedYN),
    senior_community_yn: boolOrNull(r.SeniorCommunityYN),
    winterized: r.Winterized as string | null,
    heat_type_multi: strArr(r.HeatTypeMulti),
    heat_source_multi: strArr(r.HeatSourceMulti),
    cooling_yn: boolOrNull(r.CoolingYN),
    heating_yn: boolOrNull(r.HeatingYN),
    fireplaces_total: toInt(r.FireplacesTotal),
    fireplace_features: strArr(r.FireplaceFeatures),
    inclusions: r.Inclusions as string | null,
    exclusions: r.Exclusions as string | null,
    rental_items: r.RentalItems as string | null,
    under_contract: strArr(r.UnderContract),
    property_features: strArr(r.PropertyFeatures),
    special_designation: strArr(r.SpecialDesignation),
    hst_application: strArr(r.HSTApplication),
    survey_type: r.SurveyType as string | null,
    direction_faces: r.DirectionFaces as string | null,
    county_or_parish: r.CountyOrParish as string | null,
    state_or_province: r.StateOrProvince as string | null,
    country: r.Country as string | null,
    city_region: r.CityRegion as string | null,
    street_dir_prefix: r.StreetDirPrefix as string | null,
    street_dir_suffix: r.StreetDirSuffix as string | null,
    street_suffix_code: r.StreetSuffixCode as string | null,
    town: r.Town as string | null,
    parcel_number: r.ParcelNumber as string | null,
    parcel_of_tied_land: r.ParcelOfTiedLand as string | null,
    tax_book_number: r.TaxBookNumber as string | null,
    main_level_bedrooms: toInt(r.MainLevelBedrooms),
    main_level_bathrooms: toInt(r.MainLevelBathrooms),
    washrooms_type1: toInt(r.WashroomsType1),
    washrooms_type1_pcs: toInt(r.WashroomsType1Pcs),
    washrooms_type1_level: r.WashroomsType1Level as string | null,
    washrooms_type2: toInt(r.WashroomsType2),
    washrooms_type2_pcs: toInt(r.WashroomsType2Pcs),
    washrooms_type2_level: r.WashroomsType2Level as string | null,
    washrooms_type3: toInt(r.WashroomsType3),
    washrooms_type3_pcs: toInt(r.WashroomsType3Pcs),
    washrooms_type3_level: r.WashroomsType3Level as string | null,
    washrooms_type4: toInt(r.WashroomsType4),
    washrooms_type4_pcs: toInt(r.WashroomsType4Pcs),
    washrooms_type4_level: r.WashroomsType4Level as string | null,
    photos_change_timestamp: r.PhotosChangeTimestamp as string | null,
    major_change_timestamp: r.MajorChangeTimestamp as string | null,
    original_entry_timestamp: r.OriginalEntryTimestamp as string | null,
    system_modification_timestamp: r.SystemModificationTimestamp as string | null,
    price_change_timestamp: r.PriceChangeTimestamp as string | null,
    previous_list_price: toNum(r.PreviousListPrice),
    unavailable_date: r.UnavailableDate as string | null,
    purchase_contract_date: r.PurchaseContractDate as string | null,
    listing_contract_date: r.ListingContractDate as string | null,
    expiration_date: r.ExpirationDate as string | null,
    holdover_days: toInt(r.HoldoverDays),
    contact_after_expiry_yn: boolOrNull(r.ContactAfterExpiryYN),
    vendor_property_info_statement: boolOrNull(r.VendorPropertyInfoStatement),
    sign_on_property_yn: boolOrNull(r.SignOnPropertyYN),
    internet_address_display_yn: boolOrNull(r.InternetAddressDisplayYN),
    internet_entire_listing_display_yn: boolOrNull(r.InternetEntireListingDisplayYN),
    ddf_yn: boolOrNull(r.DDFYN),
    occupant_type: r.OccupantType as string | null,
    contract_status: r.ContractStatus as string | null,
    possession_details: r.PossessionDetails as string | null,
    showing_requirements: strArr(r.ShowingRequirements),
    showing_appointments: r.ShowingAppointments as string | null,
    transaction_broker_compensation: r.TransactionBrokerCompensation as string | null,
    association_amenities: strArr(r.AssociationAmenities),
    association_name: r.AssociationName as string | null,
    balcony_type: r.BalconyType as string | null,
    locker_level: r.LockerLevel as string | null,
    locker_unit: r.LockerUnit as string | null,
    legal_apartment_number: r.LegalApartmentNumber as string | null,
    legal_stories: r.LegalStories as string | null,
    property_management_company: r.PropertyManagementCompany as string | null,
    status_certificate_yn: boolOrNull(r.StatusCertificateYN),
    pets_allowed: strArr(r.PetsAllowed),
    parking_spot1: r.ParkingSpot1 as string | null,
    parking_type1: r.ParkingType1 as string | null,
    parking_spaces: toInt(r.ParkingSpaces),
    main_office_key: r.MainOfficeKey as string | null,
    co_list_office_name: r.CoListOfficeName as string | null,
    co_list_office_phone: r.CoListOfficePhone as string | null,
    co_list_office_name3: r.CoListOfficeName3 as string | null,
    buyer_office_name: r.BuyerOfficeName as string | null,
    co_buyer_office_name: r.CoBuyerOfficeName as string | null,
    list_aor: r.ListAOR as string | null,
    originating_system_id: r.OriginatingSystemID as string | null,
    originating_system_key: r.OriginatingSystemKey as string | null,
    originating_system_name: r.OriginatingSystemName as string | null,
    source_system_id: r.SourceSystemID as string | null,
    source_system_name: r.SourceSystemName as string | null,
    bathrooms_total_integer: toInt(r.BathroomsTotalInteger),
    bedrooms_total: toInt(r.BedroomsTotal),
    property_type_raw: r.PropertyType as string | null,
    property_sub_type: r.PropertySubType as string | null,
    living_area_range: r.LivingAreaRange as string | null,
    lot_size_area: toNum(r.LotSizeArea),
    lot_size_area_units: r.LotSizeAreaUnits as string | null,
    lot_size_dimensions: r.LotSizeDimensions as string | null,
    lot_size_range_acres: r.LotSizeRangeAcres as string | null,
    lot_size_source: r.LotSizeSource as string | null,
    lot_dimensions_source: r.LotDimensionsSource as string | null,
    laundry_features_array: strArr(r.LaundryFeatures),
    laundry_level: r.LaundryLevel as string | null,
    mls_area_municipality_district: r.MLSAreaMunicipalityDistrict as string | null,
    mls_area_district_old_zone: r.MLSAreaDistrictOldZone as string | null,
    board_property_type: r.BoardPropertyType as string | null,
    link_yn: boolOrNull(r.LinkYN),
    picture_yn: boolOrNull(r.PictureYN),
    water: r.Water as string | null,
    water_source_array: strArr(r.WaterSource),
    water_meter_yn: boolOrNull(r.WaterMeterYN),
    water_delivery_feature: strArr(r.WaterDeliveryFeature),
    sewage: strArr(r.Sewage),
    cable_yna: r.CableYNA as string | null,
    telephone_yna: r.TelephoneYNA as string | null,
    sewer_yna: r.SewerYNA as string | null,
    water_yna: r.WaterYNA as string | null,
    access_to_property: strArr(r.AccessToProperty),
    alternative_power: strArr(r.AlternativePower),
    development_charges_paid: strArr(r.DevelopmentChargesPaid),
    local_improvements: boolToText(r.LocalImprovements),
    road_access_fee: toNum(r.RoadAccessFee),
    seasonal_dwelling: boolOrNull(r.SeasonalDwelling),
    uffi: r.UFFI as string | null,
    energy_certificate: boolOrNull(r.EnergyCertificate),
    green_property_information_statement: boolToText(r.GreenPropertyInformationStatement),
    sales_brochure_url: r.SalesBrochureUrl as string | null,
    waterfront: strArr(r.Waterfront),
    square_foot_source: r.SquareFootSource as string | null,
    assignment_yn: boolOrNull(r.AssignmentYN),
    fractional_ownership_yn: boolOrNull(r.FractionalOwnershipYN),
    island_yn: boolOrNull(r.IslandYN),
    garage_yn: boolOrNull(r.GarageYN),
    mortgage_comment: r.MortgageComment as string | null,
    business_name: r.BusinessName as string | null,
    business_type: strArr(r.BusinessType),
    virtual_tour_url_unbranded2: r.VirtualTourURLUnbranded2 as string | null,
    virtual_tour_url_branded2: r.VirtualTourURLBranded2 as string | null,

    // Catch-all — stringify so pg gets a text value we can cast in SQL
    raw_vow_data: JSON.stringify(r),
  };
}

// =============================================================================
// SQL builders — dynamic parameter placeholders ($1, $2, ...) that both Neon
// serverless and node-postgres understand.
//
// Columns excluded from the UPDATE SET on conflict: mls_number (it IS the key),
// id (UUID primary key — preserve), created_at (preserve first-seen timestamp).
// updated_at is always set to NOW() in the SQL.
// =============================================================================

export function buildSoldRecordUpsertSql(): string {
  const cols = SOLD_RECORD_COLUMNS;
  const placeholders = cols
    .map((c, i) => (c === "raw_vow_data" ? `$${i + 1}::jsonb` : `$${i + 1}`))
    .join(", ");
  const updateCols = cols.filter((c) => c !== "mls_number");
  const updateSet = updateCols
    .map((c) => `${c} = EXCLUDED.${c}`)
    .concat(["updated_at = NOW()"])
    .join(",\n    ");

  return `
    INSERT INTO sold.sold_records (${cols.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (mls_number) DO UPDATE SET
      ${updateSet}
    RETURNING (xmax = 0) AS inserted
  `;
}

export function buildSoldRecordValues(
  mapped: Record<string, unknown>
): unknown[] {
  return SOLD_RECORD_COLUMNS.map((c) => mapped[c] ?? null);
}

// =============================================================================
// sold.media
// =============================================================================

export const MEDIA_COLUMNS: readonly string[] = [
  "id", "mls_number", "media_url", "media_category", "media_type",
  "short_description", "long_description",
  "image_width", "image_height", "order_index", "preferred_photo",
  "permission",
  "media_status", "media_object_id", "image_size_description", "image_of",
  "class_name", "resource_name",
  "source_system_id", "source_system_name", "source_system_media_key",
  "media_modification_timestamp", "modification_timestamp",
];

export function mapMediaToColumns(
  m: AmpMediaItem,
  mlsNumber: string
): Record<string, unknown> {
  return {
    id: m.MediaKey,
    mls_number: mlsNumber,
    media_url: m.MediaURL ?? null,
    media_category: m.MediaCategory ?? null,
    media_type: m.MediaType ?? null,
    short_description: m.ShortDescription ?? null,
    long_description: m.LongDescription ?? null,
    image_width: toInt(m.ImageWidth),
    image_height: toInt(m.ImageHeight),
    order_index: toInt(m.Order),
    preferred_photo: boolOrNull(m.PreferredPhotoYN) ?? false,
    permission: strArr(m.Permission),
    media_status: m.MediaStatus ?? null,
    media_object_id: m.MediaObjectID ?? null,
    image_size_description: m.ImageSizeDescription ?? null,
    image_of: m.ImageOf ?? null,
    class_name: m.ClassName ?? null,
    resource_name: m.ResourceName ?? null,
    source_system_id: m.SourceSystemID ?? null,
    source_system_name: m.SourceSystemName ?? null,
    source_system_media_key: m.SourceSystemMediaKey ?? null,
    media_modification_timestamp: m.MediaModificationTimestamp ?? null,
    modification_timestamp: m.ModificationTimestamp ?? null,
  };
}

export function buildMediaInsertSql(rowCount: number): string {
  if (rowCount === 0) throw new Error("buildMediaInsertSql: rowCount must be > 0");
  const cols = MEDIA_COLUMNS;
  const tuples: string[] = [];
  for (let r = 0; r < rowCount; r++) {
    const placeholders = cols.map((_, i) => `$${r * cols.length + i + 1}`).join(", ");
    tuples.push(`(${placeholders})`);
  }
  return `INSERT INTO sold.media (${cols.join(", ")}) VALUES ${tuples.join(", ")}`;
}

export function buildMediaValues(rows: AmpMediaItem[], mlsNumber: string): unknown[] {
  const out: unknown[] = [];
  for (const m of rows) {
    const mapped = mapMediaToColumns(m, mlsNumber);
    for (const c of MEDIA_COLUMNS) out.push(mapped[c] ?? null);
  }
  return out;
}

// =============================================================================
// sold.rooms
// =============================================================================

export const ROOM_COLUMNS: readonly string[] = [
  "mls_number", "room_key", "order_index",
  "room_type", "room_level",
  "room_length", "room_width", "length_width_units", "room_dimensions",
  "room_features_array", "room_feature1", "room_feature2", "room_feature3",
  "room_description", "room_area", "room_area_units",
];

export function mapRoomToColumns(
  room: AmpRoomItem,
  mlsNumber: string
): Record<string, unknown> {
  return {
    mls_number: mlsNumber,
    room_key: room.RoomKey ?? null,
    order_index: toInt(room.Order),
    room_type: room.RoomType ?? null,
    room_level: room.RoomLevel ?? null,
    room_length: toNum(room.RoomLength),
    room_width: toNum(room.RoomWidth),
    length_width_units: room.RoomLengthWidthUnits ?? null,
    room_dimensions: room.RoomDimensions ?? null,
    room_features_array: strArr(room.RoomFeatures),
    room_feature1: room.RoomFeature1 ?? null,
    room_feature2: room.RoomFeature2 ?? null,
    room_feature3: room.RoomFeature3 ?? null,
    room_description: room.RoomDescription ?? null,
    room_area: toNum(room.RoomArea),
    room_area_units: room.RoomAreaUnits ?? null,
  };
}

export function buildRoomsInsertSql(rowCount: number): string {
  if (rowCount === 0) throw new Error("buildRoomsInsertSql: rowCount must be > 0");
  const cols = ROOM_COLUMNS;
  const tuples: string[] = [];
  for (let r = 0; r < rowCount; r++) {
    const placeholders = cols.map((_, i) => `$${r * cols.length + i + 1}`).join(", ");
    tuples.push(`(${placeholders})`);
  }
  return `INSERT INTO sold.rooms (${cols.join(", ")}) VALUES ${tuples.join(", ")}`;
}

export function buildRoomsValues(rooms: AmpRoomItem[], mlsNumber: string): unknown[] {
  const out: unknown[] = [];
  for (const room of rooms) {
    const mapped = mapRoomToColumns(room, mlsNumber);
    for (const c of ROOM_COLUMNS) out.push(mapped[c] ?? null);
  }
  return out;
}

// =============================================================================
// AMPRE fetch helpers — generic, caller provides base URL + token.
// =============================================================================

export interface AmpConfig {
  propertyUrl: string; // e.g. https://query.ampre.ca/odata/Property
  token: string;
  pageSize?: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function ampGet<T = unknown>(url: string, token: string): Promise<T> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status === 503) {
      attempt++;
      if (attempt > 5) throw new Error(`AMPRE backoff exhausted: ${res.status}`);
      await sleep(Math.min(30_000, 1000 * 2 ** attempt));
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(
      `AMPRE error: ${res.status} ${res.statusText} — body=${body.slice(0, 500)} — url=${url}`
    );
  }
}

export async function fetchPropertyPage(
  config: AmpConfig,
  filter: string,
  orderby: string
): Promise<AmpRecord[]> {
  const pageSize = config.pageSize ?? 500;
  const select = SELECT_FIELDS.join(",");
  const url =
    `${config.propertyUrl}?$select=${select}` +
    `&$filter=${encodeURIComponent(filter)}` +
    `&$top=${pageSize}&$orderby=${encodeURIComponent(orderby)}`;
  const data = await ampGet<{ value?: AmpRecord[] }>(url, config.token);
  return data.value ?? [];
}

function mediaEndpoint(propertyUrl: string): string {
  return propertyUrl.replace(/\/Property$/, "/Media");
}
function roomsEndpoint(propertyUrl: string): string {
  return propertyUrl.replace(/\/Property$/, "/PropertyRooms");
}

/**
 * Fetch media for a batch of listing keys via OR-chain. 20 per batch is safe
 * under AMPRE's Elasticsearch max_clause_count (see backfill-list-office-name.mjs
 * for the empirical ceiling). Status filter drops replaced/deleted photos.
 */
export async function fetchMediaBatch(
  config: AmpConfig,
  listingKeys: string[]
): Promise<Map<string, AmpMediaItem[]>> {
  if (listingKeys.length === 0) return new Map();
  const keyFilter = listingKeys
    .map((k) => `ResourceRecordKey eq '${k.replace(/'/g, "''")}'`)
    .join(" or ");
  const filter = `(${keyFilter}) and MediaStatus eq 'Active'`;
  const url =
    `${mediaEndpoint(config.propertyUrl)}` +
    `?$filter=${encodeURIComponent(filter)}` +
    `&$top=1000&$orderby=${encodeURIComponent("ResourceRecordKey,Order")}`;
  const data = await ampGet<{ value?: AmpMediaItem[] }>(url, config.token);
  const out = new Map<string, AmpMediaItem[]>();
  for (const item of data.value ?? []) {
    const k = item.ResourceRecordKey as string | undefined;
    if (!k) continue;
    const arr = out.get(k) ?? [];
    arr.push(item);
    out.set(k, arr);
  }
  return out;
}

// =============================================================================
// runSoldSync — full sync loop (DB-agnostic via SqlExecutor).
// Used by the production route and, indirectly, by the local test script.
// =============================================================================

const SIBLING_BATCH = 20;

export interface SoldSyncResult {
  ok: true;
  mode: "backfill" | "incremental";
  pagesFetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  mediaWritten: number;
  roomsWritten: number;
  durationMs: number;
}

export async function runSoldSync(opts: {
  db: SqlExecutor;
  amp: AmpConfig;
  limit: number;
}): Promise<SoldSyncResult> {
  const { db, amp, limit } = opts;
  const started = Date.now();

  const stateRows = await db(
    `SELECT
       (SELECT COUNT(*) FROM sold.sold_records)::int AS total,
       (SELECT MAX(modification_timestamp) FROM sold.sold_records) AS max_mod`,
    []
  );
  const total = (stateRows[0]?.total as number) ?? 0;
  // node-postgres + @neondatabase/serverless's sql.query() both return
  // TIMESTAMPTZ as a Date object. AMPRE needs ISO 8601 in the $filter
  // string — without .toISOString(), Date.toString() produces
  // "Fri Apr 17 2026 18:21:23 GMT+0000 (…)" and AMPRE rejects it with 400
  // ("property 'Fri' is not defined"). Coerce eagerly so every downstream
  // interpolation sees a safe ISO string.
  const maxModRaw = stateRows[0]?.max_mod;
  const maxMod: string | null =
    maxModRaw instanceof Date
      ? maxModRaw.toISOString()
      : (maxModRaw as string | null) ?? null;
  const isBackfill = total === 0;

  let cursorPrimary: string | null = isBackfill ? null : maxMod;
  let cursorKey = "";
  let hasKeyCursor = false;

  const BASE_FILTER = `City eq 'Milton' and StandardStatus eq 'Closed'`;
  const upsertSql = buildSoldRecordUpsertSql();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let mediaWritten = 0;
  let roomsWritten = 0;
  let pagesFetched = 0;
  let totalProcessed = 0;

  pageLoop: while (true) {
    let filter: string;
    if (!hasKeyCursor) {
      filter = cursorPrimary
        ? `${BASE_FILTER} and ModificationTimestamp gt ${cursorPrimary}`
        : BASE_FILTER;
    } else {
      filter =
        `${BASE_FILTER} ` +
        `and (ModificationTimestamp gt ${cursorPrimary} ` +
        `or (ModificationTimestamp eq ${cursorPrimary} and ListingKey gt '${cursorKey}'))`;
    }
    const orderby = "ModificationTimestamp asc,ListingKey asc";

    const items = await fetchPropertyPage(amp, filter, orderby);
    pagesFetched++;
    if (items.length === 0) break;

    const writtenKeys: string[] = [];

    for (const item of items) {
      if (totalProcessed >= limit) break pageLoop;

      const listingKey = item.ListingKey as string | undefined;
      if (!listingKey) { skipped++; continue; }
      if (String(item.City ?? "").toLowerCase() === "deleted") { skipped++; continue; }
      if (String(item.StreetName ?? "").toLowerCase() === "deleted") { skipped++; continue; }

      const txn = item.TransactionType as string | undefined;
      if (txn !== "For Sale" && txn !== "For Lease") { skipped++; continue; }

      const listPrice = Number(item.ListPrice ?? 0);
      const soldPrice = Number(item.ClosePrice ?? 0);
      const closeDate = item.CloseDate as string | null;
      const listDate =
        (item.ListingContractDate as string | null) ??
        (item.OriginalEntryTimestamp as string | null) ??
        closeDate;
      if (!closeDate || !listDate || soldPrice <= 0 || listPrice <= 0) {
        skipped++;
        continue;
      }

      const mapped = mapAmpToSoldColumns(item);
      const values = buildSoldRecordValues(mapped);

      try {
        const res = await db(upsertSql, values);
        if (res[0]?.inserted) inserted++;
        else updated++;
        writtenKeys.push(listingKey);
        totalProcessed++;
      } catch (err) {
        skipped++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[sync/sold] upsert failed for ${listingKey}: ${msg}`);
        continue;
      }

      cursorKey = listingKey;
      hasKeyCursor = true;
      if (item.ModificationTimestamp) {
        cursorPrimary = item.ModificationTimestamp as string;
      }
    }

    for (let i = 0; i < writtenKeys.length; i += SIBLING_BATCH) {
      const batch = writtenKeys.slice(i, i + SIBLING_BATCH);

      const [mediaMap, roomsMap] = await Promise.all([
        fetchMediaBatch(amp, batch).catch((e) => {
          console.error(`[sync/sold] media batch failed: ${String(e)}`);
          return new Map<string, AmpMediaItem[]>();
        }),
        fetchRoomsBatch(amp, batch).catch((e) => {
          console.error(`[sync/sold] rooms batch failed: ${String(e)}`);
          return new Map<string, AmpRoomItem[]>();
        }),
      ]);

      for (const key of batch) {
        const mediaItems = mediaMap.get(key) ?? [];
        try {
          await db(`DELETE FROM sold.media WHERE mls_number = $1`, [key]);
          if (mediaItems.length > 0) {
            const sql = buildMediaInsertSql(mediaItems.length);
            const vals = buildMediaValues(mediaItems, key);
            await db(sql, vals);
            mediaWritten += mediaItems.length;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[sync/sold] media write failed for ${key}: ${msg}`);
        }

        const roomItems = roomsMap.get(key) ?? [];
        try {
          await db(`DELETE FROM sold.rooms WHERE mls_number = $1`, [key]);
          if (roomItems.length > 0) {
            const sql = buildRoomsInsertSql(roomItems.length);
            const vals = buildRoomsValues(roomItems, key);
            await db(sql, vals);
            roomsWritten += roomItems.length;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[sync/sold] rooms write failed for ${key}: ${msg}`);
        }
      }
    }

    if (items.length < 500) break;
    if (pagesFetched > 400) break;
  }

  const durationMs = Date.now() - started;
  console.log(
    `[sync/sold] mode=${isBackfill ? "backfill" : "incremental"} ` +
      `pages=${pagesFetched} inserted=${inserted} updated=${updated} ` +
      `skipped=${skipped} media=${mediaWritten} rooms=${roomsWritten} ` +
      `duration=${durationMs}ms`
  );

  return {
    ok: true,
    mode: isBackfill ? "backfill" : "incremental",
    pagesFetched,
    inserted,
    updated,
    skipped,
    mediaWritten,
    roomsWritten,
    durationMs,
  };
}

/**
 * Fetch Property records for a batch of ListingKeys via OR-chain. Used by
 * backfill scripts that need to re-enrich known records without cursor paging.
 * Uses $select so payload size matches the cron path.
 */
export async function fetchPropertyBatchByKeys(
  config: AmpConfig,
  listingKeys: string[]
): Promise<AmpRecord[]> {
  if (listingKeys.length === 0) return [];
  const keyFilter = listingKeys
    .map((k) => `ListingKey eq '${k.replace(/'/g, "''")}'`)
    .join(" or ");
  const select = SELECT_FIELDS.join(",");
  const url =
    `${config.propertyUrl}?$select=${select}` +
    `&$filter=${encodeURIComponent(keyFilter)}` +
    `&$top=${listingKeys.length}`;
  const data = await ampGet<{ value?: AmpRecord[] }>(url, config.token);
  return data.value ?? [];
}

export async function fetchRoomsBatch(
  config: AmpConfig,
  listingKeys: string[]
): Promise<Map<string, AmpRoomItem[]>> {
  if (listingKeys.length === 0) return new Map();
  const keyFilter = listingKeys
    .map((k) => `ListingKey eq '${k.replace(/'/g, "''")}'`)
    .join(" or ");
  const filter = `(${keyFilter}) and RoomStatus eq 'Active'`;
  const url =
    `${roomsEndpoint(config.propertyUrl)}` +
    `?$filter=${encodeURIComponent(filter)}` +
    `&$top=1000&$orderby=${encodeURIComponent("ListingKey,Order")}`;
  const data = await ampGet<{ value?: AmpRoomItem[] }>(url, config.token);
  const out = new Map<string, AmpRoomItem[]>();
  for (const room of data.value ?? []) {
    const k = room.ListingKey as string | undefined;
    if (!k) continue;
    const arr = out.get(k) ?? [];
    arr.push(room);
    out.set(k, arr);
  }
  return out;
}
