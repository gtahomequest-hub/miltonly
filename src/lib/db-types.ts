// Row types for DB2 (sold schema) and DB3 (analytics schema).
// Single source of truth — SQL column lists in raw queries must match these shapes.

// ────────────────────────────────────────
// DB2 — sold schema
// ────────────────────────────────────────

/**
 * `'For Sale'` or `'For Lease'` — exact TREB TransactionType values.
 * CHECK-constrained at the database level (migration 002). Any other string
 * will be rejected on INSERT.
 */
export type TransactionType = "For Sale" | "For Lease";

/**
 * Closed TREB VOW transaction — both sales and leases live in this interface.
 *
 * **ALWAYS filter by `transaction_type` before aggregating price data.**
 * `sold_price` means final sale price in CAD for `'For Sale'` rows, and
 * monthly rent in CAD for `'For Lease'` rows. Averaging them together is
 * statistical nonsense ($1M sale prices vs $3K rents).
 *
 * Historical rows are retained forever — they're the DB4 prediction
 * training set. VOW 90-day display rule is enforced on the read path
 * (`/api/sold/route.ts`), not here.
 */
export interface SoldRecord {
  id: string;
  mls_number: string;
  address: string;
  street_name: string;
  street_slug: string;
  neighbourhood: string;
  city: string;
  /** For Sale: original list price (CAD). For Lease: asking monthly rent (CAD). */
  list_price: string; // NUMERIC → string over the wire
  /** For Sale: final sale price (CAD). For Lease: monthly rent (CAD). */
  sold_price: string;
  /** AMPRE CloseDate. Sale: close date. Lease: lease commencement date. */
  sold_date: string; // TIMESTAMPTZ → ISO string
  list_date: string;
  days_on_market: number;
  sold_to_ask_ratio: string;
  beds: number | null;
  baths: string | null;
  property_type: string; // detached|semi|townhouse|condo|other
  sqft_range: string | null;
  lat: string | null;
  lng: string | null;
  display_address: boolean;
  perm_advertise: boolean;
  /** TREB MlsStatus — 'Sold' for sale rows, 'Leased' for lease rows. */
  mls_status: string;
  /** RESO StandardStatus — typically 'Closed' for every row in this table. */
  standard_status: string | null;
  /** Exactly 'For Sale' or 'For Lease'. CHECK-constrained. */
  transaction_type: TransactionType | null;
  /** Listing Brokerage (TREB ListOfficeName). VOW 6.3(c) requires per-record display. */
  list_office_name: string | null;
  modification_timestamp: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryEvent {
  id: string;
  mls_number: string;
  event: string; // listed|price_change|sold|withdrawn
  price: string;
  event_date: string;
  days_from_listing: number;
  created_at: string;
}

// ────────────────────────────────────────
// DB3 — analytics schema
// ────────────────────────────────────────

export type MarketTemperature = "hot" | "warm" | "balanced" | "cool" | "cold";

/**
 * Per-street aggregates computed nightly from `sold.sold_records`.
 *
 * Sale columns (`avg_sold_price`, `median_sold_price`, `avg_list_price`,
 * `avg_dom`, `avg_sold_to_ask`, `sold_count_*`, `price_change_yoy`,
 * `peak_month`, `market_temperature`) aggregate only `transaction_type = 'For Sale'` rows.
 * Lease columns (`avg_leased_price*`, `leased_count_*`, `avg_lease_dom`)
 * aggregate only `transaction_type = 'For Lease'` rows. Two physically
 * separate compute functions maintain this split so no mixing can happen
 * on a refactor. Rents break down by bed count because they vary ~3x.
 */
export interface StreetSoldStats {
  street_slug: string;
  // Sale side
  avg_sold_price: string | null;
  median_sold_price: string | null;
  avg_list_price: string | null;
  avg_dom: string | null;
  avg_sold_to_ask: string | null;
  sold_count_90days: number;
  sold_count_12months: number;
  price_change_yoy: string | null;
  peak_month: number | null; // 1-12
  market_temperature: MarketTemperature | null;
  // Lease side (migration 002)
  avg_leased_price: string | null;
  avg_leased_price_1bed: string | null;
  avg_leased_price_2bed: string | null;
  avg_leased_price_3bed: string | null;
  avg_leased_price_4bed: string | null;
  leased_count_90days: number;
  leased_count_12months: number;
  avg_lease_dom: string | null;
  last_updated: string;
}

/**
 * Per-neighbourhood aggregates. Same sale/lease separation as
 * `StreetSoldStats`. Sale columns break down by property type (detached,
 * semi, townhouse, condo) because sale prices cluster there. Lease columns
 * break down by bed count because rents do.
 */
export interface NeighbourhoodSoldStats {
  neighbourhood: string;
  // Sale side
  avg_sold_detached: string | null;
  avg_sold_semi: string | null;
  avg_sold_town: string | null;
  avg_sold_condo: string | null;
  avg_dom: string | null;
  avg_sold_to_ask: string | null;
  sold_count_90days: number;
  sold_count_12months: number;
  price_change_yoy: string | null;
  market_score: string | null; // 0-100
  // Lease side (migration 002)
  avg_leased_price: string | null;
  avg_leased_price_1bed: string | null;
  avg_leased_price_2bed: string | null;
  avg_leased_price_3bed: string | null;
  avg_leased_price_4bed: string | null;
  leased_count_90days: number;
  leased_count_12months: number;
  avg_lease_dom: string | null;
  last_updated: string;
}

export interface ListingScores {
  mls_number: string;
  value_score: string | null;
  commute_score: string | null;
  school_score: string | null;
  mosque_score: string | null;
  investor_score: string | null;
  price_vs_street_pct: string | null;
  price_vs_neighbourhood_pct: string | null;
  estimated_rent: string | null;
  gross_yield: string | null;
  monthly_mortgage: string | null;
  monthly_net_cashflow: string | null;
  last_updated: string;
}

export interface StreetMonthlyStats {
  id: string;
  street_slug: string;
  year: number;
  month: number;
  avg_sold_price: string | null;
  sold_count: number;
  avg_dom: string | null;
  avg_sold_to_ask: string | null;
}

export interface NeighbourhoodMonthlyStats {
  id: string;
  neighbourhood: string;
  year: number;
  month: number;
  avg_sold_price: string | null;
  sold_count: number;
  avg_dom: string | null;
}

// ────────────────────────────────────────
// Aggregate teaser — safe for unauthenticated render
// ────────────────────────────────────────

export interface PublicAggregateTeaser {
  sold_count_90days: number;
  avg_dom: number | null;
  market_temperature: MarketTemperature | null;
  price_range_low: number | null;
  price_range_high: number | null;
}
