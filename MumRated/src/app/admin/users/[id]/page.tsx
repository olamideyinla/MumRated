import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { suspendUser, unsuspendUser } from "../actions";

export const metadata = { title: "User Detail — Admin" };

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-green-100 text-green-800",
  FLAGGED: "bg-yellow-100 text-yellow-800",
  HIDDEN: "bg-gray-100 text-gray-700",
  REMOVED: "bg-red-100 text-red-800",
};

export default async function UserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [user, reviews, voteCount, reportCount, auditTrail] =
    await Promise.all([
      db.user.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          email: true,
          displayName: true,
          photo: true,
          role: true,
          isVerified: true,
          isSuspended: true,
          childAgeBand: true,
          city: true,
          country: true,
          createdAt: true,
        },
      }),
      db.review.findMany({
        where: { userId: params.id },
        include: {
          listing: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.helpfulVote.count({ where: { userId: params.id } }),
      db.report.count({ where: { reportedBy: params.id } }),
      db.adminAction.findMany({
        where: { targetType: "User", targetId: params.id },
        include: {
          adminUser: { select: { email: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  if (!user) notFound();

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-gray-400 hover:text-gray-700">
          ← Users
        </Link>
      </div>

      {/* Profile card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 mb-6">
        <div className="flex items-start gap-4">
          {user.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photo}
              alt=""
              className="w-16 h-16 rounded-full object-cover"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[#3B2010]">
                {user.displayName ?? user.email}
              </h1>
              <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-medium">
                {user.role}
              </span>
              {user.isVerified && (
                <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                  Verified
                </span>
              )}
              {user.isSuspended && (
                <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
                  Suspended
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
            {user.city && (
              <p className="text-sm text-gray-400">
                {user.city}, {user.country}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Joined {new Date(user.createdAt).toLocaleDateString("en-GB")}
            </p>
          </div>
        </div>

        {/* Suspend / unsuspend */}
        <div className="mt-5 pt-5 border-t border-gray-100">
          {user.isSuspended ? (
            <form
              action={async () => {
                "use server";
                await unsuspendUser(user.id);
              }}
            >
              <button
                type="submit"
                className="rounded border border-gray-300 bg-white text-gray-700 px-4 py-2 text-sm hover:bg-gray-50 transition"
              >
                Unsuspend account
              </button>
            </form>
          ) : (
            <form
              action={async (formData: FormData) => {
                "use server";
                const reason = formData.get("reason") as string;
                await suspendUser(user.id, reason || "Policy violation");
              }}
            >
              <div className="flex gap-2 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Suspension reason
                  </label>
                  <input
                    name="reason"
                    placeholder="Policy violation, spam, etc."
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm w-72"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded bg-red-600 text-white px-4 py-1.5 text-sm hover:bg-red-700 transition"
                >
                  Suspend account
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Activity summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 text-center">
          <p className="text-2xl font-bold text-[#3B2010]">{reviews.length}</p>
          <p className="text-xs text-gray-500 mt-1">Reviews (last 20)</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 text-center">
          <p className="text-2xl font-bold text-[#3B2010]">{voteCount}</p>
          <p className="text-xs text-gray-500 mt-1">Helpful votes given</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 text-center">
          <p className="text-2xl font-bold text-[#3B2010]">{reportCount}</p>
          <p className="text-xs text-gray-500 mt-1">Reports submitted</p>
        </div>
      </div>

      {/* Review history */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Review history
        </h2>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Listing</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rating</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reviews.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No reviews.
                  </td>
                </tr>
              )}
              {reviews.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/listing/${r.listing.slug}`}
                      target="_blank"
                      className="text-blue-600 hover:underline"
                    >
                      {r.listing.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-yellow-500">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit trail */}
      {auditTrail.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Admin actions on this user
          </h2>
          <div className="space-y-2">
            {auditTrail.map((a) => (
              <div
                key={a.id}
                className="rounded border border-gray-200 bg-white px-4 py-3 text-sm"
              >
                <div className="flex gap-2 items-center">
                  <span className="rounded bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-mono">
                    {a.actionType}
                  </span>
                  <span className="text-gray-400 text-xs">
                    by {a.adminUser.email} ·{" "}
                    {new Date(a.createdAt).toLocaleString("en-GB")}
                  </span>
                </div>
                {a.reason && (
                  <p className="text-gray-600 mt-1 text-xs">{a.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
