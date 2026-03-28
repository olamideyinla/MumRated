-- ── 006_reminder_tables.sql ─────────────────────────────────────────────────
-- Daily task checklists, tasks, reminder schedules, and task templates

-- ── daily_task_checklists ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_task_checklists (
  id              UUID PRIMARY KEY,
  worker_id       UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  completion_pct  SMALLINT NOT NULL DEFAULT 0,
  generated_at    TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  UNIQUE (worker_id, date)
);

ALTER TABLE public.daily_task_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read own checklists"
  ON public.daily_task_checklists FOR SELECT
  USING (worker_id = auth.uid() OR get_user_org_id() = (
    SELECT organization_id FROM public.app_users WHERE id = worker_id
  ));

CREATE POLICY "workers manage own checklists"
  ON public.daily_task_checklists FOR ALL
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_daily_task_checklists_worker_date
  ON public.daily_task_checklists (worker_id, date);

-- ── daily_tasks ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id                      UUID PRIMARY KEY,
  checklist_id            UUID NOT NULL REFERENCES public.daily_task_checklists(id) ON DELETE CASCADE,
  type                    TEXT NOT NULL,
  title                   TEXT NOT NULL,
  description             TEXT,
  enterprise_instance_id  UUID REFERENCES public.enterprise_instances(id) ON DELETE SET NULL,
  infrastructure_id       UUID REFERENCES public.infrastructures(id) ON DELETE SET NULL,
  priority                TEXT NOT NULL DEFAULT 'recommended',
  scheduled_time          TIME,
  time_window             TEXT NOT NULL DEFAULT 'anytime',
  status                  TEXT NOT NULL DEFAULT 'pending',
  completed_at            TIMESTAMPTZ,
  completed_by            UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  linked_record_id        UUID,
  notes                   TEXT,
  sort_order              INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read tasks"
  ON public.daily_tasks FOR SELECT
  USING (
    checklist_id IN (
      SELECT id FROM public.daily_task_checklists
      WHERE worker_id = auth.uid()
         OR get_user_org_id() = (
           SELECT organization_id FROM public.app_users WHERE id = worker_id
         )
    )
  );

CREATE POLICY "workers manage own tasks"
  ON public.daily_tasks FOR ALL
  USING (
    checklist_id IN (
      SELECT id FROM public.daily_task_checklists WHERE worker_id = auth.uid()
    )
  )
  WITH CHECK (
    checklist_id IN (
      SELECT id FROM public.daily_task_checklists WHERE worker_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_daily_tasks_checklist_id
  ON public.daily_tasks (checklist_id);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_status
  ON public.daily_tasks (checklist_id, status);

-- ── reminder_schedules ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reminder_schedules (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  reminder_type   TEXT NOT NULL,
  time            TIME NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  days_of_week    JSONB NOT NULL DEFAULT '[1,2,3,4,5,6]',
  message         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reminder_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read reminder schedules"
  ON public.reminder_schedules FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "org admins manage reminder schedules"
  ON public.reminder_schedules FOR ALL
  USING (organization_id = get_user_org_id()
    AND (SELECT role FROM public.app_users WHERE id = auth.uid()) IN ('owner', 'manager'));

CREATE INDEX IF NOT EXISTS idx_reminder_schedules_org
  ON public.reminder_schedules (organization_id);

-- ── task_templates ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_templates (
  id                    UUID PRIMARY KEY,
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL DEFAULT 'other',
  infrastructure_id     UUID REFERENCES public.infrastructures(id) ON DELETE SET NULL,
  enterprise_types      JSONB NOT NULL DEFAULT '[]',
  time_window           TEXT NOT NULL DEFAULT 'anytime',
  priority              TEXT NOT NULL DEFAULT 'recommended',
  frequency             TEXT NOT NULL DEFAULT 'daily',
  specific_days         JSONB,
  assigned_worker_ids   JSONB,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status           TEXT NOT NULL DEFAULT 'synced'
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read task templates"
  ON public.task_templates FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "org admins manage task templates"
  ON public.task_templates FOR ALL
  USING (organization_id = get_user_org_id()
    AND (SELECT role FROM public.app_users WHERE id = auth.uid()) IN ('owner', 'manager', 'supervisor'));

CREATE INDEX IF NOT EXISTS idx_task_templates_org
  ON public.task_templates (organization_id);

CREATE INDEX IF NOT EXISTS idx_task_templates_active
  ON public.task_templates (organization_id, is_active);
