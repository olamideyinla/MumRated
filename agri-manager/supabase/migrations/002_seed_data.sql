-- ============================================================
-- AgriManagerX — Reference / Seed Data
-- Migration:  002_seed_data.sql
-- Run after:  001_initial_schema.sql, 002_rls_policies.sql
-- Description:
--   Immutable reference tables that power benchmarking and alerting:
--     1. breed_standards   — growth curves and production targets
--     2. default_alert_thresholds — engine thresholds to seed settings
-- ============================================================

-- ============================================================
-- TABLE: breed_standards
-- ============================================================
-- Stores expected performance metrics by breed, week/day, and
-- enterprise type.  The client interpolates between rows to
-- compute targets for any given age.

CREATE TABLE IF NOT EXISTS public.breed_standards (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_name              TEXT         NOT NULL,   -- 'ross_308', 'cobb_500', 'hy_line_brown', 'isa_brown'
  enterprise_type         TEXT         NOT NULL,   -- 'broilers' | 'layers'
  day_or_week             INT          NOT NULL,   -- Day-of-age for broilers, week-of-age for layers
  expected_weight_g       NUMERIC(8,1),            -- Broilers: live weight (g). NULL for layers.
  expected_production_pct NUMERIC(5,2),            -- Layers: hen-day production %. NULL for broilers.
  expected_feed_intake_g  NUMERIC(7,1),            -- g/bird/day for both types. NULL if unknown.
  UNIQUE (breed_name, enterprise_type, day_or_week)
);
COMMENT ON TABLE public.breed_standards IS
  'Reference performance targets for common breeds. '
  'Broilers: day-based weight curve. Layers: week-based production curve.';
COMMENT ON COLUMN public.breed_standards.day_or_week IS
  'Day-of-age for broilers (0–56). Calendar week of lay for layers (18–80).';
COMMENT ON COLUMN public.breed_standards.expected_production_pct IS
  'Hen-day production % (eggs/hen/day × 100) for layer breeds.';

-- ── Ross 308 Broiler ──────────────────────────────────────────────────────────
-- Source: Aviagen Ross 308 Broiler Performance Objectives (2022 ed.)
-- Mixed sex (male + female average)
INSERT INTO public.breed_standards
  (breed_name, enterprise_type, day_or_week, expected_weight_g, expected_feed_intake_g)
