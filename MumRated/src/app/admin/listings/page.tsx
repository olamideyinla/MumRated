import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/admin";
import Link from "next/link";
import DeleteListingButton from "./DeleteListingButton";

export const metadata = { title: "Listings — Admin" };

interface SearchParams {
  q?: string;
  type?: string;
  category?: string;
  status?: string;
  page?: string;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  HIDDEN: "bg-gray-100 text-gray-600",
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {};
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: "insensitive" } },
      { brandOrProvider: { contains: searchParams.q, mode: "insensitive" } },
    ];
  }
  if (searchParams.type === "PRODUCT" || searchParams.type === "SERVICE") {
    where.type = searchParams.type;
  }
  if (searchParams.category) {
    where.categoryId = searchParams.category;
  }
  if (searchParams.status === "ACTIVE" || searchParams.status === "HIDDEN") {
    where.status = searchParams.status;
  }

  const [listings, total, categories] = await Promise.all([
    db.listing.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        stats: { select: { avgRating: true, reviewCount: true } },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.listing.count({ where }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3B2010]">Listings</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/listings/new"
            className="rounded bg-[#7B1818] text-white px-4 py-2 text-sm hover:bg-[#6a1515] transition"
          >
            + Add listing
          </Link>
          <label className="rounded border border-gray-300 px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 transition">
            Import CSV
            <form action="/api/admin/listing/import" method="POST" encType="multipart/form-data">
              <input
                type="file"
                name="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.form?.submit()}
              />
            </form>
          </label>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-6">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search name / brand…"
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          name="type"
          defaultValue={searchParams.type ?? ""}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          <option value="PRODUCT">Product</option>
          <option value="SERVICE">Service</option>
        </select>
        <select
          name="category"
          defaultValue={searchParams.category ?? ""}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={searchParams.status ?? ""}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="HIDDEN">Hidden</option>
        </select>
        <button
          type="submit"
          className="rounded bg-gray-800 text-white px-3 py-1.5 text-sm hover:bg-gray-700 transition"
        >
          Search
        </button>
        <Link
          href="/admin/listings"
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rating</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Reviews</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {listings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No listings found.
                </td>
              </tr>
            )}
            {listings.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{l.name}</p>
                  {l.brandOrProvider && (
                    <p className="text-xs text-gray-400">{l.brandOrProvider}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{l.type}</td>
                <td className="px-4 py-3 text-gray-500">{l.category.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[l.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {l.stats ? l.stats.avgRating.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">{l._count.reviews}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 items-center">
                    <Link
                      href={`/listing/${l.slug}`}
                      target="_blank"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin/listings/${l.id}/edit`}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      Edit
                    </Link>
                    {l.status === "ACTIVE" && (
                      <DeleteListingButton listingId={l.id} name={l.name} />
                    )}
                  </div>
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
              href={`/admin/listings?page=${page - 1}`}
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
              href={`/admin/listings?page=${page + 1}`}
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
