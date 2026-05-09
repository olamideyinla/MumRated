import Link from "next/link";
import Image from "next/image";
import StarRating from "./StarRating";

interface Props {
  listing: {
    id: string;
    slug: string;
    name: string;
    type: "PRODUCT" | "SERVICE";
    brandOrProvider: string | null;
    heroImage: string | null;
    locationText: string | null;
    priceRangeNGN: string | null;
    claimStatus: "UNCLAIMED" | "PENDING" | "CLAIMED";
    stats: { avgRating: number; reviewCount: number } | null;
    category: { name: string };
  };
}

export default function ListingCard({ listing }: Props) {
  const { slug, name, type, brandOrProvider, heroImage, locationText, priceRangeNGN, claimStatus, stats, category } = listing;
  const avgRating = stats?.avgRating ?? 0;
  const reviewCount = stats?.reviewCount ?? 0;

  return (
    <Link
      href={`/listing/${slug}`}
      aria-label={`View ${name} reviews`}
      className="card group flex gap-3 p-4 overflow-hidden hover:shadow-card-hover transition-shadow"
    >
      {/* ── Left: text content ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 gap-1">
        <span className="cat-tag self-start">{category.name}</span>

        <h3 className="font-semibold text-dark text-sm leading-snug line-clamp-2 group-hover:text-crimson transition-colors">
          {name}
        </h3>

        {brandOrProvider && (
          <p className="text-xs text-muted truncate">{brandOrProvider}</p>
        )}

        {/* Rating sits immediately below the name — highest-value info first */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {reviewCount > 0 ? (
            <>
              <StarRating rating={avgRating} size="sm" />
              <span className="text-xs font-semibold text-dark">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-xs text-muted">
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            </>
          ) : (
            <span className="text-xs text-muted italic">No reviews yet</span>
          )}
        </div>

        {/* Where to buy + price at the bottom */}
        <div className="mt-auto pt-2 space-y-0.5">
          {locationText && (
            <p className="text-xs text-muted truncate">{locationText}</p>
          )}
          {priceRangeNGN && (
            <p className="text-xs font-semibold text-dark">{priceRangeNGN}</p>
          )}
        </div>
      </div>

      {/* ── Right: compact thumbnail ────────────────────────────────── */}
      <div className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-bgLight self-start mt-0.5">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={name}
            fill
            loading="lazy"
            sizes="80px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          /* Faint MumRated stamp — works for products and services alike */
          <div className="flex h-full w-full items-center justify-center">
            <Image
              src="/logo-stamp.png"
              alt=""
              width={44}
              height={44}
              className="opacity-[0.12] object-contain"
            />
          </div>
        )}

        {/* Verified badge — repositioned to corner of thumbnail */}
        {claimStatus === "CLAIMED" && (
          <span
            className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-verified text-[8px] font-bold text-white"
            aria-label="Identity verified, not an endorsement"
          >
            ✓
          </span>
        )}
      </div>
    </Link>
  );
}
