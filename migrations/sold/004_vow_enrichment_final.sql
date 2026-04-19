-- Phase 2.5 migration 004: VOW enrichment — full field set from AMPRE probe
-- (2026-04-19). Adds ~130 columns to sold.sold_records, creates sold.media and
-- sold.rooms with correct FK to sold_records.mls_number, adds raw_vow_data jsonb
-- catch-all + GIN index.
--
-- IDEMPOTENT: safe to re-run. Handles two states:
--   (a) virgin — sold.media / sold.rooms don't exist → CREATE TABLE path
--   (b) partial — earlier enrichment plan was partly applied → ALTER path
--       (drops wrong FK, renames listing_key → mls_number, adds missing cols)
--
-- Baseline verified against local prospect 2026-04-19:
--   sold.sold_records exists (28 cols, 7001 rows)
--   sold.media does NOT exist
--   sold.rooms does NOT exist
--
-- So the CREATE TABLE path is the one that actually runs here. The DO $$ blocks
-- handle idempotent re-runs and the partial case.

BEGIN;

-- =============================================================================
-- STEP 1.0 — sold.media (FK reference is mls_number, not id)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sold.media (
  id                             text PRIMARY KEY,
  mls_number                     text NOT NULL,
  media_url                      text NOT NULL,
  media_category                 text,
  media_type                     text,
  short_description              text,
  image_width                    integer,
  image_height                   integer,
  order_index                    integer,
  preferred_photo                boolean DEFAULT false,
  modification_timestamp         timestamptz,
  created_at                     timestamptz DEFAULT NOW(),
  -- STEP 1.3 extras (probe-discovered fields)
  media_status                   text,
  permission                     text[],
  long_description               text,
  media_object_id                text,
  image_size_description         text,
  image_of                       text,
  class_name                     text,
  resource_name                  text,
  source_system_id               text,
  source_system_name             text,
  source_system_media_key        text,
  media_modification_timestamp   timestamptz
);

-- Idempotency: if an older schema with `listing_key` sneaks in, rename it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='sold' AND table_name='media' AND column_name='listing_key'
  ) THEN
    ALTER TABLE sold.media RENAME COLUMN listing_key TO mls_number;
  END IF;
END $$;

-- Ensure every extended column exists (no-op if table was just created above).
ALTER TABLE sold.media
  ADD COLUMN IF NOT EXISTS media_status                 text,
  ADD COLUMN IF NOT EXISTS permission                   text[],
  ADD COLUMN IF NOT EXISTS long_description             text,
  ADD COLUMN IF NOT EXISTS media_object_id              text,
  ADD COLUMN IF NOT EXISTS image_size_description       text,
  ADD COLUMN IF NOT EXISTS image_of                     text,
  ADD COLUMN IF NOT EXISTS class_name                   text,
  ADD COLUMN IF NOT EXISTS resource_name                text,
  ADD COLUMN IF NOT EXISTS source_system_id             text,
  ADD COLUMN IF NOT EXISTS source_system_name           text,
  ADD COLUMN IF NOT EXISTS source_system_media_key      text,
  ADD COLUMN IF NOT EXISTS media_modification_timestamp timestamptz;

-- FK: drop any stale variant, install the correct one.
ALTER TABLE sold.media DROP CONSTRAINT IF EXISTS media_listing_key_fkey;
ALTER TABLE sold.media DROP CONSTRAINT IF EXISTS media_mls_number_fkey;
ALTER TABLE sold.media
  ADD CONSTRAINT media_mls_number_fkey
  FOREIGN KEY (mls_number)
  REFERENCES sold.sold_records(mls_number)
  ON DELETE CASCADE;

DROP INDEX IF EXISTS sold.idx_sold_media_listing;
CREATE INDEX IF NOT EXISTS idx_sold_media_mls ON sold.media(mls_number);

