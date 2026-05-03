import { db } from "@/lib/db";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { notFound } from "next/navigation";
import { approveClaim, rejectClaim } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ProviderClaimsPage() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) notFound();

  const pending = await db.listing.findMany({
    where: { claimStatus: "PENDING" },
    include: {
      category: { select: { name: true } },
      claimedByProvider: {
        select: {
          id: true,
          businessName: true,
          contactEmail: true,
          contactPhone: true,
          websiteUrl: true,
          createdAt: true,
          subscriptionTier: true,
        },
      },
      stats: { select: { avgRating: true, reviewCount: true } },
    },
    orderBy: { updatedAt: "asc" }, // oldest first
  });

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-3xl font-bold text-dark mb-2">
        Provider Claims
      </h1>
      <p className="text-sm text-muted mb-8">
        {pending.length} pending claim{pending.length !== 1 ? "s" : ""}
      </p>

      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bgLight px-6 py-10 text-center text-sm text-muted">
          No pending claims. 🎉
        </div>
      ) : (
        <div className="space-y-5">
          {pending.map((listing) => {
            const provider = listing.claimedByProvider;
            return (
              <div
                key={listing.id}
                className="rounded-xl border border-border bg-card p-6"
              >
                {/* Listing info */}
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <h2 className="font-semibold text-dark text-lg">
                      {listing.name}
                    </h2>
                    <p className="text-xs text-muted">
                      {listing.category.name} · {listing.type}
                      {listing.stats && (
                        <>
                          {" · "}
                          {listing.stats.avgRating.toFixed(1)}★ (
                          {listing.stats.reviewCount} review
                          {listing.stats.reviewCount !== 1 ? "s" : ""})
                        </>
                      )}
                    </p>
                    <a
                      href={`/listing/${listing.slug}`}
                      target="_blank"
                      className="text-xs text-muted underline hover:text-dark mt-0.5 inline-block"
                    >
                      View listing ↗
                    </a>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold shrink-0">
                    PENDING
                  </span>
                </div>

                {/* Claimant details */}
                {provider && (
                  <div className="rounded-lg bg-bgLight border border-border p-4 mb-4 text-sm">
                    <p className="font-semibold text-dark mb-2">
                      {provider.businessName}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <p>
                        <span className="text-muted">Email: </span>
                        <a
                          href={`mailto:${provider.contactEmail}`}
                          className="underline hover:text-dark"
                        >
                          {provider.contactEmail}
                        </a>
                      </p>
                      {provider.contactPhone && (
                        <p>
                          <span className="text-muted">Phone: </span>
                          {provider.contactPhone}
                        </p>
                      )}
                      {provider.websiteUrl && (
                        <p>
                          <span className="text-muted">Website: </span>
                          <a
                            href={provider.websiteUrl}
                            target="_blank"
                            className="underline hover:text-dark"
                          >
                            {provider.websiteUrl}
                          </a>
                        </p>
                      )}
                      <p>
                        <span className="text-muted">Applied: </span>
                        {formatDate(provider.createdAt)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Approve */}
                  <form
                    action={approveClaim.bind(null, listing.id)}
                  >
                    <button
                      type="submit"
                      className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700 transition-colors"
                    >
                      Approve &amp; verify
                    </button>
                  </form>

                  {/* Reject with reason */}
                  <RejectForm listingId={listing.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Inline reject form component (server-safe; uses a hidden textarea + dialog-like UX)
function RejectForm({ listingId }: { listingId: string }) {
  return (
    <details className="group">
      <summary className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 cursor-pointer hover:bg-red-100 transition-colors list-none">
        Reject…
      </summary>
      <form
        action={async (formData: FormData) => {
          "use server";
          const reason = (formData.get("reason") as string) ?? "";
          await rejectClaim(listingId, reason);
        }}
        className="mt-2 space-y-2"
      >
        <textarea
          name="reason"
          rows={2}
          placeholder="Reason for rejection (optional — sent to claimant)"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm text-dark placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-crimson/30 resize-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          Confirm rejection
        </button>
      </form>
    </details>
  );
}
