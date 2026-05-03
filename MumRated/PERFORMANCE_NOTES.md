# MumRated! — Performance, SEO & Accessibility Notes

> Covers the work done in the Prompt 8 pass against business concept section 12.
> Last updated: 2026-05-03

---

## 1. Performance

### What was optimised

#### 1.1 Image format (biggest win)
`next.config.mjs` now explicitly requests AVIF first, WebP as fallback:
```js
formats: ["image/avif", "image/webp"]
```
Next.js negotiates via the `Accept` header — no client JavaScript involved.
AVIF typically delivers **40–50% smaller files** than WebP at equal perceived quality,
and WebP delivers ~30% smaller than JPEG. On a 4G connection this directly cuts LCP.

#### 1.2 Cloudinary URL optimisation (`src/lib/cloudinary.ts`)
Three new helpers added alongside the existing upload utility:

| Helper | Purpose |
|---|---|
| `cldOptimise(url)` | Injects `f_auto,q_auto` for `<img>` tags / CSS |
| `cldOgImage(url)` | Returns 1200×630 JPEG crop for OG/social previews |
| `cldThumb(url, w)` | Width-constrained thumbnail for known display sizes |

**OG images** now pass through `cldOgImage` before being written into
`openGraph.images` in `generateMetadata`. This ensures WhatsApp, Facebook, and X
receive a properly-sized 1200×630 JPEG (not the raw upload, which could be a 4MB PNG).

#### 1.3 Responsive image sizes
`deviceSizes: [390, 430, 768, 1024, 1280]` and `imageSizes: [48, 96, 200, 400, 800]`
are tuned for mobile-first. The default Tailwind breakpoints were removed and replaced
with sizes matching the actual component `sizes` prop values. This prevents the image
optimiser generating unused variants (e.g. a 1920-wide version for a 400px card).

#### 1.4 Lazy loading
- `ListingCard` hero images: `loading="lazy"` added. Cards below the fold were
  previously loaded eagerly, wasting bandwidth on pages with 6–18 cards.
- Listing page hero: retains `priority` (it is the LCP element).
- User avatar photos on the home page review stream: migrated from `<img>` to
  `<Image>` with `loading="lazy"` and `cldOptimise()`.

#### 1.5 Cache TTL
`minimumCacheTTL: 604800` (7 days). Listing images rarely change after creation;
the long TTL avoids redundant origin fetches from the Next.js image CDN.

#### 1.6 Response compression
`compress: true` added to `next.config.mjs`. Enables gzip on HTML/JSON responses
from the Node.js runtime (Vercel handles this at edge level, but this ensures it
works when testing locally with `next start`).

#### 1.7 Prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
Added to `globals.css`. This prevents the hover scale animation on listing card
images from firing for users with vestibular disorders — a Lighthouse opportunity
item and a WCAG 2.3.3 consideration.

---

### LCP analysis

**LCP element on `/listing/[slug]`:** the hero image (`<Image priority>`)
**LCP element on `/browse` and `/category/[slug]`:** the H1 text (no image above fold)
**LCP element on home (`/`):** the H1 "Real reviews from real Nigerian mums"

The listing hero was already marked `priority` (eliminates render-blocking preload gap).
With AVIF enabled, a typical 800px-wide hero at q_auto:good is ~60–100 KB vs ~200–250 KB
for the equivalent JPEG — a **60% reduction** that directly cuts LCP on 4G.

**Estimated total page weight on `/listing/[slug]` (4G throttle):**

| Asset | Before | After |
|---|---|---|
| HTML + inline JSON-LD | ~12 KB | ~14 KB (+2 KB schema) |
| CSS (Tailwind, minified+gzip) | ~18 KB | ~18 KB |
| JS (shared bundles, gzip) | ~87 KB | ~87 KB |
| Hero image (800px wide) | ~220 KB JPEG | ~80 KB AVIF |
| Font files (DM Sans + Playfair, incremental) | ~50 KB | ~50 KB |
| **Total** | **~387 KB** | **~249 KB** |

Well under the 500 KB target.

---

### Trade-offs

1. **AVIF encoding is slower** than WebP on the Next.js image server. The
   `minimumCacheTTL: 604800` mitigates this — each unique size/format combination
   is encoded once and cached. Cold-start latency on first request to a new image
   variant may be ~200–500ms above baseline; not visible to repeat visitors.

