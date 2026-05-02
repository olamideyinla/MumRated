import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/admin";
import Link from "next/link";
import ReviewActions from "./ReviewActions";

export const metadata = { title: "Moderation — Admin" };

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-green-100 text-green-800",
  FLAGGED: "bg-yellow-100 text-yellow-800",
  HIDDEN: "bg-gray-100 text-gray-700",
  REMOVED: "bg-red-100 text-red-800",
};

interface SearchParams {
  tab?: string;
  page?: string;
  listingId?: string;
  userId?: string;
  reason?: string;
  from?: string;
  to?: string;
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tab = searchParams.tab ?? "flagged";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  // Build where clause based on tab + filters
  const baseWhere: Record<string, unknown> = {};
  if (searchParams.listingId) baseWhere.listingId = searchParams.listingId;
  if (searchParams.userId) baseWhere.userId = searchParams.userId;
  if (searchParams.from || searchParams.to) {
    baseWhere.createdAt = {
      ...(searchParams.from ? { gte: new Date(searchParams.from) } : {}),
      ...(searchParams.to ? { lte: new Date(searchParams.to) } : {}),
    };
  }

  let statusFilter: Record<string, unknown> = {};
  if (tab === "flagged") statusFilter = { status: "FLAGGED" };
  else if (tab === "reported")
    statusFilter = { reports: { some: { status: "OPEN" } } };

  const where = { ...baseWhere, ...statusFilter };

  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      include: {
        listing: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, displayName: true, email: true } },
        reports: {
          where: { status: "OPEN" },
          select: { id: true, reason: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.review.count({ where }),
  ]);

  // Fetch flag reasons from AdminAction audit rows
  const reviewIds = reviews.map((r) => r.id);
  const flagActions = await db.adminAction.findMany({
    where: { actionType: "AUTO_FLAG_REVIEW", targetId: { in: reviewIds } },
    select: { targetId: true, metadata: true },
  });
  const flagReasonsMap = new Map<string, string[]>();
  for (const a of flagActions) {
    const meta = a.metadata as Record<string, unknown>;
    const reasons = (meta?.flagReasons ?? []) as string[];
    flagReasonsMap.set(a.targetId, reasons);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#3B2010] mb-2">Moderation</h1>
      <p className="text-sm text-gray-500 mb-6">{total} review(s) matched</p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["flagged", "reported", "all"] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/moderation?tab=${t}`}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "border-b-2 border-[#7B1818] text-[#7B1818]"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t === "flagged" ? "Flagged" : t === "reported" ? "Reported" : "All"}
          </Link>
        ))}
      </div>

      {/* Filter form */}
      <form method="GET" className="flex flex-wrap gap-2 mb-6 text-sm">
        <input type="hidden" name="tab" value={tab} />
        <input
          name="listingId"
          defaultValue={searchParams.listingId ?? ""}
          placeholder="Listing ID"
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <input
          name="userId"
          defaultValue={searchParams.userId ?? ""}
          placeholder="User ID"
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <input
          type="date"
          name="from"
          defaultValue={searchParams.from ?? ""}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={searchParams.to ?? ""}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-gray-800 text-white px-3 py-1.5 text-sm hover:bg-gray-700 transition"
        >
          Filter
        </button>
        <Link
          href={`/admin/moderation?tab=${tab}`}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Clear
        </Link>
      </form>

      {/* Reviews list */}
      <div className="space-y-4">
        {reviews.length === 0 && (
          <p className="text-gray-500 text-sm py-8 text-center">
            No reviews found.
          </p>
        )}
        {reviews.map((review) => {
          const flagReasons = flagReasonsMap.get(review.id) ?? [];
          const answers =
            typeof review.structuredAnswers === "object" &&
            review.structuredAnswers !== null
              ? (review.structuredAnswers as Record<string, string>)
              : {};

          return (
            <div
              key={review.id}
              className="rounded-lg border border-gray-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">
                      {review.isAnonymous
                        ? "Anonymous"
                        : review.user.displayName ?? review.user.email}
                    </span>
                    <span className="text-yellow-500 text-sm">
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[review.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {review.status}
                    </span>
                    {review.childAgeBandAtReview && (
                      <span className="text-xs text-gray-400">
                        Child: {review.childAgeBandAtReview}
                      </span>
                    )}
                    {review.cityAtReview && (
                      <span className="text-xs text-gray-400">
                        {review.cityAtReview}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Listing:{" "}
                    <Link
                      href={`/listing/${review.listing.slug}`}
                      className="underline"
                      target="_blank"
                    >
                      {review.listing.name}
                    </Link>{" "}
                    · {new Date(review.createdAt).toLocaleDateString("en-GB")}
                    {" · "}
                    <span className="font-mono text-[10px]">{review.id}</span>
                  </p>
                </div>
              </div>

              {/* Review text */}
              <p className="text-sm text-gray-800 mb-3 whitespace-pre-line">
                {review.text}
              </p>

              {/* Structured answers */}
              {Object.entries(answers).length > 0 && (
                <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  {Object.entries(answers).map(([k, v]) => (
                    <div key={k}>
                      <span className="font-medium capitalize">
                        {k.replace(/([A-Z])/g, " $1")}:
                      </span>{" "}
                      {v}
                    </div>
                  ))}
                </div>
              )}

              {/* Photos */}
              {review.photoUrls.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {review.photoUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 underline"
                    >
                      Photo {i + 1}
                    </a>
                  ))}
                </div>
              )}

              {/* Flag reasons */}
              {flagReasons.length > 0 && (
                <div className="mb-3 rounded bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
                  <span className="font-semibold">Flag reasons: </span>
                  {flagReasons.join(", ")}
                </div>
              )}

              {/* Open reports */}
              {review.reports.length > 0 && (
                <div className="mb-3 rounded bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-800">
                  <span className="font-semibold">
                    {review.reports.length} open report(s):{" "}
                  </span>
                  {review.reports
                    .map((r) => r.reason)
                    .filter(Boolean)
                    .join("; ")}
                </div>
              )}

              <ReviewActions
                reviewId={review.id}
                currentStatus={review.status}
                listingId={review.listingId}
              />
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 mt-8 justify-center">
          {page > 1 && (
            <Link
              href={`/admin/moderation?tab=${tab}&page=${page - 1}`}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/moderation?tab=${tab}&page=${page + 1}`}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
