import Link from "next/link";
import { requireProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

export default async function ProviderDashboardPage() {
  const { provider } = await requireProvider();

  const listings = provider.claimedListings;
  const totalReviews = listings.reduce(
    (sum, l) => sum + (l.stats?.reviewCount ?? 0),
    0,
  );
  const avgRating =
    listings.length > 0
      ? listings
          .filter((l) => l.stats !== null)
          .reduce((sum, l) => sum + (l.stats?.avgRating ?? 0), 0) /
          Math.max(1, listings.filter((l) => l.stats !== null).length)
      : 0;

  const tierLabels: Record<string, string> = {
    NONE: "Unclaimed",
    CLAIM: "Claim",
    CLAIM_PLUS: "Claim+",
    CLAIM_PRO: "Claim Pro",
  };
  const tier = tierLabels[provider.subscriptionTier] ?? provider.subscriptionTier;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-dark">
            {provider.businessName}
          </h1>
          <p className="text-sm text-muted mt-1">
            Plan: <span className="font-semibold text-dark">{tier}</span>
            {provider.verifiedIdentity && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                ✓ Verified
              </span>
            )}
          </p>
        </div>
        <Link
          href="/provider/billing"
          className="rounded-lg border border-crimson/30 bg-crimson/5 px-4 py-2 text-sm font-medium text-crimson hover:bg-crimson/10 transition-colors"
        >
          Manage plan
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            Claimed listings
          </p>
          <p className="text-3xl font-display font-bold text-dark">
            {listings.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            Total reviews
          </p>
          <p className="text-3xl font-display font-bold text-dark">
            {totalReviews}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            Avg rating
          </p>
          <p className="text-3xl font-display font-bold text-dark">
            {avgRating > 0 ? avgRating.toFixed(1) : "—"}
          </p>
        </div>
      </div>

      {/* Listings list */}
      <h2 className="font-display text-xl font-semibold text-dark mb-4">
        Your listings
      </h2>

      {listings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bgLight px-6 py-10 text-center">
          <p className="text-sm text-muted">No listings claimed yet.</p>
          <p className="text-xs text-muted mt-1">
            Contact us to claim your first listing.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4 flex-wrap"
            >
              <div>
                <p className="font-semibold text-dark">{listing.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {listing.claimStatus === "CLAIMED"
                    ? "✓ Verified"
                    : "⏳ Pending verification"}
                  {listing.stats && (
                    <>
                      {" · "}
                      {listing.stats.avgRating.toFixed(1)}★ (
                      {listing.stats.reviewCount} review
                      {listing.stats.reviewCount !== 1 ? "s" : ""})
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/listing/${listing.slug}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-mid hover:border-crimson/40 transition-colors"
                  target="_blank"
                >
                  View page ↗
                </Link>
                {listing.claimStatus === "CLAIMED" && (
                  <Link
                    href={`/provider/listing/${listing.id}/edit`}
                    className="rounded-lg bg-crimson text-white px-3 py-1.5 text-xs font-medium hover:bg-crimson/90 transition-colors"
                  >
                    Manage
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trust boundary notice */}
      <div className="mt-10 rounded-xl border border-border bg-bgLight px-5 py-4 text-xs text-muted leading-relaxed">
        <strong className="text-dark">About MumRated rankings</strong>
        <br />
        Listing positions in search and category pages are determined solely by
        mum reviews — not by subscription tier or claim status. Reviews cannot
        be edited or hidden by providers; moderation is handled by the MumRated
        team. This protects the integrity of every review on the platform.
      </div>
    </div>
  );
}