VALUES
  ('ross_308', 'broilers',  0,    42.0,    0.0),
  ('ross_308', 'broilers',  1,    57.0,   12.0),
  ('ross_308', 'broilers',  2,    74.0,   17.0),
  ('ross_308', 'broilers',  3,    93.0,   22.0),
  ('ross_308', 'broilers',  4,   115.0,   26.0),
  ('ross_308', 'broilers',  5,   140.0,   31.0),
  ('ross_308', 'broilers',  6,   166.0,   35.0),
  ('ross_308', 'broilers',  7,   195.0,   40.0),
  ('ross_308', 'broilers',  8,   228.0,   45.0),
  ('ross_308', 'broilers',  9,   262.0,   50.0),
  ('ross_308', 'broilers', 10,   300.0,   55.0),
  ('ross_308', 'broilers', 11,   340.0,   60.0),
  ('ross_308', 'broilers', 12,   383.0,   65.0),
  ('ross_308', 'broilers', 13,   429.0,   70.0),
  ('ross_308', 'broilers', 14,   490.0,   77.0),
  ('ross_308', 'broilers', 15,   545.0,   83.0),
  ('ross_308', 'broilers', 16,   603.0,   89.0),
  ('ross_308', 'broilers', 17,   664.0,   95.0),
  ('ross_308', 'broilers', 18,   729.0,  101.0),
  ('ross_308', 'broilers', 19,   797.0,  107.0),
  ('ross_308', 'broilers', 20,   868.0,  113.0),
  ('ross_308', 'broilers', 21,   930.0,  119.0),
  ('ross_308', 'broilers', 22,  1015.0,  125.0),
  ('ross_308', 'broilers', 23,  1095.0,  130.0),
  ('ross_308', 'broilers', 24,  1177.0,  136.0),
  ('ross_308', 'broilers', 25,  1262.0,  141.0),
  ('ross_308', 'broilers', 26,  1348.0,  146.0),
  ('ross_308', 'broilers', 27,  1437.0,  151.0),
  ('ross_308', 'broilers', 28,  1490.0,  156.0),
  ('ross_308', 'broilers', 29,  1615.0,  162.0),
  ('ross_308', 'broilers', 30,  1710.0,  167.0),
  ('ross_308', 'broilers', 31,  1805.0,  172.0),
  ('ross_308', 'broilers', 32,  1902.0,  177.0),
  ('ross_308', 'broilers', 33,  1999.0,  181.0),
  ('ross_308', 'broilers', 34,  2066.0,  186.0),
  ('ross_308', 'broilers', 35,  2130.0,  190.0),
  ('ross_308', 'broilers', 36,  2235.0,  195.0),
  ('ross_308', 'broilers', 37,  2330.0,  199.0),
  ('ross_308', 'broilers', 38,  2425.0,  203.0),
  ('ross_308', 'broilers', 39,  2518.0,  207.0),
  ('ross_308', 'broilers', 40,  2610.0,  211.0),
  ('ross_308', 'broilers', 41,  2665.0,  215.0),
  ('ross_308', 'broilers', 42,  2720.0,  219.0),
  ('ross_308', 'broilers', 43,  2820.0,  223.0),
  ('ross_308', 'broilers', 44,  2910.0,  227.0),
  ('ross_308', 'broilers', 45,  2995.0,  231.0),
  ('ross_308', 'broilers', 46,  3080.0,  235.0),
  ('ross_308', 'broilers', 47,  3162.0,  239.0),
  ('ross_308', 'broilers', 48,  3210.0,  242.0),
  ('ross_308', 'broilers', 49,  3250.0,  245.0),
  ('ross_308', 'broilers', 50,  3330.0,  248.0),
  ('ross_308', 'broilers', 51,  3408.0,  251.0),
  ('ross_308', 'broilers', 52,  3484.0,  254.0),
  ('ross_308', 'broilers', 53,  3558.0,  257.0),
  ('ross_308', 'broilers', 54,  3630.0,  260.0),
  ('ross_308', 'broilers', 55,  3700.0,  263.0),
  ('ross_308', 'broilers', 56,  3740.0,  265.0);

-- ── Cobb 500 Broiler ──────────────────────────────────────────────────────────
-- Source: Cobb 500 Broiler Performance & Nutrition Supplement (2022)
-- Mixed sex average
INSERT INTO public.breed_standards
  (breed_name, enterprise_type, day_or_week, expected_weight_g, expected_feed_intake_g)
