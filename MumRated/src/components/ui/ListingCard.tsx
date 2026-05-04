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
      className="card group flex flex-col overflow-hidden hover:shadow-card-hover transition-shadow"
    >
      {/* Hero image */}
      <div className="relative h-36 w-full bg-bgLight overflow-hidden">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={name}
            fill
            loading="lazy"
            sizes="(max-width: 600px) 100vw, (max-width: 860px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl opacity-30" aria-hidden="true">
              {type === "PRODUCT" ? "📦" : "🏥"}
            </span>
          </div>
        )}
        {/* Verified badge, identity verified, not an endorsement */}
        {claimStatus === "CLAIMED" && (
          <span
            className="absolute top-2 right-2 rounded-pill bg-verified px-2 py-0.5 text-[10px] font-bold text-white"
            title="Identity verified, not an endorsement"
          >
            ✓ Verified
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-1.5">
        <span className="cat-tag self-start">{category.name}</span>
        <h3 className="font-semibold text-dark text-sm leading-snug line-clamp-2 group-hover:text-crimson transition-colors">
          {name}
        </h3>
        {brandOrProvider && (
          <p className="text-xs text-muted">{brandOrProvider}</p>
        )}

        {/* Rating row */}
        <div className="flex items-center gap-2 mt-auto pt-2">
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

        {/* Location / where to buy */}
        {locationText && (
          <p className="text-xs text-muted truncate">{locationText}</p>
        )}

        {/* Price */}
        {priceRangeNGN && (
          <p className="text-xs font-semibold text-dark">{priceRangeNGN}</p>
        )}
      </div>
    </Link>
  );
}
