-- ============================================================
-- 005_labor_tables.sql
-- Labor management: workers, attendance, casual labor, payroll
-- ============================================================

-- ── workers ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  phone                   TEXT,
  worker_type             TEXT NOT NULL CHECK (worker_type IN ('permanent', 'casual')),
  wage_type               TEXT NOT NULL CHECK (wage_type IN ('daily', 'monthly', 'hourly', 'per_piece')),
  wage_rate               NUMERIC(12, 2) NOT NULL DEFAULT 0,
  start_date              DATE,
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  assigned_enterprise_ids JSONB NOT NULL DEFAULT '[]',
  notes                   TEXT,
  sync_status             TEXT NOT NULL DEFAULT 'synced',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workers_org_access" ON public.workers
  USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

-- ── attendance_records ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'leave')),
  hours_worked    NUMERIC(5, 2),
  overtime_hours  NUMERIC(5, 2),
  notes           TEXT,
  recorded_by     UUID,
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_org_access" ON public.attendance_records
  USING (
    worker_id IN (
      SELECT id FROM public.workers WHERE organization_id = get_user_org_id()
    )
  )
  WITH CHECK (
    worker_id IN (
      SELECT id FROM public.workers WHERE organization_id = get_user_org_id()
    )
  );

-- ── casual_labor_entries ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.casual_labor_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  date                    DATE NOT NULL,
  enterprise_instance_id  UUID REFERENCES public.enterprise_instances(id) ON DELETE SET NULL,
  activity_description    TEXT NOT NULL,
  number_of_workers       INT NOT NULL DEFAULT 1,
  hours_per_worker        NUMERIC(5, 2) NOT NULL DEFAULT 8,
  rate_per_worker         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cost              NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method          TEXT NOT NULL DEFAULT 'cash',
  paid                    BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_by             UUID,
  notes                   TEXT,
  financial_transaction_id UUID,
  sync_status             TEXT NOT NULL DEFAULT 'synced',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.casual_labor_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casual_labor_org_access" ON public.casual_labor_entries
  USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

-- ── payroll_entries ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id                UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  period_start             DATE NOT NULL,
  period_end               DATE NOT NULL,
  days_worked              NUMERIC(6, 2) NOT NULL DEFAULT 0,
  base_pay                 NUMERIC(12, 2) NOT NULL DEFAULT 0,
  overtime_pay             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deductions               NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_pay                  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_date             DATE,
  payment_method           TEXT,
  status                   TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  notes                    TEXT,
  financial_transaction_id UUID,
  sync_status              TEXT NOT NULL DEFAULT 'synced',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_org_access" ON public.payroll_entries
  USING (
    worker_id IN (
      SELECT id FROM public.workers WHERE organization_id = get_user_org_id()
    )
  )
  WITH CHECK (
    worker_id IN (
      SELECT id FROM public.workers WHERE organization_id = get_user_org_id()
    )
  );

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workers_org_status          ON public.workers (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_worker_date      ON public.attendance_records (worker_id, date);
CREATE INDEX IF NOT EXISTS idx_casual_labor_org_date       ON public.casual_labor_entries (organization_id, date);
CREATE INDEX IF NOT EXISTS idx_payroll_worker_period       ON public.payroll_entries (worker_id, period_start, period_end);
