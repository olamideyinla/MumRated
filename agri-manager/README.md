# AgriManagerX

**Offline-first agricultural operations manager for smallholder farmers.**

AgriManagerX is a Progressive Web App (PWA) that runs in any modern browser and installs on any phone — no app store required. It works fully offline, syncing data to the cloud whenever connectivity is available.

---

## Features

- **Daily data entry** — Layers, broilers, cattle, fish, pigs, crops
- **Dashboard** — At-a-glance KPIs, alerts, and sync status
- **Inventory** — Stock levels, reorder alerts, consumption tracking
- **Financials** — Income, expenses, enterprise profitability
- **Reports** — Batch completion, farm P&L, cash flow, inventory status
- **Alerts** — Rule-based alerts with push notifications
- **Offline-first** — All data stored locally in IndexedDB; syncs when online
- **Multi-role** — Owner, Manager, Supervisor, Worker, Viewer roles
- **Dark mode** — System, light, or dark theme

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Browser / PWA              │
│                                         │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │  React   │  │  Service Worker      │ │
│  │  UI      │  │  (Workbox + cache)   │ │
│  └────┬─────┘  └──────────────────────┘ │
│       │                                 │
│  ┌────▼─────────────────────────────┐   │
│  │  Dexie (IndexedDB)               │   │
│  │  Local-first, always available   │   │
│  └────┬─────────────────────────────┘   │
│       │ Background sync                 │
└───────┼─────────────────────────────────┘
        │
   ┌────▼────┐
   │Supabase │  (Auth + Postgres + Realtime)
   └─────────┘
```

**Key design decisions:**
- All writes go to IndexedDB first; Supabase sync runs in the background
- `syncStatus: 'pending' | 'synced'` on every record tracks what needs upload
- Service worker caches all app assets + recent API responses for offline use
- No server-side rendering — pure SPA, deployable to any CDN

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, TypeScript, Tailwind CSS 3 |
| Routing | React Router v7 |
| State | Zustand v5 |
| Forms | React Hook Form v7 + Zod v4 |
| Charts | Recharts v3 |
| Local DB | Dexie v4 (IndexedDB) |
| Backend | Supabase (Auth + Postgres) |
| PWA | Vite Plugin PWA + Workbox 7 |
| Build | Vite 8, esbuild |
| Testing | Vitest + Testing Library |
| Error tracking | Sentry |
| Analytics | Plausible (privacy-first, no cookies) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local backend)

### Installation

```bash
git clone https://github.com/your-org/agri-manager.git
cd agri-manager
npm install
```

### Environment setup

```bash
cp .env.example .env.development
```

Edit `.env.development` and fill in your Supabase credentials.

**Option A — Use a hosted Supabase project (easiest):**
1. Create a free project at [supabase.com](https://supabase.com)
2. Copy the Project URL and anon key from Settings → API
3. Paste into `.env.development`

**Option B — Run Supabase locally:**
```bash
npx supabase start          # starts local Postgres + Auth + Studio
npx supabase db push        # applies migrations from supabase/migrations/
```
The local anon key is printed on `supabase start` — it's also pre-filled in `.env.development`.

### Run dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in Chrome.

**Mobile testing on the same Wi-Fi network:**
```bash
# Vite prints a Network URL like http://192.168.1.x:5173
# Open that URL on your phone
```

---

## Project Structure

```
src/
├── core/
│   ├── config/         # env.ts, supabase.ts
│   ├── database/       # Dexie schema, hooks
│   ├── services/       # analytics, alert-engine, csv-export, pdf-export, sync
│   └── sync/           # sync-engine, sync-triggers
├── features/
│   ├── auth/           # Welcome, SignIn, SignUp, ForgotPassword
│   ├── dashboard/      # DashboardPage + providers
│   ├── daily-entry/    # Entry forms (layer, broiler, cattle, fish, crop…)
│   ├── enterprises/    # Enterprise list + detail tabs
│   ├── farm-setup/     # Onboarding wizard (5 steps)
│   ├── financials/     # FinancialsPage, AR, forms
│   ├── inventory/      # InventoryPage, item detail, forms
│   ├── reports/        # ReportsPage, config, view, generators
│   ├── alerts/         # AlertsPage, settings
│   ├── decision-support/ # Calculators and planners
│   └── settings/       # MorePage, team, activity log, data management
├── shared/
│   ├── components/     # ErrorBoundary, EmptyState, Skeleton, Toast…
│   ├── hooks/          # useDebounce
│   ├── layouts/        # MobileShell (shell + sidebar)
│   └── types/          # Shared TypeScript types
└── stores/             # Zustand: auth-store, ui-store
```

---

## Testing

```bash
npm test                # run all tests once
npm run test:watch      # watch mode for development
npm run test:coverage   # generate coverage report
```

Test files live next to the code they test in `__tests__/` directories.

---

## Building

```bash
# Standard build (tsc + vite, development config)
npm run build

# Staging build (no type-check, reads .env.staging)
npm run build:staging

# Production build (reads .env.production)
npm run build:production

# Bundle analysis — opens dist/stats.html with treemap
npm run build:analyze

# Preview the production build locally
npm run preview
```

---

## Deploying to Vercel (Option A — Recommended)

### First-time setup

1. Install the Vercel CLI: `npm i -g vercel`
2. Link the project: `vercel link`
3. Set environment variables in the Vercel dashboard:

| Variable | Where to get it |
|----------|----------------|
| `VITE_SUPABASE_URL` | Supabase project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase project Settings → API |
| `VITE_ENV` | Set to `production` |
| `VITE_APP_VERSION` | Match `package.json` version |
| `VITE_SENTRY_DSN` | Sentry project Settings → Client Keys |
| `VITE_PLAUSIBLE_DOMAIN` | Your domain (e.g. `agrimanager.app`) |

4. Deploy: `vercel deploy --prod`

### CI/CD (GitHub Actions)

Add these secrets to your GitHub repository (Settings → Secrets):

| Secret | Value |
|--------|-------|
| `VERCEL_TOKEN` | From vercel.com/account/tokens |
| `VERCEL_ORG_ID` | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |
| `STAGING_SUPABASE_URL` | Your staging Supabase URL |
| `STAGING_SUPABASE_ANON_KEY` | Your staging anon key |
| `PROD_SUPABASE_URL` | Your production Supabase URL |
| `PROD_SUPABASE_ANON_KEY` | Your production anon key |
| `SENTRY_DSN` | Sentry DSN |
| `LHCI_GITHUB_APP_TOKEN` | From Lighthouse CI GitHub App |

**Workflow summary:**
- Every PR → CI (lint + typecheck + test + build)
- Push to `main` → deploy staging preview + Lighthouse audit
- Tag `v*` → deploy to production + create GitHub release

```bash
# To trigger a production deploy:
git tag v0.1.0
git push origin v0.1.0
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `VITE_ENV` | No | `development` \| `staging` \| `production` |
| `VITE_APP_VERSION` | No | Shown in Sentry releases |
| `VITE_SENTRY_DSN` | No | Enables error tracking |
| `VITE_PLAUSIBLE_DOMAIN` | No | Enables privacy-first analytics |

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make changes and add tests
3. Run `npm test` and `npm run typecheck` — both must pass
4. Submit a pull request against `main`

Please follow the existing code style (TypeScript strict, no `any`, functional components).

---

## License

MIT — see [LICENSE](LICENSE) for details.