VALUES
  ('cobb_500', 'broilers',  0,    42.0,    0.0),
  ('cobb_500', 'broilers',  1,    60.0,   13.0),
  ('cobb_500', 'broilers',  2,    79.0,   18.0),
  ('cobb_500', 'broilers',  3,   100.0,   23.0),
  ('cobb_500', 'broilers',  4,   124.0,   28.0),
  ('cobb_500', 'broilers',  5,   151.0,   33.0),
  ('cobb_500', 'broilers',  6,   180.0,   38.0),
  ('cobb_500', 'broilers',  7,   210.0,   43.0),
  ('cobb_500', 'broilers',  8,   246.0,   48.0),
  ('cobb_500', 'broilers',  9,   285.0,   54.0),
  ('cobb_500', 'broilers', 10,   327.0,   59.0),
  ('cobb_500', 'broilers', 11,   372.0,   65.0),
  ('cobb_500', 'broilers', 12,   419.0,   70.0),
  ('cobb_500', 'broilers', 13,   469.0,   76.0),
  ('cobb_500', 'broilers', 14,   530.0,   82.0),
  ('cobb_500', 'broilers', 15,   590.0,   88.0),
  ('cobb_500', 'broilers', 16,   653.0,   94.0),
  ('cobb_500', 'broilers', 17,   719.0,  100.0),
  ('cobb_500', 'broilers', 18,   788.0,  106.0),
  ('cobb_500', 'broilers', 19,   860.0,  112.0),
  ('cobb_500', 'broilers', 20,   935.0,  118.0),
  ('cobb_500', 'broilers', 21,   995.0,  124.0),
  ('cobb_500', 'broilers', 22,  1087.0,  130.0),
  ('cobb_500', 'broilers', 23,  1172.0,  136.0),
  ('cobb_500', 'broilers', 24,  1260.0,  141.0),
  ('cobb_500', 'broilers', 25,  1350.0,  147.0),
  ('cobb_500', 'broilers', 26,  1441.0,  152.0),
  ('cobb_500', 'broilers', 27,  1535.0,  157.0),
  ('cobb_500', 'broilers', 28,  1580.0,  162.0),
  ('cobb_500', 'broilers', 29,  1720.0,  168.0),
  ('cobb_500', 'broilers', 30,  1818.0,  173.0),
  ('cobb_500', 'broilers', 31,  1918.0,  178.0),
  ('cobb_500', 'broilers', 32,  2018.0,  183.0),
  ('cobb_500', 'broilers', 33,  2120.0,  188.0),
  ('cobb_500', 'broilers', 34,  2180.0,  193.0),
  ('cobb_500', 'broilers', 35,  2240.0,  198.0),
  ('cobb_500', 'broilers', 36,  2348.0,  203.0),
  ('cobb_500', 'broilers', 37,  2448.0,  208.0),
  ('cobb_500', 'broilers', 38,  2546.0,  212.0),
  ('cobb_500', 'broilers', 39,  2643.0,  217.0),
  ('cobb_500', 'broilers', 40,  2738.0,  221.0),
  ('cobb_500', 'broilers', 41,  2790.0,  225.0),
  ('cobb_500', 'broilers', 42,  2840.0,  229.0),
  ('cobb_500', 'broilers', 43,  2944.0,  233.0),
  ('cobb_500', 'broilers', 44,  3040.0,  237.0),
  ('cobb_500', 'broilers', 45,  3133.0,  241.0),
  ('cobb_500', 'broilers', 46,  3224.0,  245.0),
  ('cobb_500', 'broilers', 47,  3313.0,  249.0),
  ('cobb_500', 'broilers', 48,  3360.0,  252.0),
  ('cobb_500', 'broilers', 49,  3360.0,  255.0),
  ('cobb_500', 'broilers', 50,  3445.0,  258.0),
  ('cobb_500', 'broilers', 51,  3527.0,  261.0),
  ('cobb_500', 'broilers', 52,  3607.0,  264.0),
  ('cobb_500', 'broilers', 53,  3684.0,  267.0),
  ('cobb_500', 'broilers', 54,  3759.0,  270.0),
  ('cobb_500', 'broilers', 55,  3831.0,  273.0),
  ('cobb_500', 'broilers', 56,  3870.0,  275.0);

-- ── Hy-Line Brown Layer ───────────────────────────────────────────────────────
-- Source: Hy-Line International, Hy-Line Brown Management Guide (2022-2023)
-- Columns: week of age, HD production %, daily feed intake g/bird/day
INSERT INTO public.breed_standards
  (breed_name, enterprise_type, day_or_week, expected_production_pct, expected_feed_intake_g)
