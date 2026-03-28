-- ============================================================
-- AgriManagerX — Initial Database Schema
-- Migration:  001_initial_schema.sql
-- Run before: 002_rls_policies.sql
-- Description:
--   Creates all tables, constraints, indexes, timestamp triggers,
--   the auth-user hook, and the organisational lookup function used
--   by RLS policies.  Row-level security is ENABLED on every table
--   here; the actual policies are applied in 002_rls_policies.sql.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- crypt() helpers

-- ============================================================
-- SECTION 1 — HELPER FUNCTIONS
-- ============================================================

-- Returns the organization_id of the currently authenticated user.
-- Placed in the auth schema so it can be referenced before public
-- functions are created; 002_rls_policies.sql exposes an identical
-- copy in the public schema for convenience.
CREATE OR REPLACE FUNCTION auth.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id
  FROM public.app_users
  WHERE id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;

-- Sets updated_at = now() on every UPDATE.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Sets server_updated_at = now() on every UPDATE.
-- This column drives delta-sync queries so the server timestamp must
-- be set by the database, never trusted from the client payload.
CREATE OR REPLACE FUNCTION public.update_server_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.server_updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- SECTION 2 — CORE TABLES
-- ============================================================

-- ── organizations ─────────────────────────────────────────────────────────────
-- Top-level tenant.  Every row in every other table belongs to one org.
CREATE TABLE public.organizations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  registration_number   TEXT,                         -- Optional business reg
  tax_id                TEXT,                         -- VAT / TIN / EIN
  currency              TEXT        NOT NULL DEFAULT 'USD',
  default_unit_system   TEXT        NOT NULL DEFAULT 'metric'
                          CHECK (default_unit_system IN ('metric', 'imperial')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.organizations IS 'Top-level tenant; one per farm business.';

-- ── app_users ─────────────────────────────────────────────────────────────────
-- Mirrors auth.users. PK must equal auth.users.id so FK joins work.
-- Created by the client after Supabase auth.signUp(); the trigger below
-- fires only when organization_id is supplied in user metadata.
CREATE TABLE public.app_users (
  id                          UUID        PRIMARY KEY,  -- = auth.users.id
  organization_id             UUID        NOT NULL
                                REFERENCES public.organizations (id) ON DELETE CASCADE,
  email                       TEXT,
  full_name                   TEXT        NOT NULL,
  phone                       TEXT,
  role                        TEXT        NOT NULL DEFAULT 'worker'
                                CHECK (role IN ('owner', 'manager', 'supervisor', 'worker', 'viewer')),
  assigned_farm_location_ids  UUID[]      NOT NULL DEFAULT '{}',
  assigned_infrastructure_ids UUID[]      NOT NULL DEFAULT '{}',
  is_active                   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.app_users IS 'Application-level user profile; PK mirrors auth.users.id.';
COMMENT ON COLUMN public.app_users.assigned_farm_location_ids IS 'For manager scope restriction; empty = access all locations.';
COMMENT ON COLUMN public.app_users.assigned_infrastructure_ids IS 'For worker/supervisor scope; empty = access all infra in assigned locations.';

-- ── farm_locations ────────────────────────────────────────────────────────────
-- A physical farm or site within an organisation.
CREATE TABLE public.farm_locations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL
                          REFERENCES public.organizations (id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  gps_latitude          NUMERIC(10, 7),
  gps_longitude         NUMERIC(10, 7),
  address               TEXT,
  total_area_hectares   NUMERIC(12, 4),
  altitude_meters       NUMERIC(8, 2),
  climate_zone          TEXT,                         -- e.g. 'semi-arid', 'tropical'
  status                TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive', 'archived')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.farm_locations IS 'A physical farm or site owned by an organisation.';

-- ── infrastructures ───────────────────────────────────────────────────────────
-- A physical structure on a farm location (house, pond, field, etc.)
CREATE TABLE public.infrastructures (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_location_id      UUID        NOT NULL
                          REFERENCES public.farm_locations (id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  type                  TEXT        NOT NULL
                          CHECK (type IN (
                            'poultry_house', 'fish_pond', 'cattle_pen', 'pig_pen',
                            'rabbit_hutch', 'field', 'greenhouse', 'storage', 'other'
                          )),
  capacity              INT,                          -- Headcount / plant capacity
  area_square_meters    NUMERIC(12, 2),
  length_meters         NUMERIC(10, 2),
  width_meters          NUMERIC(10, 2),
  description           TEXT,
  status                TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive', 'under_maintenance', 'decommissioned')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.infrastructures IS 'Physical structure (house/pond/field) that hosts enterprise instances.';

-- ── enterprise_instances ──────────────────────────────────────────────────────
-- A production batch or growing cycle occupying one infrastructure unit.
CREATE TABLE public.enterprise_instances (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  infrastructure_id     UUID        NOT NULL
                          REFERENCES public.infrastructures (id) ON DELETE CASCADE,
  enterprise_type       TEXT        NOT NULL
                          CHECK (enterprise_type IN (
                            'layers', 'broilers',
                            'cattle_dairy', 'cattle_beef',
                            'pigs_breeding', 'pigs_growfinish',
                            'fish', 'rabbit', 'custom_animal',
                            'crop_annual', 'crop_perennial'
                          )),
  name                  TEXT        NOT NULL,
  start_date            DATE        NOT NULL,
  expected_end_date     DATE,
  actual_end_date       DATE,
  status                TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  initial_stock_count   INT         NOT NULL DEFAULT 0,
  current_stock_count   INT         NOT NULL DEFAULT 0,
  breed_or_variety      TEXT,                         -- e.g. 'Ross 308', 'Hy-Line Brown', 'Tilapia'
  source                TEXT,                         -- Supplier / hatchery
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.enterprise_instances IS 'A production batch or growing cycle within an infrastructure unit.';
COMMENT ON COLUMN public.enterprise_instances.breed_or_variety IS 'Genetic strain or crop variety for benchmarking against breed standards.';

-- ============================================================
-- SECTION 3 — DAILY RECORD TABLES
-- ============================================================
-- All daily record tables share the same base columns.
-- UNIQUE (enterprise_instance_id, date) prevents duplicate entries for
-- the same day and enables upsert semantics on the client.

-- ── layer_daily_records ───────────────────────────────────────────────────────
CREATE TABLE public.layer_daily_records (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_instance_id    UUID        NOT NULL
                              REFERENCES public.enterprise_instances (id) ON DELETE CASCADE,
  date                      DATE        NOT NULL,
  recorded_by               TEXT        NOT NULL,     -- app_user.id or name
  total_eggs                INT         NOT NULL DEFAULT 0,
  broken_eggs               INT                  DEFAULT 0,
  reject_eggs               INT                  DEFAULT 0,
  mortality_count           INT         NOT NULL DEFAULT 0,
  mortality_cause           TEXT,
  feed_consumed_kg          NUMERIC(8,3) NOT NULL DEFAULT 0,
  feed_type                 TEXT,
  water_consumed_liters     NUMERIC(8,2),
  temperature_high          NUMERIC(5,2),             -- °C
  temperature_low           NUMERIC(5,2),             -- °C
  notes                     TEXT,
  sync_status               TEXT        NOT NULL DEFAULT 'synced'
                              CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enterprise_instance_id, date)
);
COMMENT ON TABLE public.layer_daily_records IS 'Daily production record for a laying flock.';

-- ── broiler_daily_records ─────────────────────────────────────────────────────
CREATE TABLE public.broiler_daily_records (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_instance_id    UUID        NOT NULL
                              REFERENCES public.enterprise_instances (id) ON DELETE CASCADE,
  date                      DATE        NOT NULL,
  recorded_by               TEXT        NOT NULL,
  mortality_count           INT         NOT NULL DEFAULT 0,
  mortality_cause           TEXT,
  feed_consumed_kg          NUMERIC(8,3) NOT NULL DEFAULT 0,
  feed_type                 TEXT,
  water_consumed_liters     NUMERIC(8,2),
  body_weight_sample_avg    NUMERIC(6,3),             -- kg, average of sample birds
  body_weight_sample_size   INT,                      -- Number of birds weighed
  notes                     TEXT,
  sync_status               TEXT        NOT NULL DEFAULT 'synced'
                              CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enterprise_instance_id, date)
);
COMMENT ON TABLE public.broiler_daily_records IS 'Daily growth and mortality record for a broiler batch.';
COMMENT ON COLUMN public.broiler_daily_records.body_weight_sample_avg IS 'Average live weight of sampled birds (kg). Used for FCR and growth-curve benchmarking.';

-- ── cattle_daily_records ──────────────────────────────────────────────────────
CREATE TABLE public.cattle_daily_records (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_instance_id    UUID        NOT NULL
                              REFERENCES public.enterprise_instances (id) ON DELETE CASCADE,
  date                      DATE        NOT NULL,
  recorded_by               TEXT        NOT NULL,
  milk_yield_liters         NUMERIC(8,2),             -- Dairy only
  milking_count             INT,                      -- Number of milkings this day
  feed_consumed_kg          NUMERIC(8,3),
  feed_type                 TEXT,
  deaths                    INT                  DEFAULT 0,
  births                    INT                  DEFAULT 0,
  health_notes              TEXT,
  notes                     TEXT,
  sync_status               TEXT        NOT NULL DEFAULT 'synced'
                              CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enterprise_instance_id, date)
);
COMMENT ON TABLE public.cattle_daily_records IS 'Daily record for cattle (dairy and beef).';

-- ── fish_daily_records ────────────────────────────────────────────────────────
CREATE TABLE public.fish_daily_records (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_instance_id    UUID        NOT NULL
                              REFERENCES public.enterprise_instances (id) ON DELETE CASCADE,
  date                      DATE        NOT NULL,
  recorded_by               TEXT        NOT NULL,
  feed_given_kg             NUMERIC(8,3) NOT NULL DEFAULT 0,
  feed_type                 TEXT,
  estimated_mortality       INT                  DEFAULT 0,
  water_temp                NUMERIC(5,2),             -- °C; alert if outside 18–32°C
  water_ph                  NUMERIC(4,2),             -- alert if outside 6.5–9.0
  dissolved_oxygen          NUMERIC(5,2),             -- mg/L; alert if < 3.0
  ammonia                   NUMERIC(6,3),             -- mg/L; alert if > 0.5
  notes                     TEXT,
  sync_status               TEXT        NOT NULL DEFAULT 'synced'
                              CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enterprise_instance_id, date)
);
COMMENT ON TABLE public.fish_daily_records IS 'Daily record for fish / aquaculture ponds.';
COMMENT ON COLUMN public.fish_daily_records.dissolved_oxygen IS 'mg/L. Critical alert fires below 3.0 mg/L.';
COMMENT ON COLUMN public.fish_daily_records.ammonia IS 'mg/L total ammonia. Alert fires above 0.5 mg/L.';

-- ── pig_daily_records ─────────────────────────────────────────────────────────
CREATE TABLE public.pig_daily_records (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_instance_id    UUID        NOT NULL
                              REFERENCES public.enterprise_instances (id) ON DELETE CASCADE,
  date                      DATE        NOT NULL,
  recorded_by               TEXT        NOT NULL,
  mortality_count           INT         NOT NULL DEFAULT 0,
  mortality_cause           TEXT,
  feed_consumed_kg          NUMERIC(8,3) NOT NULL DEFAULT 0,
  feed_type                 TEXT,
  water_consumed_liters     NUMERIC(8,2),
  birth_count               INT,                      -- Piglets farrowed
  wean_count                INT,                      -- Piglets weaned
  avg_body_weight_sample_kg NUMERIC(6,3),
  body_weight_sample_size   INT,
  health_notes              TEXT,
  notes                     TEXT,
  sync_status               TEXT        NOT NULL DEFAULT 'synced'
                              CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enterprise_instance_id, date)
);
COMMENT ON TABLE public.pig_daily_records IS 'Daily record for pigs (breeding and grow-finish).';

-- ── rabbit_daily_records ──────────────────────────────────────────────────────
CREATE TABLE public.rabbit_daily_records (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_instance_id    UUID        NOT NULL
                              REFERENCES public.enterprise_instances (id) ON DELETE CASCADE,
  date                      DATE        NOT NULL,
  recorded_by               TEXT        NOT NULL,
  mortality_count           INT         NOT NULL DEFAULT 0,
  mortality_cause           TEXT,
  feed_consumed_kg          NUMERIC(8,3) NOT NULL DEFAULT 0,
  feed_type                 TEXT,
  water_consumed_liters     NUMERIC(8,2),
  birth_count               INT,                      -- Kittens born
  wean_count                INT,                      -- Kittens weaned
  mating_count              INT,
  avg_body_weight_sample_kg NUMERIC(6,3),
  notes                     TEXT,
  sync_status               TEXT        NOT NULL DEFAULT 'synced'
                              CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enterprise_instance_id, date)
);
COMMENT ON TABLE public.rabbit_daily_records IS 'Daily record for rabbit production.';

