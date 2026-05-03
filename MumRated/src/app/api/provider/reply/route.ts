import { NextRequest, NextResponse } from "next/server";
import { requireProviderApi } from "@/lib/provider";
import { db } from "@/lib/db";
import { z } from "zod";

const replySchema = z.object({
  reviewId: z.string().min(1),
  reply: z.string().min(5).max(1000),
});

/**
 * POST /api/provider/reply
 *
 * Upsert a provider reply on a published review.
 *
 * Trust boundary:
 *   - Providers may add ONE reply per review, displayed below the review with
 *     a "Provider response" label.
 *   - Providers CANNOT edit, hide, or flag reviews — that is admin-only.
 *   - The reply is associated with the Provider, not with the review's rating.
 */
export async function POST(req: NextRequest) {
  const guard = await requireProviderApi();
  if (guard instanceof Response) return guard;

  const body = await req.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Reply must be between 5 and 1000 characters." },
      { status: 400 },
    );
  }

  const { reviewId, reply } = parsed.data;

  // Confirm the review belongs to a listing claimed by this provider
  const review = await db.review.findFirst({
    where: {
      id: reviewId,
      status: "PUBLISHED",
      listing: {
        claimedByProviderId: guard.providerId,
        claimStatus: "CLAIMED",
      },
    },
    select: { id: true },
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  await db.review.update({
    where: { id: reviewId },
    data: {
      providerReply: reply,
      providerReplyAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
