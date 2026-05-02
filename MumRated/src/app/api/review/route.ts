import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { runModerationPipeline } from "@/lib/moderation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const CHILD_AGE_BANDS = ["NEWBORN", "INFANT", "TODDLER", "PRESCHOOL", "SCHOOL_AGE"] as const;

const reviewSchema = z.object({
  listingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  structuredAnswers: z.record(z.string(), z.string().max(2000)),
  photoUrls: z.array(z.string().url()).max(4).default([]),
  childAgeBandAtReview: z.enum(CHILD_AGE_BANDS).nullable().optional(),
  cityAtReview: z.string().max(80).optional(),
  isAnonymous: z.boolean().default(false),
  recaptchaToken: z.string().default(""),
});

function synthesizeText(answers: Record<string, string>): string {
  return Object.values(answers)
    .filter((v) => v?.trim().length > 0)
    .map((v) => v.trim())
    .join("\n\n");
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to share your review." },
      { status: 401 },
    );
  }

  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Something looks off — check your details and try again." },
      { status: 400 },
    );
  }

  const { listingId, rating, structuredAnswers, photoUrls, childAgeBandAtReview, cityAtReview, isAnonymous, recaptchaToken } = parsed.data;

  // Confirm listing exists
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { id: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  // Synthesise the main text field from structured answers
  const text = synthesizeText(structuredAnswers);

  // Run moderation pipeline
  const modResult = await runModerationPipeline({
    text,
    structuredAnswers,
    userId: session.user.id,
    listingId,
    recaptchaToken,
    ip: getClientIp(req),
  });

  // If pipeline hard-fails completeness or duplicate, return 422
  if (
    modResult.status === "FLAGGED" &&
    modResult.flagReasons.some((r) => r.startsWith("completeness") || r.startsWith("duplicate"))
  ) {
    const isDup = modResult.flagReasons.some((r) => r.startsWith("duplicate"));
    return NextResponse.json(
      {
        error: isDup
          ? "It looks like you've already reviewed this. Each mum can review a listing once."
          : "Please fill in at least one answer and make sure your review is at least 10 characters.",
      },
      { status: 422 },
    );
  }

  // If reCAPTCHA fails, return 403
  if (modResult.status === "FLAGGED" && modResult.flagReasons.some((r) => r.startsWith("recaptcha"))) {
    return NextResponse.json(
      { error: "We couldn't verify this submission. Please try again." },
      { status: 403 },
    );
  }

  // Create the review
  const review = await db.review.create({
    data: {
      listingId,
      userId: session.user.id,
      rating,
      text,
      structuredAnswers,
      photoUrls,
      childAgeBandAtReview: childAgeBandAtReview ?? null,
      cityAtReview: cityAtReview ?? null,
      isAnonymous,
      status: modResult.status === "PUBLISHED" ? "PUBLISHED" : "FLAGGED",
    },
    select: { id: true, status: true },
  });

  // If published, update ListingStats atomically
  if (review.status === "PUBLISHED") {
    const stats = await db.listingStats.findUnique({ where: { listingId } });
    if (stats) {
      // Recompute incrementally
      const newCount = stats.reviewCount + 1;
      const newAvg = (stats.avgRating * stats.reviewCount + rating) / newCount;
      await db.listingStats.update({
        where: { listingId },
        data: { avgRating: newAvg, reviewCount: newCount, lastReviewAt: new Date() },
      });
    } else {
      await db.listingStats.create({
        data: { listingId, avgRating: rating, reviewCount: 1, lastReviewAt: new Date() },
      });
    }
  }

  // Log flag reasons for admin (AdminAction)
  if (modResult.status === "FLAGGED" && modResult.flagReasons.length > 0) {
    // Find any staff/admin user for the audit log — fall back to the submitter's own id
    const staffUser = await db.user.findFirst({
      where: { role: { in: ["STAFF", "ADMIN"] } },
      select: { id: true },
    });
    await db.adminAction.create({
      data: {
        adminUserId: staffUser?.id ?? session.user.id,
        actionType: "AUTO_FLAG_REVIEW",
        targetType: "Review",
        targetId: review.id,
        reason: "Automated moderation pipeline",
        metadata: { flagReasons: modResult.flagReasons } as Prisma.InputJsonValue,
      },
    });
  }

  return NextResponse.json({
    reviewId: review.id,
    status: review.status,
    published: review.status === "PUBLISHED",
  });
}
