import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getAllCategories, getRecentReviews, getTopListings } from "@/lib/listings";
import ListingCard from "@/components/ui/ListingCard";
import StarRating from "@/components/ui/StarRating";
import { cldOptimise } from "@/lib/cloudinary";

export const metadata: Metadata = {
  title: "MumRated!, Best baby products & services in Nigeria, reviewed by mums",
  description:
    "Find the best baby products, crèches, paediatricians, and family services in Nigeria. Honest reviews written by Nigerian mums, no ads, no sponsored results.",
  openGraph: {
    title: "MumRated!, Best baby products & services in Nigeria, reviewed by mums",
    description:
      "Honest reviews from Nigerian mums. Baby products, crèches, paediatricians, and more.",
    type: "website",
  },
};

const APP_URL_HOME = process.env.NEXT_PUBLIC_APP_URL ?? "https://mumrated.com";

// WebSite schema with SearchAction, enables Google's sitelinks search box
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "MumRated!",
  url: APP_URL_HOME,
  description:
    "Nigeria's mum review platform. Honest reviews of baby products and family services.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${APP_URL_HOME}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export const revalidate = 300;

// Editorial featured categories, not paid placements
const FEATURED_CATEGORIES = [
  { slug: "nappies-essentials", label: "Nappies & Essentials", icon: "🧷" },
  { slug: "baby-food-nutrition", label: "Baby Food & Nutrition", icon: "🍼" },
  { slug: "creches-schools", label: "Crèches & Schools", icon: "🏫" },
  { slug: "paediatricians", label: "Paediatric Hospitals", icon: "🏥" },
  { slug: "baby-products", label: "Baby Products", icon: "🛒" },
];

const AGE_BAND_LABELS: Record<string, string> = {
  NEWBORN: "Newborn",
  INFANT: "Infant",
  TODDLER: "Toddler",
  PRESCHOOL: "Preschool",
  SCHOOL_AGE: "School age",
};

function formatRelativeDate(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(date).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}

export default async function HomePage() {
  const [categories, recentReviews, topListings] = await Promise.all([
    getAllCategories(),
    getRecentReviews(9),
    getTopListings(6),
  ]);

  return (
    <>
      {/* WebSite schema with SearchAction, enables Google sitelinks search box */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-[#5E1010] via-crimson to-[#A02020] text-white px-4 py-14 md:py-20">
        <div className="container text-center max-w-2xl">
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Real reviews from real Nigerian mums
          </h1>
          <p className="text-white/80 text-lg mb-8 leading-relaxed">
            No ads. No sponsored results. Just honest takes from mums who&rsquo;ve been there.
          </p>
          <form role="search" action="/search" method="GET" className="flex max-w-lg mx-auto">
            <label htmlFor="hero-search" className="sr-only">Search products and services</label>
            <input
              id="hero-search"
              name="q"
              type="search"
              placeholder="Search nappies, crèches, paediatricians…"
              className="flex-1 rounded-l-input border-0 px-4 py-3 text-dark text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              autoComplete="off"
            />
            <button
              type="submit"
              className="rounded-r-input bg-gold px-5 py-3 text-sm font-bold text-dark hover:bg-[#b8901f] transition"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Featured categories */}
      <section className="section bg-bg">
        <div className="container">
          <h2 className="font-display text-xl font-bold text-dark mb-6">
            Browse by category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {FEATURED_CATEGORIES.map((cat) => {
              const dbCat = categories.find((c) => c.slug === cat.slug);
              return (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="card-sm flex flex-col items-center gap-2 p-4 text-center hover:shadow-card hover:border-gold/40 transition group"
                >
                  <span className="text-3xl" aria-hidden="true">{cat.icon}</span>
                  <span className="text-sm font-semibold text-dark group-hover:text-crimson transition leading-snug">
                    {cat.label}
                  </span>
                  {dbCat && (
                    <span className="text-xs text-muted">
                      {dbCat._count.listings}{" "}
                      {dbCat._count.listings === 1 ? "listing" : "listings"}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 text-center">
            <Link href="/browse" className="text-sm text-crimson font-medium hover:underline">
              See all categories →
            </Link>
          </div>
        </div>
      </section>

      {/* Top-rated listings */}
      {topListings.length > 0 && (
        <section className="section bg-bgLight">
          <div className="container">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-dark">
                Highest rated right now
              </h2>
              <Link href="/browse" className="text-sm text-crimson hover:underline">See all</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {topListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent reviews stream */}
      {recentReviews.length > 0 && (
        <section className="section bg-bg">
          <div className="container">
            <h2 className="font-display text-xl font-bold text-dark mb-6">
              What mums are saying
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentReviews.map((review) => {
                const name = review.isAnonymous
                  ? "Anonymous mum"
                  : (review.user.displayName ?? "A mum");
                const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

                return (
                  <Link
                    key={review.id}
                    href={`/listing/${review.listing.slug}`}
                    className="card-sm p-4 flex flex-col gap-3 hover:shadow-card transition group"
                  >
                    <div className="flex items-center gap-3">
                      {review.user.photo && !review.isAnonymous ? (
                        <Image
                          src={cldOptimise(review.user.photo) ?? review.user.photo}
                          alt={name}
                          width={36}
                          height={36}
                          className="rounded-full object-cover flex-shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-crimson text-xs font-bold text-white">
                          {initials}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-dark truncate flex items-center gap-1">
                          {name}
                          {review.user.isVerified && !review.isAnonymous && (
                            <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-verified text-[9px] font-bold text-white" title="Verified Mum">✓</span>
                          )}
                        </p>
                        <p className="text-xs text-muted">
                          {review.user.city ?? "Nigeria"}
                          {review.childAgeBandAtReview ? ` · ${AGE_BAND_LABELS[review.childAgeBandAtReview]}` : ""}
                        </p>
                      </div>
                    </div>

                    <div>
                      <StarRating rating={review.rating} size="sm" />
                      <p className="mt-1 text-xs text-muted">
                        on <span className="font-medium text-dark group-hover:text-crimson transition">{review.listing.name}</span>
                      </p>
                    </div>

                    <p className="text-sm text-dark line-clamp-3 leading-relaxed">
                      &ldquo;{review.text}&rdquo;
                    </p>

                    <p className="text-xs text-muted self-end">{formatRelativeDate(review.createdAt)}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Suggest a listing CTA */}
      <section className="section bg-bgLight border-t border-border">
        <div className="container max-w-xl text-center space-y-4">
          <p className="text-2xl" aria-hidden="true">💡</p>
          <h2 className="font-display text-xl font-bold text-dark">
            Can&rsquo;t find something?
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            Suggest a product or service. Community submissions are added within 48 hours.
            Listing here is always free.
          </p>
          <Link href="/suggest" className="btn-primary inline-flex">
            Suggest a listing
          </Link>
        </div>
      </section>
    </>
  );
}
