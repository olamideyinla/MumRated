import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getListingBySlug, computeStarDistribution, type ReviewSort } from "@/lib/listings";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cldOgImage } from "@/lib/cloudinary";
import StarRating from "@/components/ui/StarRating";
import WhatsAppShare from "@/components/ui/WhatsAppShare";
import HelpfulButton from "@/components/ui/HelpfulButton";
import ReportModal from "@/components/ui/ReportModal";

interface Props {
  params: { slug: string };
  searchParams: { sort?: string };
}

const REVIEW_SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: "most-helpful", label: "Most helpful" },
  { value: "most-recent", label: "Most recent" },
  { value: "highest-rating", label: "Highest rating" },
  { value: "lowest-rating", label: "Lowest rating" },
];

const AGE_BAND_LABELS: Record<string, string> = {
  NEWBORN: "Newborn",
  INFANT: "Infant",
  TODDLER: "Toddler",
  PRESCHOOL: "Preschool",
  SCHOOL_AGE: "School age",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mumrated.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getListingBySlug(params.slug);
  if (!listing) return { title: "Not found, MumRated!" };

  const avg = listing.stats?.avgRating ?? 0;
  const count = listing.stats?.reviewCount ?? 0;

  // Title tuned for Nigerian search intent
  const ratingLabel = avg > 0 ? `${avg.toFixed(1)}★ · ` : "";
  const title = `${listing.name} reviews, Nigerian mums share their experience | MumRated!`;
  const desc = count > 0
    ? `${ratingLabel}${count} honest review${count !== 1 ? "s" : ""} of ${listing.name} from Nigerian mums. ${listing.description ?? ""}`.trim()
    : listing.description
      ? `${listing.description}, Read Nigerian mum reviews on MumRated.`
      : `Read Nigerian mum reviews of ${listing.name} on MumRated.`;

  // Use Cloudinary 1200×630 crop for WhatsApp/Facebook/X link previews
  const ogImageUrl = cldOgImage(listing.heroImage);

  return {
    title,
    description: desc.slice(0, 160),
    alternates: {
      canonical: `${APP_URL}/listing/${params.slug}`,
    },
    openGraph: {
      title: `${listing.name}, ${avg > 0 ? `${avg.toFixed(1)}★` : "Reviews"} | MumRated!`,
      description: desc.slice(0, 160),
      type: "website",
      url: `${APP_URL}/listing/${params.slug}`,
      images: ogImageUrl
        ? [{ url: ogImageUrl, width: 1200, height: 630, alt: listing.name }]
        : [],
      siteName: "MumRated!",
      locale: "en_NG",
    },
    twitter: {
      card: "summary_large_image",
      title: `${listing.name}, MumRated!`,
      description: desc.slice(0, 160),
      images: ogImageUrl ? [ogImageUrl] : [],
    },
  };
}