-- ── custom_animal_daily_records ───────────────────────────────────────────────
-- Flexible record for any unlisted species.
-- Three named metric slots let operators track species-specific KPIs
-- (wool weight, honey yield, etc.) without schema changes.
CREATE TABLE public.custom_animal_daily_records (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_instance_id    UUID        NOT NULL
                              REFERENCES public.enterprise_instances (id) ON DELETE CASCADE,
  date                      DATE        NOT NULL,
  recorded_by               TEXT        NOT NULL,
  animal_type               TEXT,                     -- User-defined label, e.g. 'Goat', 'Turkey'
  mortality_count           INT,
  mortality_cause           TEXT,
  feed_consumed_kg          NUMERIC(8,3),
  feed_type_name            TEXT,
  water_consumed_liters     NUMERIC(8,2),
  head_count_change         INT,                      -- +births/purchases, -sales/deaths
  metric1_name              TEXT,
  metric1_value             NUMERIC(12,4),
  metric2_name              TEXT,
  metric2_value             NUMERIC(12,4),
  metric3_name              TEXT,
  metric3_value             NUMERIC(12,4),
  health_notes              TEXT,
  notes                     TEXT,
  sync_status               TEXT        NOT NULL DEFAULT 'synced'
                              CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enterprise_instance_id, date)
);
COMMENT ON TABLE public.custom_animal_daily_records IS 'Flexible daily record for any unlisted animal species.';
COMMENT ON COLUMN public.custom_animal_daily_records.metric1_name IS 'User-defined metric label (e.g. "Wool Weight kg", "Honey Yield g").';

