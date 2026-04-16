// Row types for DB2 (sold schema) and DB3 (analytics schema).
// Single source of truth — SQL column lists in raw queries must match these shapes.

// ────────────────────────────────────────
// DB2 — sold schema
// ────────────────────────────────────────

export interface SoldRecord {
  id: string;
  mls_number: string;
  address: string;
  street_name: string;
  street_slug: string;
  neighbourhood: string;
  city: string;
  list_price: string; // NUMERIC → string over the wire
  sold_price: string;
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
  mls_status: string; // current status — Sold, Active (post-flip), Expired, etc.
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

export interface StreetSoldStats {
  street_slug: string;
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
  last_updated: string;
}

export interface NeighbourhoodSoldStats {
  neighbourhood: string;
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
