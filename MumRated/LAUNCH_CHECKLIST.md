# MumRated! — Launch Checklist

> Covers the path from **soft-launch (Close Friends)** to **public launch**.
> Based on business concept Week 5–6 of section 12.4.
> Owner: Founder. Each item must be signed off before moving to the next phase.

---

## Phase 0 — Pre-Soft-Launch Blockers

These must be complete before *anyone* outside the founding team can use the platform.

### ⚖️ Legal (HARD BLOCKERS — platform cannot launch without these)

- [ ] **Terms of Use reviewed and finalised by Nigerian commercial lawyer**
  - Current file: `src/app/(mum)/terms/page.tsx`
  - Current state: PLACEHOLDER — do not launch without replacing
  - Remove `robots: { index: false }` from metadata once finalised
  - Remove the amber warning banner from the page

- [ ] **Privacy Policy reviewed and finalised by Nigerian commercial lawyer**
  - Current file: `src/app/(mum)/privacy/page.tsx`
  - Current state: PLACEHOLDER — NDPR/NDPA compliance review is mandatory
  - Key NDPR items: lawful basis, data subject rights, cross-border transfers (Supabase/Vercel/Cloudinary all USA-hosted), NITDA registration
  - Remove `robots: { index: false }` from metadata once finalised

- [ ] **Trust page reviewed by Nigerian commercial lawyer**
  - Current file: `src/app/(mum)/trust/page.tsx`
  - Current state: content complete, pending legal review
  - Focus areas: "what gets removed" section (defamation liability), "never sold" list (implied warranties)

- [ ] **Founder agreement / partnership deed signed**
  - If there are multiple founders, the agreement must be in place before public launch
  - Includes IP assignment, equity split, and decision-making authority

---

### 🔧 Technical (HARD BLOCKERS)

- [ ] **ADMIN_EMAILS configured in Vercel production environment**
  - Set `ADMIN_EMAILS=founder@mumrated.com,ops@mumrated.com` (real addresses)
  - Verify: sign in as admin, navigate to `/admin` — should see dashboard

- [ ] **All production environment variables set in Vercel**
  - See `.env.example` for the full list. Required for production:
    ```
    NEXT_PUBLIC_APP_URL=https://mumrated.com
    DATABASE_URL=         # Supabase pooler URL
    DIRECT_URL=           # Supabase direct URL
    AUTH_SECRET=          # openssl rand -base64 32
    AUTH_GOOGLE_ID=
    AUTH_GOOGLE_SECRET=
    AUTH_RESEND_KEY=
    EMAIL_FROM=noreply@mumrated.com
    CLOUDINARY_CLOUD_NAME=
    CLOUDINARY_API_KEY=
    CLOUDINARY_API_SECRET=
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
    OPENAI_API_KEY=       # required for medical claims moderation
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
    RECAPTCHA_SECRET_KEY=
    NEXT_PUBLIC_SENTRY_DSN=
    SENTRY_ORG=
    SENTRY_PROJECT=
    SENTRY_AUTH_TOKEN=    # for source map upload on deploy
    ADMIN_EMAILS=
    ```

- [ ] **Sentry configured and receiving events**
  - Install: `npm install @sentry/nextjs`
  - Verify: trigger a test error on production, confirm it appears in Sentry dashboard
  - Set up alert rule: notify Slack/email when error rate > 5 errors/min

- [ ] **Database on Supabase (production project)**
  - Region recommendation: **eu-central-1 (Frankfurt)** — closest managed AWS region to Lagos (~80–100ms vs ~180ms for us-east-1). Supabase does not currently have an African region; Frankfurt provides the best available latency for West African users.
  - Alternative: **Neon** (Frankfurt region available) for serverless scaling if Supabase free tier limits are hit.
  - Run all Prisma migrations: `npx prisma migrate deploy`
  - Verify: `npx prisma db seed` runs cleanly on the production database

- [ ] **Custom domain configured on Vercel**
  - Domain: `mumrated.com` (and `www.mumrated.com` → redirect to apex)
  - Steps:
    1. Add domain in Vercel dashboard → Settings → Domains
    2. Update DNS: `A` record → Vercel IP (or CNAME to `cname.vercel-dns.com`)
    3. Wait for SSL certificate issuance (~5 minutes)
    4. Verify: `curl -I https://mumrated.com` returns 200 with valid TLS

