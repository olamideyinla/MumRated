import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/admin";
import Link from "next/link";

export const metadata = { title: "Users — Admin" };

interface SearchParams {
  q?: string;
  role?: string;
  suspended?: string;
  page?: string;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {};
  if (searchParams.q) {
    where.OR = [
      { email: { contains: searchParams.q, mode: "insensitive" } },
      { displayName: { contains: searchParams.q, mode: "insensitive" } },
    ];
  }
  if (
    searchParams.role === "MUM" ||
    searchParams.role === "STAFF" ||
    searchParams.role === "ADMIN"
  ) {
    where.role = searchParams.role;
  }
  if (searchParams.suspended === "true") where.isSuspended = true;
  else if (searchParams.suspended === "false") where.isSuspended = false;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isSuspended: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3B2010]">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-6">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search email or name…"
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          name="role"
          defaultValue={searchParams.role ?? ""}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All roles</option>
          <option value="MUM">Mum</option>
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select
          name="suspended"
          defaultValue={searchParams.suspended ?? ""}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="false">Active</option>
          <option value="true">Suspended</option>
        </select>
        <button
          type="submit"
          className="rounded bg-gray-800 text-white px-3 py-1.5 text-sm hover:bg-gray-700 transition"
        >
          Search
        </button>
        <Link
          href="/admin/users"
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Reviews</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">
                    {u.displayName ?? "—"}
                  </p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-medium">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {u.isVerified && (
                      <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                        Verified
                      </span>
                    )}
                    {u.isSuspended && (
                      <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
                        Suspended
                      </span>
                    )}
                    {!u.isSuspended && !u.isVerified && (
                      <span className="text-xs text-gray-400">Active</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{u._count.reviews}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(u.createdAt).toLocaleDateString("en-GB")}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 mt-6 justify-center">
          {page > 1 && (
            <Link
              href={`/admin/users?page=${page - 1}`}
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
              href={`/admin/users?page=${page + 1}`}
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
