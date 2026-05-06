-- ============================================================================
-- Enable Row Level Security on all tables
--
-- ARCHITECTURE NOTE
-- -----------------
-- This app uses Prisma via the Supabase connection pooler as the `postgres`
-- superuser, which holds BYPASSRLS.  All server-side Prisma queries are
-- therefore completely unaffected by these policies.
--
-- RLS policies below protect against:
--   • Supabase REST API (PostgREST) accessed with the anon / service_role key
--   • Supabase Realtime subscriptions
--   • Any direct client connections using anon / authenticated JWT roles
--
-- Auth.js (NextAuth) is used for authentication — Supabase auth.uid() does
-- NOT correspond to Auth.js user IDs.  Write access for all tables is
-- therefore restricted to the server (Prisma / postgres role) exclusively.
-- ============================================================================


-- ── 0. Prisma internal table — FULLY LOCKED ──────────────────────────────
-- _prisma_migrations tracks applied migrations. No external access needed.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;


-- ── 1. Auth.js credential tables — FULLY LOCKED ──────────────────────────
-- These tables store OAuth tokens, session tokens, and magic-link tokens.
-- No external client should ever touch them directly.

ALTER TABLE "Account"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;

-- No policies = zero access for anon / authenticated roles.
-- postgres (BYPASSRLS) is unaffected.


-- ── 2. Sensitive application tables — FULLY LOCKED ───────────────────────
-- User PII, business contact details, moderation data, audit log, email list.

ALTER TABLE "User"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Provider"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HelpfulVote"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAction"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaitlistEntry" ENABLE ROW LEVEL SECURITY;

-- No policies = zero access for anon / authenticated roles.


-- ── 3. Public read-only tables ────────────────────────────────────────────
-- These tables back the public-facing pages.  Read access via the REST API
-- is acceptable and intentional.  All mutations go through the server only.

ALTER TABLE "Category"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Listing"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingStats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review"       ENABLE ROW LEVEL SECURITY;

-- Category: all rows are public
CREATE POLICY "category_anon_read"
  ON "Category"
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Listing: only ACTIVE listings are publicly visible
CREATE POLICY "listing_anon_read"
  ON "Listing"
  FOR SELECT
  TO anon, authenticated
  USING (status = 'ACTIVE');

-- ListingStats: visible only when the parent listing is ACTIVE
-- (prevents leaking stats for admin-hidden listings)
CREATE POLICY "listingstats_anon_read"
  ON "ListingStats"
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Listing" l
      WHERE l.id = "ListingStats"."listingId"
        AND l.status = 'ACTIVE'
    )
  );

-- Review: only PUBLISHED reviews are publicly visible
CREATE POLICY "review_anon_read"
  ON "Review"
  FOR SELECT
  TO anon, authenticated
  USING (status = 'PUBLISHED');

-- ── No INSERT / UPDATE / DELETE policies on any table ────────────────────
-- All writes go through Prisma (postgres role, BYPASSRLS).
-- Granting write access via REST would bypass server-side validation,
-- auth checks, and the moderation pipeline.