- [ ] **Cloudflare configured in front of Vercel**
  - Steps:
    1. Add site to Cloudflare (free tier is sufficient)
    2. Set DNS to "Proxied" (orange cloud) for `mumrated.com` and `www`
    3. SSL/TLS → set to "Full (strict)" — Vercel provides a valid cert
    4. Set up cache rules (see Cache Rules section below)
    5. Enable "Under Attack Mode" only if DDoS detected — not permanently
    6. Bot Fight Mode: **ON** (blocks scraper bots that inflate review counts)
  - **Cloudflare Cache Rules** (order matters):
    ```
    Rule 1 — No cache: /api/*
      Cache Status: Bypass
    Rule 2 — No cache: signed-in pages (cookies present)
      If cookie "__Secure-next-auth.session-token" exists → Bypass
    Rule 3 — Aggressive cache: static assets
      /_next/static/* → Cache Everything, Edge TTL 1 year
    Rule 4 — Default ISR cache: category + listing pages
      /category/* and /listing/* → Cache Everything, Edge TTL 5 min
      (Next.js ISR handles revalidation; Cloudflare respects Cache-Control)
    ```
  - Verify: `curl -I https://mumrated.com/_next/static/chunks/main.js` shows `cf-cache-status: HIT`

---

### 📊 Monitoring (should be active before soft-launch)

- [ ] **Sentry error tracking live** (see technical blockers above)

- [ ] **Uptime monitoring configured**
  - Recommended: **Better Stack** (free tier covers 10 monitors, 3-min intervals, email+Slack alerts)
  - Alternative: UptimeRobot (free, 5-min intervals)
  - Monitors to add:
    1. `https://mumrated.com/` — Home page
    2. `https://mumrated.com/listing/[a-real-slug]` — A real listing page
    3. `https://mumrated.com/api/health` — API health endpoint (create this: returns `{ ok: true }`)
  - Alert targets: founder email + team Slack channel
  - Alert thresholds: downtime > 2 min → immediate alert; downtime > 10 min → phone call

- [ ] **Create `/api/health` endpoint** (simple 200 for uptime monitor)
  - File: `src/app/api/health/route.ts`
  - Returns: `{ ok: true, timestamp: new Date().toISOString() }`

- [ ] **Sentry alert rules configured**
  - Issue alert: any new issue → notify #errors Slack channel
  - Metric alert: error rate > 10/min → notify founder + ops email
  - Performance alert: P95 LCP > 4s → notify

---

## Phase 1 — Soft-Launch (Close Friends)

Target: 10–30 trusted testers. No public promotion.

### Content gates

- [ ] **500+ seed reviews in the database**
  - Use import script: `tsx scripts/import.ts --file reviews.csv --type reviews --dry-run`
  - Confirm dry run output, then run without `--dry-run`
  - Verify: visit `/browse` and `/category/[slug]` — listings show review counts
  - Verify: `/admin/moderation` — any flagged import rows visible and ready for review

- [ ] **Seed listings cover at least 5 categories**
  - Nappies & Essentials, Baby Food & Nutrition, Crèches & Schools, Paediatricians, Baby Products
  - Each category should have ≥10 listings with ≥3 reviews each

- [ ] **At least 2 claimed (verified) listings**
  - Demonstrates the claim flow to testers
  - Tests the "Provider response" UI on listing pages

### QA checklist (run on BrowserStack or real Android device)

**Device**: Samsung Galaxy A14, Galaxy A53, or Tecno Spark — representative Nigerian mid-range
**Network**: BrowserStack "3G Fast" (~7 Mbps) or Android throttled 4G

#### Mum flows

- [ ] Sign up with Google → profile shows displayName and city prompt
- [ ] Sign in with email magic link → redirects correctly
- [ ] Edit profile (displayName, city, childAgeBand, photo upload)
- [ ] Browse homepage → categories + top listings visible
- [ ] Browse category page → listings sorted by rating
- [ ] Search for a known product → results appear
- [ ] Search for a nonexistent product → empty state + suggestions shown
- [ ] Open listing page → hero image loads, reviews visible, schema.org in source
- [ ] Submit a review (5-star + text + structured answers) → appears immediately
- [ ] Submit a review with a photo → Cloudinary URL visible in review
- [ ] Mark a review helpful → count increments
- [ ] Report a review → confirmation message shown, review still visible
- [ ] WhatsApp share button → opens WhatsApp with pre-filled text + correct URL
- [ ] Paste shared URL into WhatsApp → OG preview shows listing image + title
- [ ] View /trust, /terms, /privacy → all render without errors
- [ ] Test skip-to-content link (Tab key on first load)
- [ ] Zoom to 200% on mobile → no clipped content

#### Provider flows

- [ ] Submit provider sign-up form with listing search
- [ ] Admin: approve provider claim → provider email receives confirmation
- [ ] Provider: log in to /provider/dashboard → claimed listing visible
- [ ] Provider: edit listing (locationText, openingHours) → changes visible on public page
- [ ] Provider: add a reply to a review → "Provider response" appears below review
- [ ] Provider: edit existing reply → updated text shown
- [ ] Verify: provider cannot edit or delete the review itself

#### Admin flows

