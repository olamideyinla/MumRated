import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to mark reviews helpful." }, { status: 401 });
  }

  const { reviewId } = (await req.json()) as { reviewId?: string };
  if (!reviewId) {
    return NextResponse.json({ error: "reviewId is required." }, { status: 400 });
  }

  // Confirm the review exists and get its author
  const review = await db.review.findUnique({
    where: { id: reviewId, status: "PUBLISHED" },
    select: { id: true, userId: true, helpfulCount: true },
  });
  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  // Prevent self-voting
  if (review.userId === session.user.id) {
    return NextResponse.json({ error: "You can't mark your own review helpful." }, { status: 409 });
  }

  // Attempt to create the vote — unique constraint prevents double-voting
  try {
    await db.$transaction([
      db.helpfulVote.create({
        data: { reviewId, userId: session.user.id },
      }),
      db.review.update({
        where: { id: reviewId },
        data: { helpfulCount: { increment: 1 } },
      }),
    ]);

    const updated = await db.review.findUnique({
      where: { id: reviewId },
      select: { helpfulCount: true },
    });

    return NextResponse.json({ helpfulCount: updated?.helpfulCount ?? review.helpfulCount + 1 });
  } catch {
    // Unique constraint violation = already voted
    return NextResponse.json(
      { error: "already_voted", helpfulCount: review.helpfulCount },
      { status: 409 },
    );
  }
}
