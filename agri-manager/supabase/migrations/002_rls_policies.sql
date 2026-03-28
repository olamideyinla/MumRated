-- ── Migration 002: RLS Policies for multi-user role-based access ──────────────
-- Run after 001_initial_schema.sql
-- Enforces at the database level the same access model defined in
-- src/core/services/permissions.ts (client-side checks are UX only;
-- these policies are the last line of defense).

-- ── Helper function: get current user's role ──────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role
  FROM app_users
  WHERE id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;

-- ── Helper function: get current user's organization ─────────────────────────

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id
  FROM app_users
  WHERE id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;

-- ── Helper function: get current user's assigned infrastructure IDs ───────────

CREATE OR REPLACE FUNCTION get_user_infra_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT assigned_infrastructure_ids
  FROM app_users
  WHERE id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;

-- ── Helper function: get current user's assigned farm location IDs ────────────

CREATE OR REPLACE FUNCTION get_user_location_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT assigned_farm_location_ids
  FROM app_users
  WHERE id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;

-- ── Helper: check if user can access a given enterprise instance ──────────────

CREATE OR REPLACE FUNCTION user_can_access_enterprise(p_enterprise_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM enterprise_instances ei
    JOIN infrastructures inf ON inf.id = ei.infrastructure_id
    JOIN farm_locations fl ON fl.id = inf.farm_location_id
    JOIN app_users au ON au.id = auth.uid()
    WHERE ei.id = p_enterprise_id
      AND au.organization_id = fl.organization_id
      AND au.is_active = TRUE
      AND (
        au.role IN ('owner')
        OR (
          au.role = 'manager' AND (
            array_length(au.assigned_farm_location_ids, 1) IS NULL
            OR fl.id = ANY(au.assigned_farm_location_ids)
          )
        )
        OR (
          au.role IN ('supervisor', 'worker') AND
          inf.id = ANY(au.assigned_infrastructure_ids)
        )
        OR au.role = 'viewer'
      )
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ORGANIZATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (id = get_user_org_id());

CREATE POLICY "org_update" ON organizations
  FOR UPDATE USING (id = get_user_org_id() AND get_user_role() IN ('owner', 'manager'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- APP USERS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Everyone in an org can see other team members (needed for assignment UI)
CREATE POLICY "users_select" ON app_users
  FOR SELECT USING (organization_id = get_user_org_id());

-- Only owner can insert new members
CREATE POLICY "users_insert" ON app_users
  FOR INSERT WITH CHECK (
    organization_id = get_user_org_id()
    AND get_user_role() = 'owner'
  );

-- Owner can update anyone; others can update only themselves
CREATE POLICY "users_update" ON app_users
  FOR UPDATE USING (
    organization_id = get_user_org_id()
    AND (get_user_role() = 'owner' OR id = auth.uid())
  );

-- Owner can deactivate members (no hard deletes)
CREATE POLICY "users_delete" ON app_users
  FOR DELETE USING (
    organization_id = get_user_org_id()
    AND get_user_role() = 'owner'
    AND id <> auth.uid()  -- cannot delete yourself
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- FARM LOCATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE farm_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_select" ON farm_locations
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      get_user_role() IN ('owner', 'viewer')
      OR (
        get_user_role() = 'manager' AND (
          array_length(get_user_location_ids(), 1) IS NULL
          OR id = ANY(get_user_location_ids())
        )
      )
      OR (
        get_user_role() IN ('supervisor', 'worker') AND
        id IN (
          SELECT farm_location_id FROM infrastructures
          WHERE id = ANY(get_user_infra_ids())
        )
      )
    )
  );

CREATE POLICY "locations_write" ON farm_locations
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- INFRASTRUCTURES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE infrastructures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "infra_select" ON infrastructures
  FOR SELECT USING (
    farm_location_id IN (
      SELECT id FROM farm_locations WHERE organization_id = get_user_org_id()
    )
    AND (
      get_user_role() IN ('owner', 'viewer')
      OR (
        get_user_role() = 'manager' AND (
          array_length(get_user_location_ids(), 1) IS NULL
          OR farm_location_id = ANY(get_user_location_ids())
        )
      )
      OR (
        get_user_role() IN ('supervisor', 'worker') AND
        id = ANY(get_user_infra_ids())
      )
    )
  );

CREATE POLICY "infra_write" ON infrastructures
  FOR ALL USING (
    farm_location_id IN (
      SELECT id FROM farm_locations WHERE organization_id = get_user_org_id()
    )
    AND get_user_role() IN ('owner', 'manager')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENTERPRISE INSTANCES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE enterprise_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enterprise_select" ON enterprise_instances
  FOR SELECT USING (user_can_access_enterprise(id));

CREATE POLICY "enterprise_write" ON enterprise_instances
  FOR INSERT WITH CHECK (
    get_user_role() IN ('owner', 'manager')
    AND infrastructure_id IN (
      SELECT id FROM infrastructures
      WHERE farm_location_id IN (
        SELECT id FROM farm_locations WHERE organization_id = get_user_org_id()
      )
    )
  );

CREATE POLICY "enterprise_update" ON enterprise_instances
  FOR UPDATE USING (
    user_can_access_enterprise(id)
    AND get_user_role() IN ('owner', 'manager', 'supervisor')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- DAILY RECORD TABLES (apply same pattern to all 8 types)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'layer_daily_records',
    'broiler_daily_records',
    'cattle_daily_records',
    'fish_daily_records',
    'pig_daily_records',
    'rabbit_daily_records',
    'custom_animal_daily_records',
    'crop_activity_records'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (user_can_access_enterprise(enterprise_instance_id))',
      'records_select_' || tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (
        user_can_access_enterprise(enterprise_instance_id)
        AND get_user_role() IN (''owner'', ''manager'', ''supervisor'', ''worker'')
      )',
      'records_insert_' || tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (
        user_can_access_enterprise(enterprise_instance_id)
        AND get_user_role() IN (''owner'', ''manager'', ''supervisor'')
      )',
      'records_update_' || tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (
        user_can_access_enterprise(enterprise_instance_id)
        AND get_user_role() IN (''owner'', ''manager'')
      )',
      'records_delete_' || tbl, tbl
    );
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- INVENTORY ITEMS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_items_select" ON inventory_items
  FOR SELECT USING (organization_id = get_user_org_id());

CREATE POLICY "inv_items_write" ON inventory_items
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- INVENTORY TRANSACTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_tx_select" ON inventory_transactions
  FOR SELECT USING (
    inventory_item_id IN (
      SELECT id FROM inventory_items WHERE organization_id = get_user_org_id()
    )
  );

CREATE POLICY "inv_tx_write" ON inventory_transactions
  FOR INSERT WITH CHECK (
    inventory_item_id IN (
      SELECT id FROM inventory_items WHERE organization_id = get_user_org_id()
    )
    AND get_user_role() IN ('owner', 'manager')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- FINANCIAL TRANSACTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_select" ON financial_transactions
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "financial_write" ON financial_transactions
  FOR INSERT WITH CHECK (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "financial_update" ON financial_transactions
  FOR UPDATE USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "financial_delete" ON financial_transactions
  FOR DELETE USING (
    organization_id = get_user_org_id()
    AND get_user_role() = 'owner'
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTACTS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select" ON contacts
  FOR SELECT USING (organization_id = get_user_org_id());

CREATE POLICY "contacts_write" ON contacts
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'manager')
  );
