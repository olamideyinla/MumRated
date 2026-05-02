import { db } from "@/lib/db";
import Link from "next/link";

export const metadata = { title: "Admin Dashboard — MumRated!" };

export default async function AdminDashboardPage() {
  const [pendingReviews, openReports, totalListings, zeroReviews] =
    await Promise.all([
      db.review.count({ where: { status: "FLAGGED" } }),
      db.report.count({ where: { status: "OPEN" } }),
      db.listing.count({ where: { status: "ACTIVE" } }),
      db.listing.count({ where: { status: "ACTIVE", stats: { is: null } } }),
    ]);

  const cards = [
    {
      label: "Flagged reviews",
      value: pendingReviews,
      href: "/admin/moderation?tab=flagged",
      urgent: pendingReviews > 0,
    },
    {
      label: "Open reports",
      value: openReports,
      href: "/admin/moderation?tab=reported",
      urgent: openReports > 0,
    },
    {
      label: "Active listings",
      value: totalListings,
      href: "/admin/listings",
      urgent: false,
    },
    {
      label: "Listings with no reviews",
      value: zeroReviews,
      href: "/admin/listings",
      urgent: false,
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#3B2010] mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-lg border bg-white px-5 py-4 hover:shadow-sm transition"
          >
            <p
              className={`text-3xl font-bold ${
                c.urgent ? "text-red-600" : "text-[#3B2010]"
              }`}
            >
              {c.value}
            </p>
            <p className="text-sm text-gray-500 mt-1">{c.label}</p>
          </Link>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Quick actions
      </h2>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/moderation"
          className="rounded border border-[#7B1818] bg-[#7B1818] text-white px-4 py-2 text-sm hover:bg-[#6a1515] transition"
        >
          Review moderation queue
        </Link>
        <Link
          href="/admin/listings/new"
          className="rounded border border-gray-300 bg-white text-gray-700 px-4 py-2 text-sm hover:bg-gray-50 transition"
        >
          Add listing
        </Link>
        <Link
          href="/admin/categories"
          className="rounded border border-gray-300 bg-white text-gray-700 px-4 py-2 text-sm hover:bg-gray-50 transition"
        >
          Manage categories
        </Link>
        <Link
          href="/admin/audit-log"
          className="rounded border border-gray-300 bg-white text-gray-700 px-4 py-2 text-sm hover:bg-gray-50 transition"
        >
          View audit log
        </Link>
      </div>
    </div>
  );
}