-- =============================================================================
-- STEP 1.0 — sold.rooms (single metric pair + units, per probe)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sold.rooms (
  id                    serial PRIMARY KEY,
  mls_number            text NOT NULL,
  room_type             text,
  room_level            text,
  order_index           integer,
  -- STEP 1.2 corrected dimensions
  room_length           numeric,
  room_width            numeric,
  length_width_units    text,
  room_dimensions       text,
  -- room features: both legacy scalar and AMPRE array form
  room_features_array   text[],
  room_feature1         text,
  room_feature2         text,
  room_feature3         text,
  room_description      text,
  room_key              text,
  room_area             numeric,
  room_area_units       text,
  -- parity with probe fields not yet used but available
  features              text
);

-- Idempotency: rename listing_key → mls_number if a partial version exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='sold' AND table_name='rooms' AND column_name='listing_key'
  ) THEN
    ALTER TABLE sold.rooms RENAME COLUMN listing_key TO mls_number;
  END IF;
END $$;

-- Drop the 4-column metric/imperial split if an old version is present.
ALTER TABLE sold.rooms DROP COLUMN IF EXISTS length_metric;
ALTER TABLE sold.rooms DROP COLUMN IF EXISTS width_metric;
ALTER TABLE sold.rooms DROP COLUMN IF EXISTS length_imperial;
ALTER TABLE sold.rooms DROP COLUMN IF EXISTS width_imperial;

-- Ensure every final column is present.
ALTER TABLE sold.rooms
  ADD COLUMN IF NOT EXISTS room_length          numeric,
  ADD COLUMN IF NOT EXISTS room_width           numeric,
  ADD COLUMN IF NOT EXISTS length_width_units   text,
  ADD COLUMN IF NOT EXISTS room_dimensions      text,
  ADD COLUMN IF NOT EXISTS room_features_array  text[],
  ADD COLUMN IF NOT EXISTS room_feature1        text,
  ADD COLUMN IF NOT EXISTS room_feature2        text,
  ADD COLUMN IF NOT EXISTS room_feature3        text,
  ADD COLUMN IF NOT EXISTS room_description     text,
  ADD COLUMN IF NOT EXISTS room_key             text,
  ADD COLUMN IF NOT EXISTS room_area            numeric,
  ADD COLUMN IF NOT EXISTS room_area_units      text;

ALTER TABLE sold.rooms DROP CONSTRAINT IF EXISTS rooms_listing_key_fkey;
ALTER TABLE sold.rooms DROP CONSTRAINT IF EXISTS rooms_mls_number_fkey;
ALTER TABLE sold.rooms
  ADD CONSTRAINT rooms_mls_number_fkey
  FOREIGN KEY (mls_number)
  REFERENCES sold.sold_records(mls_number)
  ON DELETE CASCADE;

DROP INDEX IF EXISTS sold.idx_sold_rooms_listing;
CREATE INDEX IF NOT EXISTS idx_sold_rooms_mls ON sold.rooms(mls_number);

-- =============================================================================
-- STEP 1.4 — sold.sold_records enrichment
-- Adds every new probe-confirmed column plus the "ghost" columns from the
-- original enrichment plan (kept nullable for safety; sync never writes them).
-- Also: raw_vow_data jsonb as the full-response catch-all.
-- =============================================================================