export const revalidate = 120;

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderStructuredAnswers(answers: Record<string, unknown>, type: "PRODUCT" | "SERVICE") {
  const rows: { label: string; value: string }[] = [];

  if (type === "PRODUCT") {
    if (answers.purchasedFrom) rows.push({ label: "Bought from", value: String(answers.purchasedFrom) });
    if (answers.wouldBuyAgain !== undefined) rows.push({ label: "Would buy again", value: answers.wouldBuyAgain ? "Yes" : "No" });
    if (answers.qualityRating) rows.push({ label: "Quality rating", value: `${answers.qualityRating}/5` });
  } else {
    if (answers.monthsUsed) rows.push({ label: "Months used", value: String(answers.monthsUsed) });
    if (answers.waitTime) rows.push({ label: "Wait time", value: String(answers.waitTime) });
    if (answers.wouldRecommend !== undefined) rows.push({ label: "Would recommend", value: answers.wouldRecommend ? "Yes" : "No" });
    if (answers.staffRating) rows.push({ label: "Staff rating", value: `${answers.staffRating}/5` });
    if (answers.facilityRating) rows.push({ label: "Facility rating", value: `${answers.facilityRating}/5` });
    if (answers.communicationRating) rows.push({ label: "Communication", value: `${answers.communicationRating}/5` });
  }

  if (rows.length === 0) return null;
  return (
    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
      {rows.map((r) => (
        <div key={r.label} className="flex gap-1 text-xs">
          <dt className="text-muted">{r.label}:</dt>
          <dd className="font-medium text-dark">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ListingPage({ params, searchParams }: Props) {
  const sort = (
    REVIEW_SORT_OPTIONS.find((o) => o.value === searchParams.sort)?.value ??
    "most-helpful"
  ) as ReviewSort;

  const [listing, session] = await Promise.all([
    getListingBySlug(params.slug, sort),
    auth(),
  ]);
  if (!listing) notFound();

  // Fetch which reviews the current user has already voted helpful on
  const userId = session?.user?.id ?? null;
  const isAuthenticated = !!userId;
  const votedIds = new Set<string>();
  if (userId) {
    const votes = await db.helpfulVote.findMany({
      where: { userId, reviewId: { in: listing.reviews.map((r) => r.id) } },
      select: { reviewId: true },
    });
    votes.forEach((v) => votedIds.add(v.reviewId));
  }

  const { name, type, brandOrProvider, heroImage, locationText, priceRangeNGN, description, claimStatus, category, stats, reviews } = listing;

  const avgRating = stats?.avgRating ?? 0;
  const reviewCount = stats?.reviewCount ?? 0;
  const starDist = computeStarDistribution(reviews);
  const listingUrl = `${APP_URL}/listing/${params.slug}`;
  const whatsappText = `Check out ${name} on MumRated!, ${reviewCount > 0 ? `${avgRating.toFixed(1)}★ from ${reviewCount} mum review${reviewCount !== 1 ? "s" : ""}` : "Be the first to review"}. ${listingUrl}`;

  // BreadcrumbList structured data
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${APP_URL}/` },
      { "@type": "ListItem", position: 2, name: "Browse", item: `${APP_URL}/browse` },
      { "@type": "ListItem", position: 3, name: category.name, item: `${APP_URL}/category/${category.slug}` },
      { "@type": "ListItem", position: 4, name, item: `${APP_URL}/listing/${params.slug}` },
    ],
  };

  // Schema.org JSON-LD
  const isProduct = type === "PRODUCT";
  const schemaOrg = isProduct
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        description: description ?? undefined,
        brand: brandOrProvider ? { "@type": "Brand", name: brandOrProvider } : undefined,
        offers: priceRangeNGN
          ? { "@type": "AggregateOffer", priceCurrency: "NGN", description: priceRangeNGN }
          : undefined,
        aggregateRating:
          reviewCount > 0
            ? { "@type": "AggregateRating", ratingValue: avgRating.toFixed(2), reviewCount }
            : undefined,
        review: reviews.slice(0, 5).map((r) => ({
          "@type": "Review",
          reviewRating: { "@type": "Rating", ratingValue: r.rating },
          author: {
            "@type": "Person",
            name: r.isAnonymous ? "Anonymous" : (r.user.displayName ?? "Mum"),
          },
          reviewBody: r.text,
          datePublished: r.createdAt.toISOString().split("T")[0],
        })),
      }
    : {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name,
        description: description ?? undefined,
        address: locationText ? { "@type": "PostalAddress", addressLocality: locationText } : undefined,
        aggregateRating:
          reviewCount > 0
            ? { "@type": "AggregateRating", ratingValue: avgRating.toFixed(2), reviewCount }
            : undefined,
        review: reviews.slice(0, 5).map((r) => ({
          "@type": "Review",
          reviewRating: { "@type": "Rating", ratingValue: r.rating },
          author: {
            "@type": "Person",
            name: r.isAnonymous ? "Anonymous" : (r.user.displayName ?? "Mum"),
          },
          reviewBody: r.text,
          datePublished: r.createdAt.toISOString().split("T")[0],
        })),
      };

  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="container py-8 max-w-3xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs text-muted mb-6 flex items-center gap-1.5 flex-wrap">
          <Link href="/" className="hover:text-dark">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/browse" className="hover:text-dark">Browse</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/category/${category.slug}`} className="hover:text-dark">
            {category.name}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-dark font-medium truncate" aria-current="page">{name}</span>
        </nav>

        {/* Hero */}
        <div className="card overflow-hidden mb-8">
          {heroImage && (
            <div className="relative h-56 sm:h-72 w-full bg-bgLight">
              <Image
                src={heroImage}
                alt={name}
                fill
                priority
                sizes="(max-width: 860px) 100vw, 800px"
                className="object-cover"
              />
            </div>
          )}

          <div className="p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="cat-tag">{category.name}</span>
                  {claimStatus === "CLAIMED" && (
                    <span
                      className="rounded-pill border border-verified/40 bg-verified/10 px-2 py-0.5 text-xs font-semibold text-verified cursor-help"
                      title="Identity verified, not an endorsement. Rankings are determined by mum reviews only."
                      tabIndex={0}
                    >
                      ✓ Verified
                    </span>
                  )}
                </div>
                <h1 className="font-display text-2xl font-bold text-dark">{name}</h1>
                {brandOrProvider && (
                  <p className="text-sm text-mid mt-0.5">{brandOrProvider}</p>
                )}
              </div>

              {/* WhatsApp share, listing level */}
              <WhatsAppShare text={whatsappText} label="Share" className="flex-shrink-0" />
            </div>

            {/* Rating summary */}
            {reviewCount > 0 ? (
              <div className="flex items-center gap-3 mt-4">
                <StarRating rating={avgRating} size="lg" showNumber />
                <span className="text-sm text-muted">
                  {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                </span>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted italic">No reviews yet, be the first!</p>
            )}

            {/* Details grid */}
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              {locationText && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
                    {type === "PRODUCT" ? "Where to buy" : "Location"}
                  </p>
                  <p className="text-dark">{locationText}</p>
                </div>
              )}
              {priceRangeNGN && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
                    Price range (NGN)
                  </p>
                  <p className="text-dark font-semibold">{priceRangeNGN}</p>
                  <p className="text-xs text-muted mt-0.5">
                    Currency fluctuates, verify current prices before buying.
                  </p>
                </div>
              )}
            </div>

            {description && (
              <p className="mt-4 text-sm text-mid leading-relaxed">{description}</p>
            )}

            {/* Submit review CTA */}
            <div className="mt-6 flex items-center gap-3">
              <Link
                href={`/listing/${params.slug}/review`}
                className="btn-primary text-sm py-2.5 px-5"
              >
                Share your honest take
              </Link>
            </div>
          </div>
        </div>

        {/* Star distribution chart */}
        {reviewCount > 0 && (
          <div className="card p-5 mb-6">
            <h2 className="font-display text-lg font-semibold text-dark mb-4">
              Rating breakdown
            </h2>
            <div className="space-y-2">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = starDist[star];
                const pct = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0;
                return (
                  <Link
                    key={star}
                    href={`?sort=${sort}#reviews`}
                    className="flex items-center gap-3 group"
                  >
                    <span className="w-4 text-xs text-muted text-right">{star}</span>
                    <svg
                      className="h-3.5 w-3.5 text-gold flex-shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <div className="flex-1 h-2.5 rounded-full bg-bgLight overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gold transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-xs text-muted text-right">{count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Reviews section */}
        <div id="reviews">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            <h2 className="font-display text-xl font-bold text-dark">
              {reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}` : "Reviews"}
            </h2>
            {reviewCount > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted">Sort</span>
                {REVIEW_SORT_OPTIONS.map((opt) => (
                  <Link
                    key={opt.value}
                    href={`?sort=${opt.value}#reviews`}
                    className={`rounded-pill px-3 py-1.5 text-xs font-medium transition ${
                      sort === opt.value
                        ? "bg-crimson text-white"
                        : "bg-card border border-border text-mid hover:border-crimson/40"
                    }`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-card border border-border bg-bgLight px-6 py-10 text-center">
              <p className="text-3xl mb-3" aria-hidden="true">✍️</p>
              <p className="font-semibold text-dark mb-1">No reviews yet</p>
              <p className="text-sm text-muted mb-4">
                Be the first Nigerian mum to share your honest take.
              </p>
              <Link href={`/listing/${params.slug}/review`} className="btn-primary text-sm">
                Share your honest take
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {reviews.map((review) => {
                const reviewerName = review.isAnonymous
                  ? "Anonymous mum"
                  : (review.user.displayName ?? "A mum");
                const initials = reviewerName
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const reviewUrl = `${APP_URL}/listing/${params.slug}`;
                const reviewWhatsappText = `"${review.text.slice(0, 100)}${review.text.length > 100 ? "…" : ""}", ${reviewerName} on MumRated! ${reviewUrl}`;

                return (
                  <article
                    key={review.id}
                    className="card p-5 space-y-3"
                    itemScope
                    itemType="https://schema.org/Review"
                  >
                    {/* Reviewer header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {review.user.photo && !review.isAnonymous ? (
                          <Image
                            src={review.user.photo}
                            alt={reviewerName}
                            width={40}
                            height={40}
                            className="rounded-full object-cover flex-shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-crimson text-xs font-bold text-white">
                            {initials}
                          </span>
                        )}
                        <div itemProp="author" itemScope itemType="https://schema.org/Person">
                          <p className="text-sm font-semibold text-dark flex items-center gap-1.5" itemProp="name">
                            {reviewerName}
                            {review.user.isVerified && !review.isAnonymous && (
                              <span
                                className="flex h-4 w-4 items-center justify-center rounded-full bg-verified text-[9px] font-bold text-white"
                                title="Verified Mum"
                                aria-label="Verified Mum"
                              >
                                ✓
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted">
                            {review.user.city ?? "Nigeria"}
                            {review.childAgeBandAtReview
                              ? ` · ${AGE_BAND_LABELS[review.childAgeBandAtReview]}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      {/* Review WhatsApp share */}
                      <WhatsAppShare
                        text={reviewWhatsappText}
                        label="Share this review"
                        className="flex-shrink-0 !text-xs !py-1.5 !px-3"
                      />
                    </div>

                    {/* Stars + date */}
                    <div
                      className="flex items-center gap-3"
                      itemProp="reviewRating"
                      itemScope
                      itemType="https://schema.org/Rating"
                    >
                      <meta itemProp="ratingValue" content={String(review.rating)} />
                      <StarRating rating={review.rating} size="sm" />
                      <time
                        className="text-xs text-muted"
                        dateTime={review.createdAt.toISOString()}
                        itemProp="datePublished"
                        content={review.createdAt.toISOString().split("T")[0]}
                      >
                        {formatDate(review.createdAt)}
                      </time>
                    </div>

                    {/* Review body */}
                    <p className="text-sm text-dark leading-relaxed" itemProp="reviewBody">
                      {review.text}
                    </p>

                    {/* Structured answers */}
                    {review.structuredAnswers &&
                      typeof review.structuredAnswers === "object" &&
                      renderStructuredAnswers(
                        review.structuredAnswers as Record<string, unknown>,
                        type,
                      )}

                    {/* Helpful voting + report */}
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <HelpfulButton
                        reviewId={review.id}
                        initialCount={review.helpfulCount}
                        hasVoted={votedIds.has(review.id)}
                        isAuthenticated={isAuthenticated}
                      />
                      <ReportModal
                        reviewId={review.id}
                        isAuthenticated={isAuthenticated}
                      />
                    </div>

                    {/* Provider reply, shown below the review, never above */}
                    {review.providerReply && (
                      <div className="mt-1 rounded-lg bg-bgLight border border-border px-4 py-3">
                        <p className="text-xs font-semibold text-crimson mb-1">
                          Provider response
                          {review.providerReplyAt && (
                            <span className="font-normal text-muted ml-1">
                              · {formatDate(review.providerReplyAt)}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-dark leading-relaxed">
                          {review.providerReply}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* Bottom CTA */}
          {reviewCount > 0 && (
            <div className="mt-8 rounded-card bg-bgLight border border-border px-6 py-5 text-center">
              <p className="text-sm text-muted mb-3">
                Used {name}? Share your experience with other Nigerian mums.
              </p>
              <Link href={`/listing/${params.slug}/review`} className="btn-primary text-sm">
                Share your honest take
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