VALUES
  ('hy_line_brown', 'layers', 18,  2.0,  88.0),
  ('hy_line_brown', 'layers', 19, 25.0,  92.0),
  ('hy_line_brown', 'layers', 20, 65.0,  96.0),
  ('hy_line_brown', 'layers', 21, 85.0, 100.0),
  ('hy_line_brown', 'layers', 22, 92.0, 104.0),
  ('hy_line_brown', 'layers', 23, 94.0, 106.0),
  ('hy_line_brown', 'layers', 24, 95.0, 108.0),
  ('hy_line_brown', 'layers', 25, 95.0, 109.0),
  ('hy_line_brown', 'layers', 26, 95.0, 110.0),
  ('hy_line_brown', 'layers', 27, 94.5, 110.0),
  ('hy_line_brown', 'layers', 28, 94.0, 110.0),
  ('hy_line_brown', 'layers', 29, 93.5, 110.0),
  ('hy_line_brown', 'layers', 30, 93.0, 110.0),
  ('hy_line_brown', 'layers', 32, 92.0, 110.0),
  ('hy_line_brown', 'layers', 35, 90.0, 110.0),
  ('hy_line_brown', 'layers', 40, 87.0, 110.0),
  ('hy_line_brown', 'layers', 45, 84.0, 109.0),
  ('hy_line_brown', 'layers', 50, 81.0, 108.0),
  ('hy_line_brown', 'layers', 55, 78.0, 107.0),
  ('hy_line_brown', 'layers', 60, 75.0, 106.0),
  ('hy_line_brown', 'layers', 65, 72.0, 105.0),
  ('hy_line_brown', 'layers', 70, 69.0, 104.0),
  ('hy_line_brown', 'layers', 75, 65.0, 103.0),
  ('hy_line_brown', 'layers', 80, 62.0, 102.0);

-- ── ISA Brown Layer ───────────────────────────────────────────────────────────
-- Source: Hendrix Genetics ISA Brown Management Guide (2023 ed.)
INSERT INTO public.breed_standards
  (breed_name, enterprise_type, day_or_week, expected_production_pct, expected_feed_intake_g)
VALUES
  ('isa_brown', 'layers', 18,  2.0,  88.0),
  ('isa_brown', 'layers', 19, 30.0,  93.0),
  ('isa_brown', 'layers', 20, 70.0,  98.0),
  ('isa_brown', 'layers', 21, 88.0, 102.0),
  ('isa_brown', 'layers', 22, 93.0, 106.0),
  ('isa_brown', 'layers', 23, 95.0, 108.0),
  ('isa_brown', 'layers', 24, 95.0, 110.0),
  ('isa_brown', 'layers', 25, 95.0, 111.0),
  ('isa_brown', 'layers', 26, 95.0, 112.0),
  ('isa_brown', 'layers', 27, 95.0, 112.0),
  ('isa_brown', 'layers', 28, 94.0, 112.0),
  ('isa_brown', 'layers', 30, 93.0, 112.0),
  ('isa_brown', 'layers', 35, 91.0, 111.0),
  ('isa_brown', 'layers', 40, 89.0, 110.0),
  ('isa_brown', 'layers', 45, 86.0, 109.0),
  ('isa_brown', 'layers', 50, 83.0, 108.0),
  ('isa_brown', 'layers', 55, 80.0, 107.0),
  ('isa_brown', 'layers', 60, 76.0, 106.0),
  ('isa_brown', 'layers', 65, 73.0, 105.0),
  ('isa_brown', 'layers', 70, 70.0, 104.0),
  ('isa_brown', 'layers', 75, 66.0, 103.0),
  ('isa_brown', 'layers', 80, 62.0, 102.0);

-- ============================================================
-- TABLE: default_alert_thresholds
-- ============================================================
-- Maps to AlertThresholds constants in src/core/config/constants.ts.
-- The client reads these rows on first launch to pre-populate user
-- preferences; individual overrides are stored in localStorage.