ALTER TABLE sold.sold_records
  -- --- Pricing & lifecycle ---
  ADD COLUMN IF NOT EXISTS original_list_price               numeric,
  ADD COLUMN IF NOT EXISTS percent_list_price                numeric,
  ADD COLUMN IF NOT EXISTS prior_mls_status                  text,
  ADD COLUMN IF NOT EXISTS sold_conditional_entry_timestamp  timestamptz,
  ADD COLUMN IF NOT EXISTS sold_entry_timestamp              timestamptz,
  ADD COLUMN IF NOT EXISTS contract_date                     timestamptz,
  ADD COLUMN IF NOT EXISTS possession_date                   date,
  ADD COLUMN IF NOT EXISTS possession_type                   text,
  ADD COLUMN IF NOT EXISTS close_price                       numeric,
  ADD COLUMN IF NOT EXISTS close_date                        timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_date                       date,
  ADD COLUMN IF NOT EXISTS off_market_date                   date,
  ADD COLUMN IF NOT EXISTS status_change_timestamp           timestamptz,
  ADD COLUMN IF NOT EXISTS media_change_timestamp            timestamptz,

  -- --- Tax & financial ---
  ADD COLUMN IF NOT EXISTS tax_annual_amount                 numeric,
  ADD COLUMN IF NOT EXISTS tax_year                          integer,
  ADD COLUMN IF NOT EXISTS tax_legal_description             text,
  ADD COLUMN IF NOT EXISTS tax_assessed_value                numeric,
  ADD COLUMN IF NOT EXISTS assessment_year                   integer,
  ADD COLUMN IF NOT EXISTS roll_number                       text,
  ADD COLUMN IF NOT EXISTS association_fee                   numeric,
  ADD COLUMN IF NOT EXISTS association_fee_includes          text,
  ADD COLUMN IF NOT EXISTS additional_monthly_fees           numeric,
  ADD COLUMN IF NOT EXISTS heating_expenses                  numeric,
  ADD COLUMN IF NOT EXISTS hydro_expenses                    numeric,
  ADD COLUMN IF NOT EXISTS water_expenses                    numeric,
  ADD COLUMN IF NOT EXISTS insurance_expense                 numeric,

  -- --- Property physical ---
  ADD COLUMN IF NOT EXISTS year_built                        integer,
  ADD COLUMN IF NOT EXISTS approximate_age                   text,
  ADD COLUMN IF NOT EXISTS new_construction_yn               boolean,
  ADD COLUMN IF NOT EXISTS architectural_style               text,
  ADD COLUMN IF NOT EXISTS property_style                    text,
  ADD COLUMN IF NOT EXISTS structure_type                    text,
  ADD COLUMN IF NOT EXISTS sub_type                          text,
  ADD COLUMN IF NOT EXISTS property_condition                text,
  ADD COLUMN IF NOT EXISTS construction_materials            text,
  ADD COLUMN IF NOT EXISTS foundation_details                text,
  ADD COLUMN IF NOT EXISTS roof                              text,
  ADD COLUMN IF NOT EXISTS exterior                          text,
  ADD COLUMN IF NOT EXISTS kitchens_total                    integer,
  ADD COLUMN IF NOT EXISTS rooms_total                       integer,
  ADD COLUMN IF NOT EXISTS approx_square_footage             text,

  -- --- Interior features ---
  ADD COLUMN IF NOT EXISTS interior_features                 text,
  ADD COLUMN IF NOT EXISTS appliances                        text,
  ADD COLUMN IF NOT EXISTS flooring                          text,
  ADD COLUMN IF NOT EXISTS laundry_features                  text,
  ADD COLUMN IF NOT EXISTS fireplace_yn                      boolean,
  ADD COLUMN IF NOT EXISTS basement                          text,
  ADD COLUMN IF NOT EXISTS heat_type                         text,
  ADD COLUMN IF NOT EXISTS heat_source                       text,
  ADD COLUMN IF NOT EXISTS air_conditioning                  text,
  ADD COLUMN IF NOT EXISTS accessibility_features            text,
  ADD COLUMN IF NOT EXISTS security_features                 text,

  -- --- Lot & exterior ---
  ADD COLUMN IF NOT EXISTS lot_width                         numeric,
  ADD COLUMN IF NOT EXISTS lot_depth                         numeric,
  ADD COLUMN IF NOT EXISTS lot_size_units                    text,
  ADD COLUMN IF NOT EXISTS lot_features                      text,
  ADD COLUMN IF NOT EXISTS lot_irregularities                text,
  ADD COLUMN IF NOT EXISTS lot_shape                         text,
  ADD COLUMN IF NOT EXISTS fencing                           text,
  ADD COLUMN IF NOT EXISTS topography                        text,
  ADD COLUMN IF NOT EXISTS pool                              text,
  ADD COLUMN IF NOT EXISTS spa_yn                            boolean,
  ADD COLUMN IF NOT EXISTS view                              text,
  ADD COLUMN IF NOT EXISTS waterfront_yn                     boolean,
  ADD COLUMN IF NOT EXISTS waterfront_features               text,
  ADD COLUMN IF NOT EXISTS other_structures                  text,

  -- --- Parking ---
  ADD COLUMN IF NOT EXISTS parking_total                     integer,
  ADD COLUMN IF NOT EXISTS parking_features                  text,
  ADD COLUMN IF NOT EXISTS garage_spaces                     integer,
  ADD COLUMN IF NOT EXISTS garage_type                       text,
  ADD COLUMN IF NOT EXISTS covered_spaces                    integer,
  ADD COLUMN IF NOT EXISTS open_parking_spaces               integer,
  ADD COLUMN IF NOT EXISTS parking_monthly_cost              numeric,

  -- --- Utilities ---
  ADD COLUMN IF NOT EXISTS utilities                         text,
  ADD COLUMN IF NOT EXISTS electric                          text,
  ADD COLUMN IF NOT EXISTS gas                               text,
  ADD COLUMN IF NOT EXISTS water_source                      text,
  ADD COLUMN IF NOT EXISTS water_supply_types                text,
  ADD COLUMN IF NOT EXISTS sewers                            text,
  ADD COLUMN IF NOT EXISTS internet_yn                       boolean,

  -- --- Condo-specific ---
  ADD COLUMN IF NOT EXISTS condo_corp_number                 text,
  ADD COLUMN IF NOT EXISTS locker                            text,
  ADD COLUMN IF NOT EXISTS exposure                          text,
  ADD COLUMN IF NOT EXISTS pets_permitted                    text,
  ADD COLUMN IF NOT EXISTS balcony                           text,
  ADD COLUMN IF NOT EXISTS ensuite_laundry                   text,
  ADD COLUMN IF NOT EXISTS building_amenities                text,

  -- --- Rental-specific ---
  ADD COLUMN IF NOT EXISTS lease_term                        text,
  ADD COLUMN IF NOT EXISTS furnished                         text,
  ADD COLUMN IF NOT EXISTS rent_includes                     text,

  -- --- Address granularity ---
  ADD COLUMN IF NOT EXISTS unit_number                       text,
  ADD COLUMN IF NOT EXISTS street_number                     text,
  ADD COLUMN IF NOT EXISTS street_suffix                     text,
  ADD COLUMN IF NOT EXISTS street_direction                  text,
  ADD COLUMN IF NOT EXISTS postal_code                       text,
  ADD COLUMN IF NOT EXISTS community_code                    text,
  ADD COLUMN IF NOT EXISTS cross_street                      text,
  ADD COLUMN IF NOT EXISTS directions                        text,
  ADD COLUMN IF NOT EXISTS zoning                             text,
  ADD COLUMN IF NOT EXISTS zoning_designation                text,

  -- --- Listing / brokerage (agent fields: Member endpoint blocked under VOW; stay null) ---
  ADD COLUMN IF NOT EXISTS list_agent_full_name              text,
  ADD COLUMN IF NOT EXISTS list_agent_key                    text,
  ADD COLUMN IF NOT EXISTS co_list_agent_full_name           text,
  ADD COLUMN IF NOT EXISTS list_office_key                   text,
  ADD COLUMN IF NOT EXISTS permission_to_advertise           boolean,

  -- --- Remarks ---
  ADD COLUMN IF NOT EXISTS public_remarks                    text,
  ADD COLUMN IF NOT EXISTS public_remarks_extras             text,
  ADD COLUMN IF NOT EXISTS broker_remarks                    text,

  -- --- Virtual content ---
  ADD COLUMN IF NOT EXISTS virtual_tour_url_unbranded        text,
  ADD COLUMN IF NOT EXISTS virtual_tour_url_branded          text,
  ADD COLUMN IF NOT EXISTS video_link                        text,

  -- --- Probe-discovered extras beyond the original plan ---
  ADD COLUMN IF NOT EXISTS bedrooms_above_grade              integer,
  ADD COLUMN IF NOT EXISTS bedrooms_below_grade              integer,
  ADD COLUMN IF NOT EXISTS kitchens_above_grade              integer,
  ADD COLUMN IF NOT EXISTS kitchens_below_grade              integer,
  ADD COLUMN IF NOT EXISTS rooms_above_grade                 integer,
  ADD COLUMN IF NOT EXISTS rooms_below_grade                 integer,
  ADD COLUMN IF NOT EXISTS den_familyroom_yn                 boolean,
  ADD COLUMN IF NOT EXISTS central_vacuum_yn                 boolean,
  ADD COLUMN IF NOT EXISTS elevator_yn                       boolean,
  ADD COLUMN IF NOT EXISTS attached_garage_yn                boolean,
  ADD COLUMN IF NOT EXISTS handicapped_equipped_yn           boolean,
  ADD COLUMN IF NOT EXISTS senior_community_yn               boolean,
  ADD COLUMN IF NOT EXISTS winterized                        text,
  ADD COLUMN IF NOT EXISTS heat_type_multi                   text[],
  ADD COLUMN IF NOT EXISTS heat_source_multi                 text[],
  ADD COLUMN IF NOT EXISTS cooling_yn                        boolean,
  ADD COLUMN IF NOT EXISTS heating_yn                        boolean,
  ADD COLUMN IF NOT EXISTS fireplaces_total                  integer,
  ADD COLUMN IF NOT EXISTS fireplace_features                text[],
  ADD COLUMN IF NOT EXISTS inclusions                        text,
  ADD COLUMN IF NOT EXISTS exclusions                        text,
  ADD COLUMN IF NOT EXISTS rental_items                      text,
  ADD COLUMN IF NOT EXISTS under_contract                    text[],
  ADD COLUMN IF NOT EXISTS property_features                 text[],
  ADD COLUMN IF NOT EXISTS special_designation               text[],
  ADD COLUMN IF NOT EXISTS hst_application                   text[],
  ADD COLUMN IF NOT EXISTS survey_type                       text,
  ADD COLUMN IF NOT EXISTS direction_faces                   text,
  ADD COLUMN IF NOT EXISTS county_or_parish                  text,
  ADD COLUMN IF NOT EXISTS state_or_province                 text,
  ADD COLUMN IF NOT EXISTS country                           text,
  ADD COLUMN IF NOT EXISTS city_region                       text,
  ADD COLUMN IF NOT EXISTS street_dir_prefix                 text,
  ADD COLUMN IF NOT EXISTS street_dir_suffix                 text,
  ADD COLUMN IF NOT EXISTS street_suffix_code                text,
  ADD COLUMN IF NOT EXISTS town                              text,
  ADD COLUMN IF NOT EXISTS parcel_number                     text,
  ADD COLUMN IF NOT EXISTS parcel_of_tied_land               text,
  ADD COLUMN IF NOT EXISTS tax_book_number                   text,
  ADD COLUMN IF NOT EXISTS main_level_bedrooms               integer,
  ADD COLUMN IF NOT EXISTS main_level_bathrooms              integer,
  ADD COLUMN IF NOT EXISTS washrooms_type1                   integer,
  ADD COLUMN IF NOT EXISTS washrooms_type1_pcs               integer,
  ADD COLUMN IF NOT EXISTS washrooms_type1_level             text,
  ADD COLUMN IF NOT EXISTS washrooms_type2                   integer,
  ADD COLUMN IF NOT EXISTS washrooms_type2_pcs               integer,
  ADD COLUMN IF NOT EXISTS washrooms_type2_level             text,
  ADD COLUMN IF NOT EXISTS washrooms_type3                   integer,
  ADD COLUMN IF NOT EXISTS washrooms_type3_pcs               integer,
  ADD COLUMN IF NOT EXISTS washrooms_type3_level             text,
  ADD COLUMN IF NOT EXISTS washrooms_type4                   integer,
  ADD COLUMN IF NOT EXISTS washrooms_type4_pcs               integer,
  ADD COLUMN IF NOT EXISTS washrooms_type4_level             text,
  ADD COLUMN IF NOT EXISTS photos_change_timestamp           timestamptz,
  ADD COLUMN IF NOT EXISTS major_change_timestamp            timestamptz,
  ADD COLUMN IF NOT EXISTS original_entry_timestamp          timestamptz,
  ADD COLUMN IF NOT EXISTS system_modification_timestamp     timestamptz,
  ADD COLUMN IF NOT EXISTS price_change_timestamp            timestamptz,
  ADD COLUMN IF NOT EXISTS previous_list_price               numeric,
  ADD COLUMN IF NOT EXISTS unavailable_date                  date,
  ADD COLUMN IF NOT EXISTS purchase_contract_date            timestamptz,
  ADD COLUMN IF NOT EXISTS listing_contract_date             timestamptz,
  ADD COLUMN IF NOT EXISTS expiration_date                   date,
  ADD COLUMN IF NOT EXISTS holdover_days                     integer,
  ADD COLUMN IF NOT EXISTS contact_after_expiry_yn           boolean,
  ADD COLUMN IF NOT EXISTS vendor_property_info_statement    boolean,
  ADD COLUMN IF NOT EXISTS sign_on_property_yn               boolean,
  ADD COLUMN IF NOT EXISTS internet_address_display_yn       boolean,
  ADD COLUMN IF NOT EXISTS internet_entire_listing_display_yn boolean,
  ADD COLUMN IF NOT EXISTS ddf_yn                            boolean,
  ADD COLUMN IF NOT EXISTS occupant_type                     text,
  ADD COLUMN IF NOT EXISTS contract_status                   text,
  ADD COLUMN IF NOT EXISTS possession_details                text,
  ADD COLUMN IF NOT EXISTS showing_requirements              text[],
  ADD COLUMN IF NOT EXISTS showing_appointments              text,
  ADD COLUMN IF NOT EXISTS transaction_broker_compensation   text,
  ADD COLUMN IF NOT EXISTS association_amenities             text[],
  ADD COLUMN IF NOT EXISTS association_name                  text,
  ADD COLUMN IF NOT EXISTS balcony_type                      text,
  ADD COLUMN IF NOT EXISTS locker_level                      text,
  ADD COLUMN IF NOT EXISTS locker_unit                       text,
  ADD COLUMN IF NOT EXISTS legal_apartment_number            text,
  ADD COLUMN IF NOT EXISTS legal_stories                     text,
  ADD COLUMN IF NOT EXISTS property_management_company       text,
  ADD COLUMN IF NOT EXISTS status_certificate_yn             boolean,
  ADD COLUMN IF NOT EXISTS pets_allowed                      text[],
  ADD COLUMN IF NOT EXISTS parking_spot1                     text,
  ADD COLUMN IF NOT EXISTS parking_type1                     text,
  ADD COLUMN IF NOT EXISTS parking_spaces                    integer,
  ADD COLUMN IF NOT EXISTS main_office_key                   text,
  ADD COLUMN IF NOT EXISTS co_list_office_name               text,
  ADD COLUMN IF NOT EXISTS co_list_office_phone              text,
  ADD COLUMN IF NOT EXISTS co_list_office_name3              text,
  ADD COLUMN IF NOT EXISTS buyer_office_name                 text,
  ADD COLUMN IF NOT EXISTS co_buyer_office_name              text,
  ADD COLUMN IF NOT EXISTS list_aor                          text,
  ADD COLUMN IF NOT EXISTS originating_system_id             text,
  ADD COLUMN IF NOT EXISTS originating_system_key            text,
  ADD COLUMN IF NOT EXISTS originating_system_name           text,
  ADD COLUMN IF NOT EXISTS source_system_id                  text,
  ADD COLUMN IF NOT EXISTS source_system_name                text,
  ADD COLUMN IF NOT EXISTS bathrooms_total_integer           integer,
  ADD COLUMN IF NOT EXISTS bedrooms_total                    integer,
  ADD COLUMN IF NOT EXISTS property_type_raw                 text,
  ADD COLUMN IF NOT EXISTS property_sub_type                 text,
  ADD COLUMN IF NOT EXISTS living_area_range                 text,
  ADD COLUMN IF NOT EXISTS lot_size_area                     numeric,
  ADD COLUMN IF NOT EXISTS lot_size_area_units               text,
  ADD COLUMN IF NOT EXISTS lot_size_dimensions               text,
  ADD COLUMN IF NOT EXISTS lot_size_range_acres              text,
  ADD COLUMN IF NOT EXISTS lot_size_source                   text,
  ADD COLUMN IF NOT EXISTS lot_dimensions_source             text,
  ADD COLUMN IF NOT EXISTS laundry_features_array            text[],
  ADD COLUMN IF NOT EXISTS laundry_level                     text,
  ADD COLUMN IF NOT EXISTS mls_area_municipality_district    text,
  ADD COLUMN IF NOT EXISTS mls_area_district_old_zone        text,
  ADD COLUMN IF NOT EXISTS board_property_type               text,
  ADD COLUMN IF NOT EXISTS link_yn                           boolean,
  ADD COLUMN IF NOT EXISTS picture_yn                        boolean,
  ADD COLUMN IF NOT EXISTS water                             text,
  ADD COLUMN IF NOT EXISTS water_source_array                text[],
  ADD COLUMN IF NOT EXISTS water_meter_yn                    boolean,
  ADD COLUMN IF NOT EXISTS water_delivery_feature            text[],
  ADD COLUMN IF NOT EXISTS sewage                            text[],
  ADD COLUMN IF NOT EXISTS cable_yna                         text,
  ADD COLUMN IF NOT EXISTS telephone_yna                     text,
  ADD COLUMN IF NOT EXISTS sewer_yna                         text,
  ADD COLUMN IF NOT EXISTS water_yna                         text,
  ADD COLUMN IF NOT EXISTS access_to_property                text[],
  ADD COLUMN IF NOT EXISTS alternative_power                 text[],
  ADD COLUMN IF NOT EXISTS development_charges_paid          text[],
  ADD COLUMN IF NOT EXISTS local_improvements                text,
  ADD COLUMN IF NOT EXISTS road_access_fee                   numeric,
  ADD COLUMN IF NOT EXISTS seasonal_dwelling                 boolean,
  ADD COLUMN IF NOT EXISTS uffi                              text,
  ADD COLUMN IF NOT EXISTS energy_certificate                boolean,
  ADD COLUMN IF NOT EXISTS green_property_information_statement text,
  ADD COLUMN IF NOT EXISTS sales_brochure_url                text,
  ADD COLUMN IF NOT EXISTS waterfront                        text[],
  ADD COLUMN IF NOT EXISTS square_foot_source                text,
  ADD COLUMN IF NOT EXISTS assignment_yn                     boolean,
  ADD COLUMN IF NOT EXISTS fractional_ownership_yn           boolean,
  ADD COLUMN IF NOT EXISTS island_yn                         boolean,
  ADD COLUMN IF NOT EXISTS garage_yn                         boolean,
  ADD COLUMN IF NOT EXISTS mortgage_comment                  text,
  ADD COLUMN IF NOT EXISTS business_name                     text,
  ADD COLUMN IF NOT EXISTS business_type                     text[],
  ADD COLUMN IF NOT EXISTS virtual_tour_url_unbranded2       text,
  ADD COLUMN IF NOT EXISTS virtual_tour_url_branded2         text,

  -- --- Catch-all ---
  ADD COLUMN IF NOT EXISTS raw_vow_data                      jsonb;

CREATE INDEX IF NOT EXISTS idx_sold_records_raw_vow_gin
  ON sold.sold_records USING GIN (raw_vow_data);

COMMIT;

-- =============================================================================
-- STEP 1.5 — Verification (run these manually after COMMIT)
-- =============================================================================
-- SELECT COUNT(*) FROM information_schema.columns
--   WHERE table_schema='sold' AND table_name='sold_records';
-- -- Expected: ~165-170 columns (28 original + ~140 new incl. raw_vow_data)
--
-- SELECT COUNT(*) FROM information_schema.columns
--   WHERE table_schema='sold' AND table_name='media';
-- -- Expected: 24 columns
--
-- SELECT COUNT(*) FROM information_schema.columns
--   WHERE table_schema='sold' AND table_name='rooms';
-- -- Expected: 16 columns
