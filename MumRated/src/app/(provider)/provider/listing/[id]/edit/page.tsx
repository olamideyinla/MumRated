import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireProvider } from "@/lib/provider";
import ProviderReplyBox from "./ProviderReplyBox";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

const AGE_BAND_LABELS: Record<string, string> = {
  NEWBORN: "Newborn (0–3 mo)",
  INFANT: "Infant (3–12 mo)",
  TODDLER: "Toddler (1–3 yr)",
  PRESCHOOL: "Preschool (3–5 yr)",
  SCHOOL_AGE: "School age (5+)",
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ProviderListingEditPage({ params }: Props) {
  const { provider } = await requireProvider();

  // Confirm this listing belongs to this provider and is CLAIMED
  const listing = await db.listing.findFirst({
    where: {
      id: params.id,
      claimedByProviderId: provider.id,
      claimStatus: "CLAIMED",
    },
    include: {
      category: { select: { name: true, type: true } },
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          text: true,
          isAnonymous: true,
          childAgeBandAtReview: true,
          cityAtReview: true,
          createdAt: true,
          helpfulCount: true,
          providerReply: true,
          providerReplyAt: true,
          user: {
            select: { displayName: true, city: true, isVerified: true },
          },
        },
      },
    },
  });

  if (!listing) notFound();

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-muted mb-1">
          <a href="/provider/dashboard" className="hover:underline">
            Dashboard
          </a>{" "}
          /
        </p>
        <h1 className="font-display text-2xl font-bold text-dark">
          {listing.name}
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {listing.category.name} · {listing.type}
        </p>
      </div>

      {/* Editable fields */}
      <section className="card p-6 mb-8">
        <h2 className="font-semibold text-dark mb-5">Listing details</h2>
        <form
          action={async (formData: FormData) => {
            "use server";
            // Re-verify ownership inside the action
            const { provider: p } = await requireProvider();
            const lId = formData.get("listingId") as string;
            const owned = await db.listing.findFirst({
              where: { id: lId, claimedByProviderId: p.id, claimStatus: "CLAIMED" },
              select: { id: true },
            });
            if (!owned) return;
            await db.listing.update({
              where: { id: lId },
              data: {
                openingHours: (formData.get("openingHours") as string) || null,
                locationText: (formData.get("locationText") as string) || null,
              },
            });
            if (formData.get("websiteUrl")) {
              await db.provider.update({
                where: { id: p.id },
                data: { websiteUrl: (formData.get("websiteUrl") as string) || null },
              });
            }
            redirect(`/provider/listing/${lId}/edit?saved=1`);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="listingId" value={listing.id} />

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Opening hours
            </label>
            <input
              type="text"
              name="openingHours"
              defaultValue={listing.openingHours ?? ""}
              placeholder='e.g. "Mon–Fri 8am–6pm, Sat 10am–4pm"'
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-dark placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-crimson/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Location / where to buy
            </label>
            <input
              type="text"
              name="locationText"
              defaultValue={listing.locationText ?? ""}
              placeholder='e.g. "Lekki Phase 1, Lagos"'
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-dark placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-crimson/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Website
            </label>
            <input
              type="url"
              name="websiteUrl"
              defaultValue={provider.websiteUrl ?? ""}
              placeholder="https://"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-dark placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-crimson/30"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-lg bg-crimson text-white px-5 py-2.5 text-sm font-semibold hover:bg-crimson/90 transition-colors"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>

      {/* Reviews — read-only for provider; reply allowed */}
      <h2 className="font-display text-xl font-semibold text-dark mb-4">
        Reviews ({listing.reviews.length})
      </h2>

      <p className="text-xs text-muted mb-4 leading-relaxed">
        Reviews are written by mums and cannot be edited or removed by providers.
        You may post a single public response below each review.
      </p>

      {listing.reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bgLight px-6 py-8 text-center text-sm text-muted">
          No published reviews yet.
        </div>
      ) : (
        <div className="space-y-5">
          {listing.reviews.map((review) => {
            const reviewer = review.isAnonymous
              ? "Anonymous mum"
              : (review.user.displayName ?? "A mum");

            return (
              <div key={review.id} className="card p-5 space-y-3">
                {/* Reviewer + rating */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-dark">
                      {reviewer}
                      {review.user.isVerified && !review.isAnonymous && (
                        <span className="ml-1.5 text-[10px] bg-verified/10 text-verified px-1.5 py-0.5 rounded-full font-medium">
                          Verified Mum
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {review.cityAtReview ?? review.user.city ?? "Nigeria"}
                      {review.childAgeBandAtReview
                        ? ` · ${AGE_BAND_LABELS[review.childAgeBandAtReview]}`
                        : ""}
                      {" · "}
                      {formatDate(review.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg
                        key={i}
                        className={`h-4 w-4 ${i < review.rating ? "text-gold" : "text-border"}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>

                {/* Review text */}
                <p className="text-sm text-dark leading-relaxed">{review.text}</p>

                <p className="text-xs text-muted">
                  {review.helpfulCount} mum{review.helpfulCount !== 1 ? "s" : ""} found this helpful
                </p>

                {/* Provider reply box */}
                <ProviderReplyBox
                  reviewId={review.id}
                  existingReply={review.providerReply}
                  repliedAt={review.providerReplyAt}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
