# Changelog

All notable changes to AgriManagerX are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Planned
- Pig and rabbit daily entry modules
- Supabase realtime sync (live multi-device updates)
- Export to WhatsApp/email sharing
- Crop activity calendar view
- Multi-language support (Swahili, French, Hausa)

---

## [0.1.0] — 2025-Q1 (Beta)

### Added

**Core PWA**
- Offline-first architecture with IndexedDB (Dexie v4)
- Service worker with Workbox — precaching all app assets
- Background sync via Web Background Sync API
- Install prompt with 7-day re-show after dismissal
- Update banner when new app version is available
- Dark mode (system / light / dark) with localStorage persistence
- Large text mode for accessibility
- Responsive desktop layout with sidebar navigation

**Auth**
- Email/password sign-up and sign-in
- Phone OTP authentication
- Forgot password (email reset)
- 3-step sign-up wizard (name/phone → farm type → password)
- Role-based access (Owner, Manager, Supervisor, Worker, Viewer)

**Farm Setup Wizard**
- 5-step onboarding: farm info → infrastructure → current stock → settings → summary
- GPS location capture
- Support for Layers, Broilers, Cattle, Fish, Pig, Rabbit, Crop enterprises
- Breed/variety suggestions per enterprise type

**Daily Entry**
- Layer form: eggs, mortality, feed, water, temperature
- Broiler form: mortality, feed, weight sampling
- Cattle form: milk yield, feed, births/deaths
- Fish form: feed, mortality, water quality parameters
- Crop activity form: planting, irrigation, spraying, harvesting
- Generic animal form for pig, rabbit, and custom species
- Grid entry mode for bulk data entry across multiple enterprises
- Automatic inventory consumption tracking on save

**Dashboard**
- Today's entry status per enterprise
- Key metrics: HDP%, FCR, milk yield, fish survival
- Monthly financial summary
- Alert badges with critical/high count
- Pull-to-refresh
- Pending sync indicator

**Inventory**
- Stock tracking with reorder points
- Movements log (in/out/adjustment) with date and type filters
- Virtualised transaction list for performance
- Low stock alerts
- CSV export
- Feed consumption automatically deducted on daily entry save

**Financials**
- Income and expense recording
- 6-month income vs expense bar chart
- Expense breakdown pie chart (current month)
- Enterprise profitability table
- Accounts receivable tracking
- Virtualised transaction list

**Reports** (5 types)
- Batch Completion Report
- Cross-Enterprise Comparison
- Farm P&L
- Cash Flow Statement
- Inventory Status
- Export as CSV or PDF (jsPDF + AutoTable)

**Alerts**
- Rule-based alert engine (checks every 30 minutes)
- Alert types: HDP drop, high mortality, low stock, FCR deviation, low weight gain
- Browser push notifications for critical/high alerts
- Per-rule enable/disable in settings
- Dismiss and mark-read actions
- Alert badges in bottom nav and dashboard

**Decision Support Tools**
- Broiler sell calculator (FCR vs market price optimiser)
- Layer depletion analyser (optimal replacement timing)
- Batch planner (stocking density + resource planning)
- Benchmark tool (compare against standard curves)
- Planning calendar

**Enterprise Detail**
- 4-tab view: Overview | Records | Analysis | Financial
- Species-specific overview (layer KPIs, broiler growth curve, fish water quality, cattle production)
- Ross 308 and Lohmann Brown standard curve overlays
- Batch comparison (current vs previous)
- CSV export of records

**Sync**
- Supabase sync for all 8 record types
- Sync status indicator in top bar
- Manual sync trigger
- Pending count shown in navigation

**Team Management**
- Invite members by email
- Assign roles and farm location access
- Activity log for owner/manager review

**Infrastructure**
- Sentry error tracking (production + staging)
- Plausible privacy-first analytics
- GitHub Actions CI/CD (lint + typecheck + test + build on every PR)
- Vercel deployment with automatic preview URLs
- Lighthouse CI on staging deploy (accessibility > 90, best-practices > 90)
- Chunk splitting for efficient caching (vendor-react, vendor-charts, vendor-supabase, etc.)
- Bundle visualiser (`npm run build:analyze`)

---

[Unreleased]: https://github.com/your-org/agri-manager/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/agri-manager/releases/tag/v0.1.0
