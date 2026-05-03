import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/provider/listings?q=...
 *
 * Returns UNCLAIMED, ACTIVE listings matching the search query.
 * Used by the provider sign-up form to let the claimant find their listing.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const listings = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      claimStatus: "UNCLAIMED",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { brandOrProvider: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 10,
    select: {
      id: true,
      name: true,
      type: true,
      locationText: true,
      category: { select: { name: true } },
    },
    orderBy: [
      { stats: { reviewCount: "desc" } },
      { name: "asc" },
    ],
  });

  return NextResponse.json(listings);
}