2. **Cloudinary `cldOgImage` crops to 1200×630 with `c_fill`** — this means the
   centre of portrait images may be cropped. If providers upload tall product shots
   the OG preview might clip important content. Future work: add `g_auto` (subject
   detection gravity) to the OG transform.

3. **`deviceSizes` narrowing** — removing very large breakpoints (1440, 1920)
   means desktop users with 4K screens will get a 1280px image upscaled. For a
   review platform primarily used on mobile this is an acceptable trade-off; most
   listing images are product shots that look fine at 1280px.

---

## 2. SEO

### Sitemap (`/sitemap.xml`)

`src/app/sitemap.ts` dynamically generates entries for:
- Static routes: `/`, `/browse`, `/sign-in`
- All categories (`/category/[slug]`)
- All active listings (`/listing/[slug]`, `lastModified` from `Listing.updatedAt`)

`revalidate = 3600` — re-generated at most once per hour.
Cache-Control in `next.config.mjs` sets `s-maxage=3600, stale-while-revalidate=86400`.

### Robots (`/robots.txt`)

Disallows crawling of `/admin/`, `/provider/*`, `/api/`, and `/sign-in/check-email`.
Points crawlers to `/sitemap.xml`.

### Schema.org markup

| Page | Schema type | Notes |
|---|---|---|
| Home | `WebSite` + `SearchAction` | Enables Google Sitelinks search box |
| Category | `BreadcrumbList` | 3-level: Home → Browse → Category |
| Listing (product) | `Product` + `AggregateRating` + `Review[]` + `BreadcrumbList` | |
| Listing (service) | `LocalBusiness` + `AggregateRating` + `Review[]` + `BreadcrumbList` | |

The `Product` and `LocalBusiness` schemas were already present from earlier prompts.
This pass added `WebSite`/`SearchAction` on the home page and `BreadcrumbList` on
both category and listing pages.

### Page titles and meta descriptions

Titles and descriptions rewritten for Nigerian search intent:

| Page | Before | After |
|---|---|---|
| Home | "MumRated! — Honest reviews from Nigerian mums" | "Best baby products & services in Nigeria, reviewed by mums" |
| Browse | "Browse — MumRated!" | "Browse all categories — Best baby products & services in Nigeria" |
| Category | "[Cat] reviews — MumRated!" | "Best [Cat] in Nigeria — reviewed by mums" |
| Listing | "[Name] — MumRated!" | "[Name] reviews — Nigerian mums share their experience" |

### OG / social preview

- Listing OG images now use `cldOgImage()` → 1200×630 JPEG from Cloudinary
  (before: raw upload URL, wrong dimensions for WhatsApp preview)
- `siteName: "MumRated!"` and `locale: "en_NG"` added to listing OG objects
- Twitter card images point to the same Cloudinary-optimised URL

### Canonical URLs

`alternates: { canonical }` added to category and listing pages.
Prevents duplicate-content signals from sort query parameters (`?sort=most-recent`).

---

## 3. WhatsApp share

WhatsApp share was already implemented (Prompt 2). The share text includes:
- Listing name
- Average rating (e.g. `4.3★`)
- Review count
- Canonical URL

**Link preview testing:** WhatsApp uses Open Graph metadata to render previews.
For previews to work in WhatsApp:
1. The page must be publicly accessible (not behind localhost — use a tunnel like
   `cloudflared tunnel` or `ngrok`)
2. `og:image` must be an absolute URL with HTTPS → `metadataBase` in `layout.tsx`
   ensures this. Listing pages use `cldOgImage()` which returns a full Cloudinary URL
3. WhatsApp fetches the URL once and caches it; clearing WhatsApp cache or using a
   new URL tests fresh previews

---

## 4. Accessibility

### What was fixed

1. **`maximumScale: 1` removed** from `viewport` in `src/app/layout.tsx`.
   This was a WCAG 1.4.4 (Resize Text) failure — prevented users from zooming.

2. **Skip-to-content link** added to root layout. Hidden visually (`sr-only`),
   revealed on keyboard focus (`focus:not-sr-only`). Target: `#main-content`
   on the `<main>` element in the mum layout.

3. **`lang="en-NG"`** — was `lang="en"`. Screen readers now use the correct
   Nigerian English pronunciation rules.

4. **Breadcrumb navigation:**
   - `aria-label="Breadcrumb"` on `<nav>`
   - `aria-hidden="true"` on separator `/` characters
   - `aria-current="page"` on the final (current) breadcrumb item

5. **Search forms:**
   - `role="search"` on both the home hero form and the search page form
   - `<label htmlFor>` + `id` pairing on search inputs (previously unlabelled)

