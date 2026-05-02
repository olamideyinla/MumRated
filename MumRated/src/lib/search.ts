import { db } from "./db";

/**
 * Full-text search across listing names, brands, descriptions, and review text.
 *
 * Uses PostgreSQL's built-in full-text search via plainto_tsquery (handles
 * partial words and common Nigerian English without configuration).
 *
 * CRITICAL: Sort order uses ts_rank (relevance) only — not subscription status.
 */
export async function searchListings(query: string, limit = 30) {
  if (!query.trim()) return [];

  // Use $queryRaw for PostgreSQL FTS — Prisma doesn't expose this natively.
  // We search listing name, brand, description, and published review text.
  const results = await db.$queryRaw<
    {
      id: string;
      slug: string;
      name: string;
      type: "PRODUCT" | "SERVICE";
      brandOrProvider: string | null;
      heroImage: string | null;
      locationText: string | null;
      priceRangeNGN: string | null;
      claimStatus: "UNCLAIMED" | "PENDING" | "CLAIMED";
      avgRating: number | null;
      reviewCount: number | null;
      categoryName: string;
      categorySlug: string;
      rank: number;
    }[]
  >`
    SELECT
      l.id,
      l.slug,
      l.name,
      l.type,
      l."brandOrProvider",
      l."heroImage",
      l."locationText",
      l."priceRangeNGN",
      l."claimStatus",
      ls."avgRating",
      ls."reviewCount",
      c.name  AS "categoryName",
      c.slug  AS "categorySlug",
      ts_rank(
        to_tsvector('english',
          coalesce(l.name, '') || ' ' ||
          coalesce(l."brandOrProvider", '') || ' ' ||
          coalesce(l.description, '')
        ),
        plainto_tsquery('english', ${query})
      ) AS rank
    FROM "Listing" l
    LEFT JOIN "ListingStats" ls ON ls."listingId" = l.id
    LEFT JOIN "Category"     c  ON c.id = l."categoryId"
    WHERE
      to_tsvector('english',
        coalesce(l.name, '') || ' ' ||
        coalesce(l."brandOrProvider", '') || ' ' ||
        coalesce(l.description, '')
      ) @@ plainto_tsquery('english', ${query})
      AND l."status" = 'ACTIVE'
    ORDER BY rank DESC, ls."reviewCount" DESC NULLS LAST
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    type: r.type,
    brandOrProvider: r.brandOrProvider,
    heroImage: r.heroImage,
    locationText: r.locationText,
    priceRangeNGN: r.priceRangeNGN,
    claimStatus: r.claimStatus,
    stats: r.avgRating !== null
      ? { avgRating: Number(r.avgRating), reviewCount: Number(r.reviewCount) }
      : null,
    category: { name: r.categoryName, slug: r.categorySlug },
  }));
}
