import { db } from "./db";
import type { Prisma } from "@prisma/client";

// ── Shared select shapes ────────────────────────────────────────────────────

const listingCardSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  brandOrProvider: true,
  heroImage: true,
  locationText: true,
  priceRangeNGN: true,
  claimStatus: true,
  stats: {
    select: { avgRating: true, reviewCount: true },
  },
  category: {
    select: { name: true, slug: true },
  },
} satisfies Prisma.ListingSelect;

// ── Category queries ─────────────────────────────────────────────────────────

export type SortOption = "highest-rated" | "most-reviewed" | "most-recent";

/**
 * Fetch all listings in a category, sorted by review data only.
 * CRITICAL: no subscription status influences sort order.
 */
export async function getListingsByCategory(
  categorySlug: string,
  sort: SortOption = "highest-rated",
) {
  const orderBy: Prisma.ListingOrderByWithRelationInput =
    sort === "most-reviewed"
      ? { stats: { reviewCount: "desc" } }
      : sort === "most-recent"
        ? { stats: { lastReviewAt: "desc" } }
        : // highest-rated (default)
          { stats: { avgRating: "desc" } };

  return db.listing.findMany({
    where: { category: { slug: categorySlug }, stats: { isNot: null } },
    orderBy: [orderBy, { stats: { reviewCount: "desc" } }],
    select: listingCardSelect,
  });
}

/** Fetch all categories with their listing counts. */
export async function getAllCategories() {
  return db.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { listings: true } },
    },
  });
}

/** Fetch a single category by slug. */
export async function getCategoryBySlug(slug: string) {
  return db.category.findUnique({ where: { slug } });
}

// ── Listing detail ───────────────────────────────────────────────────────────

export type ReviewSort =
  | "most-helpful"
  | "most-recent"
  | "highest-rating"
  | "lowest-rating";

/**
 * Fetch a listing by slug with full review list.
 * The review sort order determines what the user sees first — never influenced
 * by provider payment status.
 */
export async function getListingBySlug(
  slug: string,
  reviewSort: ReviewSort = "most-helpful",
) {
  const reviewOrderBy: Prisma.ReviewOrderByWithRelationInput =
    reviewSort === "most-recent"
      ? { createdAt: "desc" }
      : reviewSort === "highest-rating"
        ? { rating: "desc" }
        : reviewSort === "lowest-rating"
          ? { rating: "asc" }
          : // most-helpful (default)
            { helpfulCount: "desc" };

  return db.listing.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true, slug: true, type: true } },
      stats: true,
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: reviewOrderBy,
        include: {
          user: {
            select: {
              displayName: true,
              photo: true,
              city: true,
              isVerified: true,
            },
          },
        },
      },
    },
  });
}

/** Compute star distribution (how many 1★, 2★ … 5★) for a listing. */
export function computeStarDistribution(
  reviews: { rating: number }[],
): Record<1 | 2 | 3 | 4 | 5, number> {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<
    1 | 2 | 3 | 4 | 5,
    number
  >;
  for (const r of reviews) {
    const star = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5;
    if (star >= 1 && star <= 5) dist[star]++;
  }
  return dist;
}

// ── Home page data ───────────────────────────────────────────────────────────

/** Recent reviews for the home page stream — 12 most recent published reviews. */
export async function getRecentReviews(limit = 12) {
  return db.review.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          displayName: true,
          photo: true,
          city: true,
          isVerified: true,
        },
      },
      listing: {
        select: {
          name: true,
          slug: true,
          type: true,
          category: { select: { name: true } },
        },
      },
    },
  });
}

/** Top-rated listings (used on home hero section). */
export async function getTopListings(limit = 6) {
  return db.listing.findMany({
    where: { stats: { isNot: null } },
    orderBy: [
      { stats: { avgRating: "desc" } },
      { stats: { reviewCount: "desc" } },
    ],
    take: limit,
    select: listingCardSelect,
  });
}