6. **Focus-visible styles** added globally in `globals.css`:
   - `outline: 2px solid #7B1818` on `:focus-visible`
   - Suppressed on `:focus:not(:focus-visible)` (mouse/touch users don't see it)
   - Button component classes get explicit focus rings with offset

7. **`prefers-reduced-motion`** media query added — disables all CSS animations
   and transitions for users who opt out.

8. **`aria-hidden="true"` on decorative emoji** — already present on most; audited
   and confirmed throughout home page, browse, category, and listing pages.

### Known remaining issues (future work)

1. **Colour contrast — `text-muted` (`#A07860`) on `bg-bg` (`#F5EDE0`):**
   Computed contrast ratio is approximately 2.8:1 — below the WCAG AA threshold
   of 4.5:1 for normal text. This affects secondary text throughout the app.
   Recommended fix: darken `muted` to `#7A5540` (≈ 4.6:1 on the cream background).
   This is a design-system change requiring review with the visual designer.

2. **Form error regions:** The review submission form and sign-in form use
   client-side error states. These should include `role="alert"` or `aria-live="polite"`
   on the error container element. This is an implementation gap in each form component
   and should be addressed in a dedicated accessibility sprint.

3. **Icon buttons:** The WhatsApp share button and HelpfulButton have `aria-label`
   but their SVG icons lack explicit `role="img"`. Minor issue; screen readers
   typically ignore `aria-hidden` SVGs.

---

## 5. Lighthouse targets

The following Lighthouse scores are expected after these changes on mobile (simulated
4G, Moto G4 equivalent) — based on analysis, not measured screenshots from a real device
run (which is pending against a real Android device per section 12.2):

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Home `/` | ~88–92 | ~92–95 | 96 | 97 |
| Browse `/browse` | ~90–94 | ~92–95 | 96 | 97 |
| Category `/category/[slug]` | ~88–92 | ~92–95 | 96 | 97 |
| Listing `/listing/[slug]` | ~85–90* | ~90–94 | 96 | 98 |

*The listing page Performance score is lower because it includes the most JS
(HelpfulButton + ReportModal are client components) and the hero image, which
varies by listing.

### Factors that could push scores above 90 on listing pages

1. **Hero image LCP:** If the provider has uploaded a high-resolution PNG, even with
   AVIF conversion it may exceed 150 KB. Adding `w_800` to the `priority` Image's
   effective Cloudinary URL would cap it. Currently Next.js handles the resize but
   the Cloudinary URL is passed through un-transformed.

2. **Font subsetting:** DM Sans loads weights 300–700 (5 weights). Reducing to
   400, 600, and 700 would save ~40 KB of font data. Requires visual QA to confirm
   no text uses 300 or 500 weight.

3. **React hydration cost:** The shared JS bundle is 87 KB. This is typical for
   Next.js App Router with Auth.js. Partial prerendering (Next.js 15 / PPR) would
   defer hydration of the interactive review widgets, improving TBT.

---

## 6. Real-device testing checklist (section 12.2)

Section 12.2 mandates real-device testing, not just simulators.

**Setup:**
- Device: mid-range Android (e.g. Samsung A14, Tecno Spark, or BrowserStack
  Galaxy A53 profile)
- Network: actual 4G throttled to 12 Mbps down / 3 Mbps up (simulate with
  Android Developer Options → Mobile data always active + throttle app)
- Tunnel: `npx cloudflared tunnel` or `ngrok http 3000` for localhost testing

**Checklist:**
- [ ] Navigate to `/`, `/browse`, `/category/[slug]`, `/listing/[slug]` on device
- [ ] Measure LCP using Chrome DevTools remote debug (chrome://inspect)
- [ ] Run Lighthouse from desktop Chrome pointing at tunnel URL
- [ ] Open a listing URL in a real WhatsApp chat — verify OG preview shows image
- [ ] Test WhatsApp share button — confirm pre-filled text opens correctly
- [ ] Navigate entire listing page with keyboard only (Tab + Enter)
- [ ] Enable TalkBack (Android screen reader) — verify skip-to-content, breadcrumbs,
  and form labels are announced correctly
- [ ] Zoom to 200% — verify no content is clipped or overlapping

**BrowserStack alternative:**
If a real device is not available, BrowserStack Live with a Tecno Spark 8 Pro
(common Nigeria market device) provides the closest simulation. Use the "3G Fast"
network preset (approximately 7 Mbps down).
