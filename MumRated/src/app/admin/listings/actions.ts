"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, createAdminAction } from "@/lib/admin";
import type { Prisma } from "@prisma/client";

export async function softDeleteListing(listingId: string, reason: string) {
  const admin = await requireAdmin();

  await db.$transaction(async (tx) => {
    // Count currently PUBLISHED reviews before hiding them
    const publishedCount = await tx.review.count({
      where: { listingId, status: "PUBLISHED" },
    });

    // Hide the listing
    await tx.listing.update({
      where: { id: listingId },
      data: { status: "HIDDEN" },
    });

    // Hide all published reviews on this listing
    await tx.review.updateMany({
      where: { listingId, status: "PUBLISHED" },
      data: { status: "HIDDEN" },
    });

    // Zero out ListingStats
    await tx.listingStats.upsert({
      where: { listingId },
      create: { listingId, avgRating: 0, reviewCount: 0, lastReviewAt: null },
      update: { avgRating: 0, reviewCount: 0, lastReviewAt: null },
    });

    await createAdminAction(tx, {
      adminUserId: admin.id,
      actionType: "HIDE_LISTING",
      targetType: "Listing",
      targetId: listingId,
      reason,
      metadata: { hiddenReviewCount: publishedCount } as Prisma.InputJsonValue,
    });
  });

  revalidatePath("/admin/listings");
}