CREATE TABLE IF NOT EXISTS public.default_alert_thresholds (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id     TEXT    NOT NULL,   -- Matches AlertRuleId constant key, e.g. 'layer_production_drop'
  enterprise_type   TEXT,              -- NULL = applies to all enterprise types
  threshold_value   NUMERIC NOT NULL,  -- The numeric limit; direction depends on alert_rule_id
  severity          TEXT    NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'info')),
  description       TEXT,              -- Human-readable explanation of the threshold
  UNIQUE (alert_rule_id, enterprise_type)
);
COMMENT ON TABLE public.default_alert_thresholds IS
  'Default alert engine thresholds matching constants.ts AlertThresholds object. '
  'NULL enterprise_type = threshold applies to all types.';
COMMENT ON COLUMN public.default_alert_thresholds.threshold_value IS
  'The trigger value. For pct-based thresholds this is a fraction (0.001 = 0.1%), '
  'for absolute values it is the direct unit (mg/L, days, etc.).';

INSERT INTO public.default_alert_thresholds
  (alert_rule_id, enterprise_type, threshold_value, severity, description)
VALUES
  -- ── Layer alerts ──────────────────────────────────────────────────────────
  ('layer_production_drop',   'layers',   3.0,    'high',
   'Alert when HDP% drops ≥ 3 percentage points day-over-day (min prevHDP ≥ 60%)'),

  ('layer_mortality_spike',   'layers',   0.001,  'high',
   'Alert when daily mortality ≥ 0.1% of flock AND absolute count ≥ 3 birds'),

  ('layer_feed_anomaly',      'layers',   0.20,   'medium',
   'Alert when today feed deviates ≥ 20% from 7-day rolling average'),

  -- ── Broiler alerts ────────────────────────────────────────────────────────
  ('broiler_mortality_spike', 'broilers', 0.0015, 'high',
   'Alert when daily mortality ≥ 0.15% of batch AND absolute count ≥ 3 birds'),

  ('broiler_weight_behind',   'broilers', 0.10,   'medium',
   'Alert when latest body weight sample is ≥ 10% below Ross 308 standard for that day'),

  ('broiler_near_market',     'broilers', 5.0,    'info',
   'Reminder when ≤ 5 days remain until expected end date'),

  -- ── Fish / aquaculture alerts ─────────────────────────────────────────────
  ('fish_do_critical',        'fish',     3.0,    'critical',
   'Alert when dissolved oxygen < 3.0 mg/L (fish mortality risk)'),

  ('fish_ammonia_high',       'fish',     0.5,    'high',
   'Alert when total ammonia > 0.5 mg/L'),

  ('fish_ph_min',             'fish',     6.5,    'high',
   'Alert when water pH < 6.5 (safe range: 6.5–9.0)'),

  ('fish_ph_max',             'fish',     9.0,    'high',
   'Alert when water pH > 9.0 (safe range: 6.5–9.0)'),

  ('fish_temp_min_c',         'fish',     18.0,   'high',
   'Alert when water temperature < 18°C (safe range: 18–32°C)'),

  ('fish_temp_max_c',         'fish',     32.0,   'high',
   'Alert when water temperature > 32°C (safe range: 18–32°C)'),

  -- ── Inventory alerts ──────────────────────────────────────────────────────
  ('inv_low_stock',           NULL,       0.0,    'medium',
   'Alert when current_stock ≤ reorder_point for any inventory item'),

  ('inv_projected_stockout',  NULL,       5.0,    'high',
   'Alert when projected days-remaining based on 14-day consumption rate is ≤ 5 days'),

  -- ── Operational alerts ────────────────────────────────────────────────────
  ('op_batch_nearing_end',    NULL,       7.0,    'info',
   'Alert when ≤ 7 days remain until expected_end_date of an active enterprise'),

  -- ── Financial alerts ──────────────────────────────────────────────────────
  ('fin_cost_exceeding_revenue', NULL,    0.90,   'high',
   'Alert when month-to-date expenses ≥ 90% of month-to-date income');
