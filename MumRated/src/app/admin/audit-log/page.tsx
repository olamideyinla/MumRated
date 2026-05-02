import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/admin";
import Link from "next/link";

export const metadata = { title: "Audit Log — Admin" };

interface SearchParams {
  adminId?: string;
  actionType?: string;
  from?: string;
  to?: string;
  page?: string;
}

const TARGET_LINKS: Record<string, (id: string) => string> = {
  Review: (id) => `/admin/moderation?q=${id}`,
  Listing: (id) => `/admin/listings?q=${id}`,
  User: (id) => `/admin/users/${id}`,
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {};
  if (searchParams.adminId) where.adminUserId = searchParams.adminId;
  if (searchParams.actionType) {
    where.actionType = { contains: searchParams.actionType, mode: "insensitive" };
  }
  if (searchParams.from || searchParams.to) {
    where.createdAt = {
      ...(searchParams.from ? { gte: new Date(searchParams.from) } : {}),
      ...(searchParams.to ? { lte: new Date(searchParams.to) } : {}),
    };
  }

  const [actions, total, admins] = await Promise.all([
    db.adminAction.findMany({
      where,
      include: {
        adminUser: { select: { email: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.adminAction.count({ where }),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3B2010]">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} action(s) — read-only
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-6">
        <select
          name="adminId"
          defaultValue={searchParams.adminId ?? ""}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All admins</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.email}
            </option>
          ))}
        </select>
        <input
          name="actionType"
          defaultValue={searchParams.actionType ?? ""}
          placeholder="Action type…"
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
          href="/admin/audit-log"
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Clear
        </Link>
      </form>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Timestamp</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Admin</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Target</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {actions.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No actions found.
                </td>
              </tr>
            )}
            {actions.map((a) => {
              const targetLink = TARGET_LINKS[a.targetType]?.(a.targetId);
              const meta = JSON.stringify(a.metadata, null, 2);
              const metaIsEmpty =
                !a.metadata ||
                (typeof a.metadata === "object" &&
                  Object.keys(a.metadata as object).length === 0);

              return (
                <tr key={a.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {a.adminUser.displayName ?? a.adminUser.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 text-gray-700 px-2 py-0.5 text-xs font-mono">
                      {a.actionType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="text-gray-500">{a.targetType} </span>
                    {targetLink ? (
                      <Link
                        href={targetLink}
                        className="font-mono text-blue-600 hover:underline"
                      >
                        {a.targetId.slice(0, 10)}…
                      </Link>
                    ) : (
                      <span className="font-mono text-gray-500">
                        {a.targetId.slice(0, 10)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                    {a.reason ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {!metaIsEmpty && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-400 hover:text-gray-700">
                          Show
                        </summary>
                        <pre className="mt-1 rounded bg-gray-50 p-2 text-gray-700 whitespace-pre-wrap max-w-xs">
                          {meta}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 mt-6 justify-center">
          {page > 1 && (
            <Link
              href={`/admin/audit-log?page=${page - 1}`}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/audit-log?page=${page + 1}`}
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
