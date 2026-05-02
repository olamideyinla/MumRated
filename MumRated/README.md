# MumRated!

> **Say it. Rate it. Trust it.**

Nigeria's #1 mum review platform — honest, experience-based reviews on products and services, from nappies to crèches, paediatricians to baby photographers.

---

## What MumRated! is

MumRated! is a Nigeria-first reviews platform for mums, covering:

- **Products** — baby formula, nappies, prams, sterilisers, wipes, feeding gear
- **Services** — crèches, paediatricians, baby photographers, birthday vendors, home tutors, party planners

The platform's brand promise: **Say it. Rate it. Trust it.**

---

## Trust Boundary — the core principle

> *This is non-negotiable and must be reflected in every product, engineering, and business decision.*

| Rule | Detail |
|---|---|
| **Listings are always free** | Any business can exist on MumRated! — mums can review any product or service whether the provider has paid or not |
| **Claiming is paid** | The Pro plan (₦15,000/month) lets a provider respond to reviews, update their profile, and get a verified badge |
| **Visibility is never for sale** | Search result ranking is based purely on review quality and recency — no boosting, no paid placement, no "featured" slots that money can buy |
| **Reviews belong to mums** | Providers cannot delete reviews. MumRated! moderates for spam/abuse only |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS v3 (design tokens in `tailwind.config.ts`) |
| Database | PostgreSQL via Prisma ORM |
| Auth | Auth.js v5 — Google OAuth + magic-link email |
| Images | Cloudinary (review photos, logo assets) |
| Hosting | Vercel (+ preview deployments on every PR) |
| CDN | Cloudflare in front of Vercel |

---

## Design System

All design tokens are codified in `tailwind.config.ts`. Do **not** hardcode colours or spacing — use the token names.

| Token | Value | Usage |
|---|---|---|
| `crimson` | `#7B1818` | Primary brand / CTA buttons / active states |
| `crimson-dark` | `#5E1010` | Button hover state |
| `gold` | `#C9A227` | Stars / accents / gold CTA |
| `bg` | `#F5EDE0` | Page background (warm cream) |
| `bg-light` | `#FBF6EE` | Cards / nav / sidebar |
| `dark` | `#3B2010` | Primary text (dark brown) |
| `mid` | `#7A5040` | Secondary text |
| `muted` | `#A07860` | Tertiary / placeholder text |
| `border` | `#E0CEB8` | Borders / dividers |
| `verified` | `#2A6B3A` | Verified badge / success |

**Fonts:**
- `font-display` → `Playfair Display` (headings, 700/800/900)
- `font-body` → `DM Sans` (all body copy, 400–700)

---

## Folder Structure

```
src/
├── app/
│   ├── (mum)/              ← Consumer-facing routes (home, search, category, item, review, profile)
│   │   ├── layout.tsx
│   │   └── page.tsx        ← / → home
│   ├── (provider)/         ← Provider-facing routes (dashboard, claim, settings)
│   │   └── layout.tsx
│   ├── api/                ← API Route Handlers
│   ├── layout.tsx          ← Root layout (fonts, metadata, global providers)
│   └── globals.css         ← Tailwind base + design-system component classes
├── components/
│   ├── ui/                 ← Shared UI primitives (Button, Avatar, StarRating, CatTag…)
│   └── layout/             ← Structural components (NavBar, BottomNav, Sidebar, Footer)
├── lib/                    ← Utility modules (db.ts, auth.ts, cloudinary.ts)
└── types/
    └── index.ts            ← Shared TypeScript types (Review, Item, Category…)
```

---

## Running Locally

### Prerequisites

- Node.js ≥ 20
- PostgreSQL (local or a cloud instance)
- A Cloudinary account (free tier works)
- A Google OAuth app (for Auth.js)

### Setup

```bash
# 1. Clone
git clone https://github.com/olamideyinla/MumRated.git
cd MumRated

# 2. Install dependencies
npm install

# 3. Copy env file and fill in values
cp .env.example .env.local

# 4. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other commands

```bash
npm run build         # production build
npm run lint          # ESLint
npm run format        # Prettier (writes)
npm run format:check  # Prettier (check only — used in CI)
```

---

## Environment Variables

See `.env.example` for the full list with descriptions.

---

## Contributing

- All UI must match the design system — no ad-hoc colours or spacing
- No paid placement anywhere in the codebase — flag any PR that could compromise the trust boundary
- Mobile-first: build for 390px, then enhance for ≥860px
