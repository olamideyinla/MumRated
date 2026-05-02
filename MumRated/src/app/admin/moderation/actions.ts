"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, recomputeStats, createAdminAction } from "@/lib/admin";

export async function approveReview(reviewId: string) {
  const admin = await requireAdmin();

  await db.$transaction(async (tx) => {
    const review = await tx.review.findUniqueOrThrow({
      where: { id: reviewId },
      select: { listingId: true },
    });

    await tx.review.update({
      where: { id: reviewId },
      data: { status: "PUBLISHED" },
    });

    await recomputeStats(tx, review.listingId);

    // Resolve any open reports for this review
    await tx.report.updateMany({
      where: { reviewId, status: "OPEN" },
      data: { status: "RESOLVED" },
    });

    await createAdminAction(tx, {
      adminUserId: admin.id,
      actionType: "APPROVE_REVIEW",
      targetType: "Review",
      targetId: reviewId,
    });
  });

  revalidatePath("/admin/moderation");
}

export async function removeReview(reviewId: string, reason: string) {
  const admin = await requireAdmin();

  await db.$transaction(async (tx) => {
    const review = await tx.review.findUniqueOrThrow({
      where: { id: reviewId },
      select: { listingId: true, status: true },
    });

    await tx.review.update({
      where: { id: reviewId },
      data: { status: "REMOVED" },
    });

    // Only recompute if the review was contributing to stats
    if (review.status === "PUBLISHED") {
      await recomputeStats(tx, review.listingId);
    }

    await createAdminAction(tx, {
      adminUserId: admin.id,
      actionType: "REMOVE_REVIEW",
      targetType: "Review",
      targetId: reviewId,
      reason,
    });
  });

  revalidatePath("/admin/moderation");
}

export async function restoreReview(reviewId: string) {
  const admin = await requireAdmin();

  await db.$transaction(async (tx) => {
    const review = await tx.review.findUniqueOrThrow({
      where: { id: reviewId },
      select: { listingId: true },
    });

    await tx.review.update({
      where: { id: reviewId },
      data: { status: "PUBLISHED" },
    });

    await recomputeStats(tx, review.listingId);

    await createAdminAction(tx, {
      adminUserId: admin.id,
      actionType: "RESTORE_REVIEW",
      targetType: "Review",
      targetId: reviewId,
    });
  });

  revalidatePath("/admin/moderation");
}

export async function resolveReports(reviewId: string) {
  const admin = await requireAdmin();

  await db.$transaction(async (tx) => {
    await tx.report.updateMany({
      where: { reviewId, status: "OPEN" },
      data: { status: "RESOLVED" },
    });

    await createAdminAction(tx, {
      adminUserId: admin.id,
      actionType: "RESOLVE_REPORTS",
      targetType: "Review",
      targetId: reviewId,
    });
  });

  revalidatePath("/admin/moderation");
}
