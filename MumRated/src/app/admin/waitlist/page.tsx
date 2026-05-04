import { db } from "@/lib/db";
import type { WaitlistEntry } from "@prisma/client";

export const metadata = { title: "Waitlist — Admin" };

export default async function WaitlistPage() {
  const entries = await db.waitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3B2010]">Waitlist</h1>
          <p className="text-sm text-gray-500 mt-1">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} total
          </p>
        </div>
        <a
          href={`data:text/csv;charset=utf-8,Email,Joined\n${entries.map((e: WaitlistEntry) => `${e.email},${e.createdAt.toISOString()}`).join("\n")}`}
          download="mumrated-waitlist.csv"
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          Export CSV
        </a>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-gray-400">
                  No entries yet.
                </td>
              </tr>
            )}
            {entries.map((e: WaitlistEntry) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{e.email}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {e.createdAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
