-- Team Invites table
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS public.team_invites (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code                 VARCHAR(10)  NOT NULL UNIQUE,
  organization_id             UUID         NOT NULL,
  org_name                    TEXT         NOT NULL,
  org_currency                VARCHAR(5)   NOT NULL DEFAULT 'USD',
  full_name                   TEXT         NOT NULL,
  phone                       TEXT         NOT NULL,
  email                       TEXT,
  role                        TEXT         NOT NULL CHECK (role IN ('manager','supervisor','worker','viewer')),
  assigned_farm_location_ids  JSONB        NOT NULL DEFAULT '[]',
  assigned_infrastructure_ids JSONB        NOT NULL DEFAULT '[]',
  local_user_id               UUID         NOT NULL,   -- pre-created AppUser id on owner's device
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at                  TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  redeemed_at                 TIMESTAMPTZ,
  redeemed_by                 UUID                     -- Supabase auth uid of the worker who redeemed
);

-- Row-level security
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Authenticated users can INSERT (owners creating invites)
CREATE POLICY "invite_insert"
  ON public.team_invites FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can SELECT unredeemed invites (for redemption lookup)
CREATE POLICY "invite_select"
  ON public.team_invites FOR SELECT
  TO authenticated
  USING (redeemed_at IS NULL AND expires_at > NOW());

-- Authenticated users can UPDATE to mark as redeemed
CREATE POLICY "invite_update"
  ON public.team_invites FOR UPDATE
  TO authenticated
  USING (redeemed_at IS NULL)
  WITH CHECK (true);