- [ ] Log in as admin, navigate to /admin → dashboard shows counts
- [ ] /admin/moderation → flagged reviews (from import) visible in Flagged tab
- [ ] Approve a review → review appears on public listing, ListingStats updated
- [ ] Remove a review with reason → review disappears from public page, audit log entry created
- [ ] /admin/listings → all listings visible, search + filter works
- [ ] Edit a listing via admin → changes visible on public page
- [ ] /admin/categories → all categories listed
- [ ] /admin/users → search a user by email
- [ ] /admin/users/[id] → suspend a user → suspended user cannot submit a review (test: try submitting → 403)
- [ ] /admin/audit-log → both moderation and claim actions visible with timestamps

#### Performance targets (all measured on throttled 4G)

- [ ] Home page: LCP < 2.5s
- [ ] Category page: LCP < 2.5s
- [ ] Listing page: LCP < 2.5s (hero image must be AVIF-served)
- [ ] Review submission flow: completion under 90s on slow connection
- [ ] Lighthouse Performance score ≥ 85 on listing page (mobile simulation)
- [ ] Lighthouse Accessibility score ≥ 90
- [ ] Lighthouse SEO score ≥ 97

---

## Phase 2 — Public Launch

Do not proceed until all Phase 0 and Phase 1 items are complete.

### Final pre-launch checklist

- [ ] Legal pages live (not placeholder) — confirmed by lawyer
- [ ] All amber warning banners removed from /terms and /privacy
- [ ] `robots: { index: false }` removed from /terms and /privacy metadata
- [ ] /trust page confirmed by lawyer

- [ ] Remove `NEXT_PUBLIC_ENABLE_WAITLIST=true` (or flip to false)
- [ ] Set `NEXT_PUBLIC_ENABLE_PROVIDER_CLAIMS=true`
- [ ] Confirm ADMIN_EMAILS are real production addresses
- [ ] Confirm EMAIL_FROM is a verified sending domain on Resend (mumrated.com)

- [ ] Google OAuth callback URL updated to production domain
  - Add `https://mumrated.com/api/auth/callback/google` in Google Cloud Console

- [ ] reCAPTCHA v3 keys updated for production domain (mumrated.com)

- [ ] Cloudinary upload preset set to `mumrated_uploads` (not auto-configure)

- [ ] Sitemap submitted to Google Search Console
  - Submit `https://mumrated.com/sitemap.xml`

- [ ] Google Search Console verified for mumrated.com

### Launch day (first 24h — founder-monitored)

- [ ] Founder monitors Sentry dashboard continuously for first 4 hours
- [ ] Founder monitors Better Stack uptime dashboard
- [ ] Keep a "rollback plan" ready: Vercel instant rollback to previous deployment
- [ ] Have database backup confirmed (Supabase automatic daily backups — verify in dashboard)
- [ ] Have a Slack/WhatsApp channel with testers for real-time bug reports

### Post-launch (first week)

- [ ] Review all FLAGGED reviews in /admin/moderation — clear the moderation queue
- [ ] Check Google Search Console for crawl errors after 3–5 days
- [ ] Review Sentry issues — fix any P0/P1 errors
- [ ] Collect performance data from real Nigerian device (Lagos 4G) using Lighthouse
- [ ] Run real-device BrowserStack test per PERFORMANCE_NOTES.md section 6

---

## Deferred to Tier 2 (post-launch)

These are explicitly deferred — they are not launch blockers.

- [ ] **Payment integration** — Paystack or Flutterwave for provider subscriptions
  - Current state: billing page shows tier comparison + `mailto:hello@mumrated.com`
  - Deferred because: legal review of subscription terms must precede payment implementation

- [ ] **Provider analytics export** (Claim Pro tier feature)

- [ ] **API access for providers** (Claim Pro tier feature)

- [ ] **Partial prerendering (Next.js 15 PPR)** — deferred pending Next.js 15 stable release

- [ ] **`g_auto` gravity on Cloudinary OG images** — noted in PERFORMANCE_NOTES.md trade-offs

- [ ] **Font subsetting** — reduce DM Sans to 400/600/700 weights (~40 KB saving)

- [ ] **NITDA registration** — required if processing ≥1,000 Nigerian data subjects/month (counsel to advise on timing)

---

## Reference

| File | Purpose |
|---|---|
| `PERFORMANCE_NOTES.md` | Performance, SEO, accessibility analysis + real-device checklist |
| `scripts/import.ts` | One-time data import (listings or reviews) |
| `src/app/(mum)/trust/page.tsx` | Public trust page |
| `src/app/(mum)/terms/page.tsx` | Terms of Use (placeholder) |
| `src/app/(mum)/privacy/page.tsx` | Privacy Policy (placeholder) |
| `sentry.client.config.ts` | Sentry browser config |
| `sentry.server.config.ts` | Sentry Node.js config |
| `sentry.edge.config.ts` | Sentry Edge runtime config |
| `src/instrumentation.ts` | Next.js instrumentation hook (loads Sentry) |
| `.env.example` | All required environment variables |
