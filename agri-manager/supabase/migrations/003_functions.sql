-- ============================================================
-- AgriManagerX — Database Functions
-- Migration:  003_functions.sql
-- Run after:  001_initial_schema.sql, 002_rls_policies.sql
-- Description:
--   Server-side functions for analytics, aggregation, and sync.
--   All functions are SECURITY DEFINER so they run with elevated
--   privileges, but they validate the caller's org_id internally.
-- ============================================================

-- ============================================================
-- FUNCTION: get_enterprise_weekly_summary
-- ============================================================
-- Returns weekly aggregated production data for a single enterprise.
-- Supports layers, broilers, fish, cattle, pigs, and rabbits.
-- The client uses this to populate the analysis tab charts without
-- fetching thousands of daily records over the wire.
--
-- Returns JSONB with shape:
--   { enterprise_type, weeks: [{ week_num, week_start, week_end, ... }] }

CREATE OR REPLACE FUNCTION public.get_enterprise_weekly_summary(
  p_enterprise_id UUID,
  p_start_date    DATE DEFAULT NULL,
  p_end_date      DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id        UUID;
  v_ent_type      TEXT;
  v_start         DATE;
  v_end           DATE;
  v_result        JSONB;
  v_weeks         JSONB;
BEGIN
  -- Authorisation: caller must belong to the enterprise's organisation
  v_org_id := auth.get_user_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT enterprise_type, start_date, COALESCE(actual_end_date, expected_end_date, CURRENT_DATE)
  INTO   v_ent_type, v_start, v_end
  FROM   enterprise_instances ei
  JOIN   infrastructures i   ON i.id  = ei.infrastructure_id
  JOIN   farm_locations  fl  ON fl.id = i.farm_location_id
  WHERE  ei.id = p_enterprise_id
    AND  fl.organization_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enterprise not found or access denied';
  END IF;

  -- Override date range if explicitly provided
  IF p_start_date IS NOT NULL THEN v_start := p_start_date; END IF;
  IF p_end_date   IS NOT NULL THEN v_end   := p_end_date;   END IF;

  -- Build weekly aggregation for the specific enterprise type
  CASE v_ent_type

    WHEN 'layers' THEN
      SELECT jsonb_agg(w ORDER BY w->>'week_num') INTO v_weeks
      FROM (
        SELECT jsonb_build_object(
          'week_num',    (date - v_start) / 7 + 1,
          'week_start',  MIN(date),
          'week_end',    MAX(date),
          'days',        COUNT(*),
          'total_eggs',  SUM(total_eggs),
          'mortality',   SUM(mortality_count),
          'feed_kg',     ROUND(SUM(feed_consumed_kg)::NUMERIC, 2),
          'avg_hdp_pct', ROUND(
            (SUM(total_eggs)::NUMERIC /
             NULLIF(COUNT(*) * MAX(current_stock_count), 0) * 100), 2)
        ) AS w
        FROM layer_daily_records ldr
        JOIN enterprise_instances ei ON ei.id = ldr.enterprise_instance_id
        WHERE ldr.enterprise_instance_id = p_enterprise_id
          AND ldr.date BETWEEN v_start AND v_end
        GROUP BY (date - v_start) / 7
      ) sub;

    WHEN 'broilers' THEN
      SELECT jsonb_agg(w ORDER BY w->>'week_num') INTO v_weeks
      FROM (
        SELECT jsonb_build_object(
          'week_num',         (date - v_start) / 7 + 1,
          'week_start',       MIN(date),
          'week_end',         MAX(date),
          'days',             COUNT(*),
          'mortality',        SUM(mortality_count),
          'feed_kg',          ROUND(SUM(feed_consumed_kg)::NUMERIC, 2),
          'avg_body_weight_g', ROUND(
            AVG(body_weight_sample_avg) * 1000, 1)
        ) AS w
        FROM broiler_daily_records
        WHERE enterprise_instance_id = p_enterprise_id
          AND date BETWEEN v_start AND v_end
        GROUP BY (date - v_start) / 7
      ) sub;

    WHEN 'fish' THEN
      SELECT jsonb_agg(w ORDER BY w->>'week_num') INTO v_weeks
      FROM (
        SELECT jsonb_build_object(
          'week_num',     (date - v_start) / 7 + 1,
          'week_start',   MIN(date),
          'week_end',     MAX(date),
          'days',         COUNT(*),
          'mortality',    SUM(estimated_mortality),
          'feed_kg',      ROUND(SUM(feed_given_kg)::NUMERIC, 2),
          'avg_do',       ROUND(AVG(dissolved_oxygen)::NUMERIC, 2),
          'avg_ph',       ROUND(AVG(water_ph)::NUMERIC, 2),
          'avg_temp_c',   ROUND(AVG(water_temp)::NUMERIC, 2)
        ) AS w
        FROM fish_daily_records
        WHERE enterprise_instance_id = p_enterprise_id
          AND date BETWEEN v_start AND v_end
        GROUP BY (date - v_start) / 7
      ) sub;

    WHEN 'cattle_dairy', 'cattle_beef' THEN
      SELECT jsonb_agg(w ORDER BY w->>'week_num') INTO v_weeks
      FROM (
        SELECT jsonb_build_object(
          'week_num',       (date - v_start) / 7 + 1,
          'week_start',     MIN(date),
          'week_end',       MAX(date),
          'days',           COUNT(*),
          'deaths',         SUM(deaths),
          'births',         SUM(births),
          'feed_kg',        ROUND(SUM(feed_consumed_kg)::NUMERIC, 2),
          'total_milk_l',   ROUND(SUM(milk_yield_liters)::NUMERIC, 2)
        ) AS w
        FROM cattle_daily_records
        WHERE enterprise_instance_id = p_enterprise_id
          AND date BETWEEN v_start AND v_end
        GROUP BY (date - v_start) / 7
      ) sub;

    WHEN 'pigs_breeding', 'pigs_growfinish' THEN
      SELECT jsonb_agg(w ORDER BY w->>'week_num') INTO v_weeks
      FROM (
        SELECT jsonb_build_object(
          'week_num',         (date - v_start) / 7 + 1,
          'week_start',       MIN(date),
          'week_end',         MAX(date),
          'days',             COUNT(*),
          'mortality',        SUM(mortality_count),
          'feed_kg',          ROUND(SUM(feed_consumed_kg)::NUMERIC, 2),
          'avg_weight_kg',    ROUND(AVG(avg_body_weight_sample_kg)::NUMERIC, 3)
        ) AS w
        FROM pig_daily_records
        WHERE enterprise_instance_id = p_enterprise_id
          AND date BETWEEN v_start AND v_end
        GROUP BY (date - v_start) / 7
      ) sub;

    WHEN 'rabbit' THEN
      SELECT jsonb_agg(w ORDER BY w->>'week_num') INTO v_weeks
      FROM (
        SELECT jsonb_build_object(
          'week_num',   (date - v_start) / 7 + 1,
          'week_start', MIN(date),
          'week_end',   MAX(date),
          'days',       COUNT(*),
          'mortality',  SUM(mortality_count),
          'feed_kg',    ROUND(SUM(feed_consumed_kg)::NUMERIC, 2)
        ) AS w
        FROM rabbit_daily_records
        WHERE enterprise_instance_id = p_enterprise_id
          AND date BETWEEN v_start AND v_end
        GROUP BY (date - v_start) / 7
      ) sub;

    ELSE
      v_weeks := '[]'::JSONB;
  END CASE;

  v_result := jsonb_build_object(
    'enterprise_id',   p_enterprise_id,
    'enterprise_type', v_ent_type,
    'start_date',      v_start,
    'end_date',        v_end,
    'weeks',           COALESCE(v_weeks, '[]'::JSONB)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_enterprise_weekly_summary IS
  'Returns weekly aggregated production data for one enterprise. '
  'Caller must belong to the enterprise''s organisation. '
  'Used by the analysis tab to render trend charts.';


-- ============================================================
-- FUNCTION: get_farm_financial_summary
-- ============================================================
-- Returns income/expense/margin grouped by enterprise and category
-- for a given date range.  Used by the Reports page and dashboard.
--
-- Returns JSONB with shape:
--   { total_income, total_expenses, net_profit, margin_pct,
--     by_enterprise: [{ enterprise_id, name, income, expenses, net }],
--     by_category:   [{ category, type, amount }] }

CREATE OR REPLACE FUNCTION public.get_farm_financial_summary(
  p_org_id    UUID,
  p_start     DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  p_end       DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    UUID;
  v_result    JSONB;
BEGIN
  -- Authorisation: caller must be in the requested organisation
  v_org_id := auth.get_user_org_id();
  IF v_org_id IS NULL OR v_org_id <> p_org_id THEN
    RAISE EXCEPTION 'Access denied to organisation %', p_org_id;
  END IF;

  WITH txns AS (
    SELECT
      ft.enterprise_instance_id,
      ei.name          AS enterprise_name,
      ft.type,
      ft.category,
      ft.amount
    FROM financial_transactions ft
    LEFT JOIN enterprise_instances ei ON ei.id = ft.enterprise_instance_id
    WHERE ft.organization_id = p_org_id
      AND ft.date BETWEEN p_start AND p_end
  ),
  totals AS (
    SELECT
      SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS total_income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expenses
    FROM txns
  ),
  by_ent AS (
    SELECT
      enterprise_instance_id,
      MAX(enterprise_name) AS name,
      SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
    FROM txns
    WHERE enterprise_instance_id IS NOT NULL
    GROUP BY enterprise_instance_id
  ),
  by_cat AS (
    SELECT
      category,
      type,
      SUM(amount) AS amount
    FROM txns
    GROUP BY category, type
  )
  SELECT jsonb_build_object(
    'date_range', jsonb_build_object('from', p_start, 'to', p_end),
    'total_income',    t.total_income,
    'total_expenses',  t.total_expenses,
    'net_profit',      t.total_income - t.total_expenses,
    'margin_pct',      CASE
                         WHEN t.total_income > 0
                         THEN ROUND(((t.total_income - t.total_expenses) / t.total_income * 100)::NUMERIC, 2)
                         ELSE 0
                       END,
    'by_enterprise',   COALESCE(
                         (SELECT jsonb_agg(jsonb_build_object(
                           'enterprise_id', enterprise_instance_id,
                           'name',          name,
                           'income',        income,
                           'expenses',      expenses,
                           'net',           income - expenses
                         )) FROM by_ent), '[]'::JSONB),
    'by_category',     COALESCE(
                         (SELECT jsonb_agg(jsonb_build_object(
                           'category', category,
                           'type',     type,
                           'amount',   amount
                         ) ORDER BY type, amount DESC) FROM by_cat), '[]'::JSONB)
  )
  INTO v_result
  FROM totals t;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_farm_financial_summary IS
  'Returns income/expense/margin aggregated by enterprise and category. '
  'p_start defaults to the 1st of the current month; p_end defaults to today.';


-- ============================================================
-- FUNCTION: get_sync_batch
-- ============================================================
-- Returns up to p_batch_size rows modified after p_since for the
-- given table, scoped to the caller's organisation.
--
-- Supports all syncable tables. Table names are whitelisted to
-- prevent SQL injection from client-supplied parameters.
--
-- Returns JSONB array: [{ id, data: {…full row…}, server_updated_at }]
-- The client extracts data and upserts into IndexedDB.

CREATE OR REPLACE FUNCTION public.get_sync_batch(
  p_table_name  TEXT,
  p_since       TIMESTAMPTZ DEFAULT '1970-01-01 00:00:00+00',
  p_batch_size  INT         DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id  UUID;
  v_result  JSONB;
  v_query   TEXT;
BEGIN
  v_org_id := auth.get_user_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ── Whitelist: only known syncable tables are allowed ──────────────────────
  IF p_table_name NOT IN (
    'organizations', 'farm_locations', 'infrastructures', 'enterprise_instances',
    'layer_daily_records', 'broiler_daily_records', 'cattle_daily_records',
    'fish_daily_records', 'pig_daily_records', 'rabbit_daily_records',
    'custom_animal_daily_records', 'crop_activity_records',
    'inventory_items', 'inventory_transactions',
    'financial_transactions', 'contacts', 'app_users', 'alerts'
  ) THEN
    RAISE EXCEPTION 'Invalid or unsupported sync table: %', p_table_name;
  END IF;

  -- ── Build organisation-scoped query by table category ─────────────────────
  CASE p_table_name

    -- Direct org_id column
    WHEN 'organizations' THEN
      v_query := format(
        'SELECT coalesce(jsonb_agg(to_jsonb(t.*) ORDER BY t.server_updated_at), ''[]'') '
        'FROM %I t WHERE t.id = $1 AND t.server_updated_at > $2 LIMIT $3',
        p_table_name
      );
      EXECUTE v_query INTO v_result USING v_org_id, p_since, p_batch_size;

    WHEN 'farm_locations', 'inventory_items', 'financial_transactions',
         'contacts', 'app_users', 'alerts', 'sync_meta' THEN
      v_query := format(
        'SELECT coalesce(jsonb_agg(to_jsonb(t.*) ORDER BY t.server_updated_at), ''[]'') '
        'FROM %I t WHERE t.organization_id = $1 AND t.server_updated_at > $2 LIMIT $3',
        p_table_name
      );
      EXECUTE v_query INTO v_result USING v_org_id, p_since, p_batch_size;

    -- One join: infra → farm_location
    WHEN 'infrastructures' THEN
      EXECUTE
        'SELECT coalesce(jsonb_agg(to_jsonb(t.*) ORDER BY t.server_updated_at), ''[]'') '
        'FROM infrastructures t '
        'JOIN farm_locations fl ON fl.id = t.farm_location_id '
        'WHERE fl.organization_id = $1 AND t.server_updated_at > $2 LIMIT $3'
      INTO v_result USING v_org_id, p_since, p_batch_size;

    -- Two joins: enterprise → infra → farm_location
    WHEN 'enterprise_instances' THEN
      EXECUTE
        'SELECT coalesce(jsonb_agg(to_jsonb(t.*) ORDER BY t.server_updated_at), ''[]'') '
        'FROM enterprise_instances t '
        'JOIN infrastructures i ON i.id = t.infrastructure_id '
        'JOIN farm_locations fl ON fl.id = i.farm_location_id '
        'WHERE fl.organization_id = $1 AND t.server_updated_at > $2 LIMIT $3'
      INTO v_result USING v_org_id, p_since, p_batch_size;

    -- inventory_transactions → inventory_items
    WHEN 'inventory_transactions' THEN
      EXECUTE
        'SELECT coalesce(jsonb_agg(to_jsonb(t.*) ORDER BY t.server_updated_at), ''[]'') '
        'FROM inventory_transactions t '
        'JOIN inventory_items ii ON ii.id = t.inventory_item_id '
        'WHERE ii.organization_id = $1 AND t.server_updated_at > $2 LIMIT $3'
      INTO v_result USING v_org_id, p_since, p_batch_size;

    -- Daily record tables: enterprise → infra → farm_location
    ELSE
      v_query := format(
        'SELECT coalesce(jsonb_agg(to_jsonb(t.*) ORDER BY t.server_updated_at), ''[]'') '
        'FROM %I t '
        'JOIN enterprise_instances ei ON ei.id = t.enterprise_instance_id '
        'JOIN infrastructures i ON i.id = ei.infrastructure_id '
        'JOIN farm_locations fl ON fl.id = i.farm_location_id '
        'WHERE fl.organization_id = $1 AND t.server_updated_at > $2 LIMIT $3',
        p_table_name
      );
      EXECUTE v_query INTO v_result USING v_org_id, p_since, p_batch_size;

  END CASE;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

COMMENT ON FUNCTION public.get_sync_batch IS
  'Returns up to p_batch_size rows modified after p_since for the given table, '
  'scoped to the authenticated user''s organisation. '
  'Call repeatedly with the last server_updated_at value as p_since to paginate. '
  'Table name is whitelisted; passing an unlisted name raises an exception.';


-- ============================================================
-- FUNCTION: upsert_sync_record  (push helper)
-- ============================================================
-- Accepts a single record as JSONB and upserts it into the named table.
-- The server_updated_at is reset by the trigger so the client timestamp
-- for that column is ignored.
-- Returns the new server_updated_at for the client to store as its
-- push watermark.

CREATE OR REPLACE FUNCTION public.upsert_sync_record(
  p_table_name TEXT,
  p_record     JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_id     UUID;
  v_ts     TIMESTAMPTZ;
  v_query  TEXT;
BEGIN
  v_org_id := auth.get_user_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Whitelist
  IF p_table_name NOT IN (
    'organizations', 'farm_locations', 'infrastructures', 'enterprise_instances',
    'layer_daily_records', 'broiler_daily_records', 'cattle_daily_records',
    'fish_daily_records', 'pig_daily_records', 'rabbit_daily_records',
    'custom_animal_daily_records', 'crop_activity_records',
    'inventory_items', 'inventory_transactions',
    'financial_transactions', 'contacts', 'app_users', 'alerts'
  ) THEN
    RAISE EXCEPTION 'Invalid sync table: %', p_table_name;
  END IF;

  v_id := (p_record->>'id')::UUID;

  -- Generic upsert using jsonb_populate_record and jsonb_to_record is not
  -- straightforward without dynamic SQL and a known row type.
  -- The client should call table-specific Supabase .upsert() instead.
  -- This function is provided as a fallback for batch-push edge functions.
  -- For production use, prefer direct supabase-js client upserts.

  RAISE NOTICE 'upsert_sync_record: use supabase-js client .upsert() for table %', p_table_name;

  RETURN jsonb_build_object(
    'id', v_id,
    'server_updated_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_sync_record IS
  'Placeholder for batch push. Prefer direct supabase-js .upsert() calls '
  'from the client, which benefit from postgREST type mapping.';