-- ── crop_activity_records ─────────────────────────────────────────────────────
-- Event-based (not necessarily daily) crop log.
-- No UNIQUE (enterprise_instance_id, date) because multiple activities
-- can occur on the same day (e.g., spray in morning, harvest in afternoon).
CREATE TABLE public.crop_activity_records (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_instance_id    UUID        NOT NULL
                              REFERENCES public.enterprise_instances (id) ON DELETE CASCADE,
  date                      DATE        NOT NULL,
  recorded_by               TEXT        NOT NULL,
  activity_type             TEXT        NOT NULL
                              CHECK (activity_type IN (
                                'planting', 'fertilizing', 'spraying', 'weeding',
                                'irrigating', 'harvesting', 'scouting', 'other'
                              )),
  input_used                TEXT,                     -- Product / material name
  input_quantity            NUMERIC(10,3),
  input_unit                TEXT,                     -- kg, L, bags, etc.
  labor_hours               NUMERIC(6,2),
  worker_count              INT,
  harvest_quantity_kg       NUMERIC(10,3),
  harvest_grade             TEXT,                     -- A, B, export, local, etc.
  growth_stage              TEXT,                     -- e.g. 'V6', 'flowering', 'grain fill'
  pest_or_disease           TEXT,                     -- Observed pest/disease
  severity                  TEXT
                              CHECK (severity IN ('low', 'medium', 'high')),
  weather_notes             TEXT,
  notes                     TEXT,
  sync_status               TEXT        NOT NULL DEFAULT 'synced'
                              CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.crop_activity_records IS 'Event-based activity log for crop enterprises.';
COMMENT ON COLUMN public.crop_activity_records.activity_type IS 'Pesticide/herbicide/fungicide spraying is captured as "spraying"; compliance log filters on input_used.';

-- ============================================================
-- SECTION 4 — INVENTORY
-- ============================================================

-- ── inventory_items ───────────────────────────────────────────────────────────
CREATE TABLE public.inventory_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL
                          REFERENCES public.organizations (id) ON DELETE CASCADE,
  category              TEXT        NOT NULL
                          CHECK (category IN (
                            'feed', 'medication', 'fertilizer', 'seed',
                            'chemical', 'fuel', 'packaging', 'other'
                          )),
  name                  TEXT        NOT NULL,
  unit_of_measurement   TEXT        NOT NULL,         -- kg, L, bags, units, etc.
  current_stock         NUMERIC(14,3) NOT NULL DEFAULT 0,
  reorder_point         NUMERIC(14,3),               -- Alert fires at or below this
  reorder_quantity      NUMERIC(14,3),               -- Suggested purchase quantity
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.inventory_items IS 'Tracked consumable stock item for a farm.';
COMMENT ON COLUMN public.inventory_items.reorder_point IS 'Stock level that triggers a low-stock alert.';

-- ── contacts ──────────────────────────────────────────────────────────────────
-- Defined here (before inventory_transactions and financial_transactions)
-- because both tables carry a supplier_id / counterparty_id FK to contacts.
CREATE TABLE public.contacts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL
                          REFERENCES public.organizations (id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  phone                 TEXT,
  email                 TEXT,
  address               TEXT,
  type                  TEXT        NOT NULL
                          CHECK (type IN (
                            'supplier', 'buyer', 'vet', 'extension_officer',
                            'employee', 'transporter', 'other'
                          )),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.contacts IS 'Suppliers, buyers, vets, and other contacts for the farm.';

-- ── inventory_transactions ────────────────────────────────────────────────────
CREATE TABLE public.inventory_transactions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id     UUID        NOT NULL
                          REFERENCES public.inventory_items (id) ON DELETE CASCADE,
  type                  TEXT        NOT NULL
                          CHECK (type IN ('in', 'out', 'adjustment')),
  quantity              NUMERIC(14,3) NOT NULL,       -- Always positive; sign implied by type
  unit_cost             NUMERIC(12,4),               -- Per-unit cost at time of transaction
  enterprise_instance_id UUID
                          REFERENCES public.enterprise_instances (id) ON DELETE SET NULL,
  supplier_id           UUID
                          REFERENCES public.contacts (id) ON DELETE SET NULL,
  batch_or_lot_number   TEXT,
  expiry_date           DATE,
  reference             TEXT,                         -- PO number, delivery note, etc.
  date                  DATE        NOT NULL,
  recorded_by           TEXT        NOT NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.inventory_transactions IS 'Stock movement record (receipt, issue, adjustment).';
COMMENT ON COLUMN public.inventory_transactions.type IS '"in"=receipt, "out"=consumption/issue, "adjustment"=physical count reconciliation.';
COMMENT ON COLUMN public.inventory_transactions.quantity IS 'Always a positive value; direction is inferred from type.';

-- ============================================================
-- SECTION 5 — FINANCIAL
-- ============================================================

-- ── financial_transactions ────────────────────────────────────────────────────
CREATE TABLE public.financial_transactions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL
                          REFERENCES public.organizations (id) ON DELETE CASCADE,
  enterprise_instance_id UUID
                          REFERENCES public.enterprise_instances (id) ON DELETE SET NULL,
  date                  DATE        NOT NULL,
  type                  TEXT        NOT NULL CHECK (type IN ('income', 'expense')),
  category              TEXT        NOT NULL
                          CHECK (category IN (
                            'feed', 'labor', 'medication', 'transport', 'utilities',
                            'sales_eggs', 'sales_birds', 'sales_milk', 'sales_fish',
                            'sales_crops', 'sales_other',
                            'rent', 'insurance', 'equipment', 'administrative', 'other'
                          )),
  amount                NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  payment_method        TEXT        NOT NULL
                          CHECK (payment_method IN ('cash', 'bank', 'mobile_money', 'credit')),
  counterparty_id       UUID
                          REFERENCES public.contacts (id) ON DELETE SET NULL,
  reference             TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.financial_transactions IS 'Income and expense ledger for the farm.';
COMMENT ON COLUMN public.financial_transactions.counterparty_id IS 'References contacts table: supplier (for expense) or buyer (for income).';

-- ============================================================
-- SECTION 6 — ALERTS
-- ============================================================

-- ── alerts ────────────────────────────────────────────────────────────────────
-- Generated by the local alert engine and optionally synced to Supabase
-- so that the server-side edge function can also create and read alerts.
-- organization_id is denormalised here to enable simple RLS policies.
CREATE TABLE public.alerts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL
                          REFERENCES public.organizations (id) ON DELETE CASCADE,
  type                  TEXT        NOT NULL,          -- Rule ID, e.g. 'layer_production_drop'
  severity              TEXT        NOT NULL
                          CHECK (severity IN ('critical', 'high', 'medium', 'info')),
  message               TEXT        NOT NULL,
  enterprise_instance_id UUID
                          REFERENCES public.enterprise_instances (id) ON DELETE CASCADE,
  is_read               BOOLEAN     NOT NULL DEFAULT FALSE,
  is_dismissed          BOOLEAN     NOT NULL DEFAULT FALSE,
  action_route          TEXT,                          -- Client-side navigation path
  action_label          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.alerts IS 'Operational and compliance alerts; created by client engine and server edge function.';
COMMENT ON COLUMN public.alerts.type IS 'Alert rule identifier matching AlertRuleId constants in the client (e.g. "layer_production_drop").';
COMMENT ON COLUMN public.alerts.organization_id IS 'Denormalised from enterprise hierarchy to enable O(1) RLS lookup.';

-- ── sync_meta ─────────────────────────────────────────────────────────────────
-- Tracks the last successful pull time per table, per device (client-side).
-- Stored in Supabase only as a convenience; the client also maintains a
-- local copy in IndexedDB.
CREATE TABLE public.sync_meta (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL
                          REFERENCES public.organizations (id) ON DELETE CASCADE,
  table_name            TEXT        NOT NULL,
  last_pull_at          TIMESTAMPTZ,
  UNIQUE (organization_id, table_name)
);
COMMENT ON TABLE public.sync_meta IS 'Per-organisation per-table sync watermark for delta pull.';

-- ============================================================
-- SECTION 7 — INDEXES
-- ============================================================
-- Foreign key columns, sync query columns, and high-frequency filter columns.

-- organisations ── already PK-indexed

-- app_users
CREATE INDEX idx_app_users_org           ON public.app_users           (organization_id);
CREATE INDEX idx_app_users_srv           ON public.app_users           (server_updated_at);

-- farm_locations
CREATE INDEX idx_farm_locations_org      ON public.farm_locations      (organization_id);
CREATE INDEX idx_farm_locations_srv      ON public.farm_locations      (server_updated_at);
CREATE INDEX idx_farm_locations_status   ON public.farm_locations      (status);

-- infrastructures
CREATE INDEX idx_infra_location         ON public.infrastructures      (farm_location_id);
CREATE INDEX idx_infra_srv              ON public.infrastructures      (server_updated_at);
CREATE INDEX idx_infra_status           ON public.infrastructures      (status);

-- enterprise_instances
CREATE INDEX idx_ent_infra              ON public.enterprise_instances (infrastructure_id);
CREATE INDEX idx_ent_type               ON public.enterprise_instances (enterprise_type);
CREATE INDEX idx_ent_status             ON public.enterprise_instances (status);
CREATE INDEX idx_ent_start              ON public.enterprise_instances (start_date);
CREATE INDEX idx_ent_srv                ON public.enterprise_instances (server_updated_at);

-- daily record tables: compound PK-equivalent + sync index
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'layer_daily_records', 'broiler_daily_records', 'cattle_daily_records',
    'fish_daily_records', 'pig_daily_records', 'rabbit_daily_records',
    'custom_animal_daily_records', 'crop_activity_records'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- Compound query pattern: WHERE enterprise_instance_id = ? AND date BETWEEN ? AND ?
    EXECUTE format(
      'CREATE INDEX idx_%s_eid_date ON public.%I (enterprise_instance_id, date)',
      replace(tbl, '_daily_records', ''), tbl
    );
    -- Delta-sync query: WHERE server_updated_at > ? ORDER BY server_updated_at
    EXECUTE format(
      'CREATE INDEX idx_%s_srv ON public.%I (server_updated_at)',
      replace(tbl, '_daily_records', ''), tbl
    );
  END LOOP;
END;
$$;

-- inventory_items
CREATE INDEX idx_inv_items_org          ON public.inventory_items       (organization_id);
CREATE INDEX idx_inv_items_category     ON public.inventory_items       (category);
CREATE INDEX idx_inv_items_srv          ON public.inventory_items       (server_updated_at);

-- inventory_transactions
CREATE INDEX idx_inv_tx_item            ON public.inventory_transactions (inventory_item_id);
CREATE INDEX idx_inv_tx_enterprise      ON public.inventory_transactions (enterprise_instance_id);
CREATE INDEX idx_inv_tx_date            ON public.inventory_transactions (date);
CREATE INDEX idx_inv_tx_srv             ON public.inventory_transactions (server_updated_at);

-- financial_transactions
CREATE INDEX idx_fin_tx_org             ON public.financial_transactions (organization_id);
CREATE INDEX idx_fin_tx_enterprise      ON public.financial_transactions (enterprise_instance_id);
CREATE INDEX idx_fin_tx_date            ON public.financial_transactions (date);
CREATE INDEX idx_fin_tx_type            ON public.financial_transactions (type);
CREATE INDEX idx_fin_tx_category        ON public.financial_transactions (category);
CREATE INDEX idx_fin_tx_srv             ON public.financial_transactions (server_updated_at);

-- contacts
CREATE INDEX idx_contacts_org           ON public.contacts              (organization_id);
CREATE INDEX idx_contacts_type          ON public.contacts              (type);
CREATE INDEX idx_contacts_srv           ON public.contacts              (server_updated_at);

-- alerts
CREATE INDEX idx_alerts_org             ON public.alerts                (organization_id);
CREATE INDEX idx_alerts_enterprise      ON public.alerts                (enterprise_instance_id);
CREATE INDEX idx_alerts_severity        ON public.alerts                (severity);
CREATE INDEX idx_alerts_is_read         ON public.alerts                (is_read) WHERE is_read = FALSE;
CREATE INDEX idx_alerts_is_dismissed    ON public.alerts                (is_dismissed) WHERE is_dismissed = FALSE;
CREATE INDEX idx_alerts_srv             ON public.alerts                (server_updated_at);

-- sync_meta
CREATE INDEX idx_sync_meta_org          ON public.sync_meta             (organization_id);

-- ============================================================
-- SECTION 8 — ROW LEVEL SECURITY (enable; policies in 002)
-- ============================================================
-- Enable RLS on every table.  No policies yet — 002_rls_policies.sql
-- adds them.  Until policies exist, only the service role can access rows.

ALTER TABLE public.organizations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_locations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infrastructures            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_instances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer_daily_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broiler_daily_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cattle_daily_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fish_daily_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pig_daily_records          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rabbit_daily_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_animal_daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_activity_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_meta                  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 9 — TIMESTAMP TRIGGERS
-- ============================================================
-- Applied to every table so client-supplied timestamps cannot bypass
-- auditing.  server_updated_at is used exclusively for sync queries.

DO $$
DECLARE
  tbl TEXT;
  all_tables TEXT[] := ARRAY[
    'organizations', 'app_users', 'farm_locations', 'infrastructures',
    'enterprise_instances',
    'layer_daily_records', 'broiler_daily_records', 'cattle_daily_records',
    'fish_daily_records', 'pig_daily_records', 'rabbit_daily_records',
    'custom_animal_daily_records', 'crop_activity_records',
    'inventory_items', 'inventory_transactions',
    'financial_transactions', 'contacts', 'alerts'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_tables LOOP
    -- updated_at trigger
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      tbl, tbl
    );
    -- server_updated_at trigger
    EXECUTE format(
      'CREATE TRIGGER trg_%s_server_ts
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.update_server_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- SECTION 10 — AUTH USER HOOK
-- ============================================================
-- Fires after a Supabase auth.users row is inserted.
-- Creates an app_users shell only when the client supplies
-- organization_id in user_metadata (admin-provisioned flow).
-- Normal self-signup flow: client creates org + user locally via
-- seedInitialData(), then syncs; no shell is needed here.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Extract organization_id from metadata if present
  v_org_id := NULLIF(
    NEW.raw_user_meta_data->>'organization_id', ''
  )::UUID;

  -- Only insert a shell record for admin-provisioned users
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.app_users (
      id, organization_id, email, full_name, phone, role
    )
    VALUES (
      NEW.id,
      v_org_id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
      NEW.raw_user_meta_data->>'phone',
      COALESCE(NEW.raw_user_meta_data->>'role', 'worker')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER after_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'Creates an app_users shell record for admin-provisioned accounts. '
  'Self-signup users create their own records client-side via seedInitialData().';
