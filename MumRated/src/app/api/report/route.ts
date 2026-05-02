import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const REPORT_REASONS = [
  "Inappropriate content",
  "Inaccurate information",
  "Spam or fake review",
  "Other",
] as const;

const reportSchema = z.object({
  reviewId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(500).optional(),
});

const AUTO_HIDE_THRESHOLD = 3;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to report a review." }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report data." }, { status: 400 });
  }

  const { reviewId, reason, details } = parsed.data;

  // Confirm the review exists and is visible
  const review = await db.review.findUnique({
    where: { id: reviewId, status: { in: ["PUBLISHED", "FLAGGED"] } },
    select: { id: true, status: true },
  });
  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  // Check if this user already reported this review
  const existing = await db.report.findFirst({
    where: { reviewId, reportedBy: userId },
    select: { id: true },
  });
  if (existing) {
    // Silently succeed — don't reveal that they already reported it
    return NextResponse.json({ ok: true });
  }

  // Create the report and check auto-hide threshold in a transaction
  await db.$transaction(async (tx) => {
    await tx.report.create({
      data: {
        reviewId,
        reportedBy: userId,
        reason: `${reason}${details ? ` — ${details}` : ""}`,
        status: "OPEN",
      },
    });

    // Count total open reports for this review
    const reportCount = await tx.report.count({
      where: { reviewId, status: "OPEN" },
    });

    // Auto-hide when threshold reached — always reversible by admin
    if (reportCount >= AUTO_HIDE_THRESHOLD && review.status === "PUBLISHED") {
      await tx.review.update({
        where: { id: reviewId },
        data: { status: "HIDDEN" },
      });

      // Audit log
      const staffUser = await tx.user.findFirst({
        where: { role: { in: ["STAFF", "ADMIN"] } },
        select: { id: true },
      });
      await tx.adminAction.create({
        data: {
          adminUserId: staffUser?.id ?? userId,
          actionType: "AUTO_HIDE_REVIEW",
          targetType: "Review",
          targetId: reviewId,
          reason: `Auto-hidden after ${reportCount} independent reports`,
          metadata: { reportCount } as Prisma.InputJsonValue,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
