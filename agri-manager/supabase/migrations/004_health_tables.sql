-- ── Health Protocols ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.health_protocols (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  enterprise_type TEXT NOT NULL,
  events          JSONB NOT NULL DEFAULT '[]',
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Scheduled Health Events ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scheduled_health_events (
  id                     UUID PRIMARY KEY,
  enterprise_instance_id UUID NOT NULL REFERENCES public.enterprise_instances(id) ON DELETE CASCADE,
  protocol_id            UUID REFERENCES public.health_protocols(id) ON DELETE SET NULL,
  protocol_event_id      TEXT,
  name                   TEXT NOT NULL,
  event_type             TEXT NOT NULL,
  scheduled_date         DATE NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'upcoming',
  product                TEXT,
  dosage                 TEXT,
  route                  TEXT,
  completed_date         DATE,
  completed_by           TEXT,
  batch_number           TEXT,
  notes                  TEXT,
  sync_status            TEXT NOT NULL DEFAULT 'synced',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_health_protocols_org
  ON public.health_protocols(organization_id);

CREATE INDEX IF NOT EXISTS idx_health_protocols_type
  ON public.health_protocols(enterprise_type);

CREATE INDEX IF NOT EXISTS idx_health_events_enterprise
  ON public.scheduled_health_events(enterprise_instance_id);

CREATE INDEX IF NOT EXISTS idx_health_events_date
  ON public.scheduled_health_events(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_health_events_status
  ON public.scheduled_health_events(status);

-- ── Updated-at triggers ───────────────────────────────────────────────────────

SELECT create_updated_at_trigger('health_protocols');
SELECT create_updated_at_trigger('scheduled_health_events');

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.health_protocols       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_health_events ENABLE ROW LEVEL SECURITY;

-- Health protocols: accessible by organization members
CREATE POLICY "org_access_health_protocols"
  ON public.health_protocols
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Scheduled health events: accessible by org members via enterprise -> infra -> location -> org chain
CREATE POLICY "org_access_health_events"
  ON public.scheduled_health_events
  USING (
    enterprise_instance_id IN (
      SELECT ei.id
      FROM   public.enterprise_instances ei
      JOIN   public.infrastructures      i  ON ei.infrastructure_id = i.id
      JOIN   public.farm_locations       fl ON i.farm_location_id   = fl.id
      WHERE  fl.organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    enterprise_instance_id IN (
      SELECT ei.id
      FROM   public.enterprise_instances ei
      JOIN   public.infrastructures      i  ON ei.infrastructure_id = i.id
      JOIN   public.farm_locations       fl ON i.farm_location_id   = fl.id
      WHERE  fl.organization_id = public.get_user_org_id()
    )
  );
