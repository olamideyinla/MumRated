-- Fix: allow a worker to re-read their own invite after redemption
-- (needed for re-install / new device sign-in scenarios)

DROP POLICY IF EXISTS "invite_select" ON public.team_invites;

CREATE POLICY "invite_select"
  ON public.team_invites FOR SELECT
  TO authenticated
  USING (
    (redeemed_at IS NULL AND expires_at > NOW())   -- unredeemed, valid invite
    OR redeemed_by = auth.uid()                    -- worker re-reading their own redeemed invite
  );
