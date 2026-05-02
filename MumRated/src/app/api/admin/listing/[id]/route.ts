import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi, createAdminAction } from "@/lib/admin";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  type: z.enum(["PRODUCT", "SERVICE"]).optional(),
  categoryId: z.string().min(1).optional(),
  description: z.string().max(5000).nullable().optional(),
  brandOrProvider: z.string().max(255).nullable().optional(),
  locationText: z.string().max(255).nullable().optional(),
  priceRangeNGN: z.string().max(100).nullable().optional(),
  priceRangeMin: z.number().int().nonnegative().nullable().optional(),
  priceRangeMax: z.number().int().nonnegative().nullable().optional(),
  heroImage: z.string().url().nullable().optional(),
});

const deleteSchema = z.object({
  reason: z.string().min(1).default("Admin removal"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminResult = await requireAdminApi();
  if (adminResult instanceof Response) return adminResult;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await db.listing.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const listing = await db.listing.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, slug: true, name: true },
  });

  return NextResponse.json(listing);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminResult = await requireAdminApi();
  if (adminResult instanceof Response) return adminResult;

  const body = await req.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  const reason = parsed.success ? parsed.data.reason : "Admin removal";

  await db.$transaction(async (tx) => {
    const publishedCount = await tx.review.count({
      where: { listingId: params.id, status: "PUBLISHED" },
    });

    await tx.listing.update({
      where: { id: params.id },
      data: { status: "HIDDEN" },
    });

    await tx.review.updateMany({
      where: { listingId: params.id, status: "PUBLISHED" },
      data: { status: "HIDDEN" },
    });

    await tx.listingStats.upsert({
      where: { listingId: params.id },
      create: {
        listingId: params.id,
        avgRating: 0,
        reviewCount: 0,
        lastReviewAt: null,
      },
      update: { avgRating: 0, reviewCount: 0, lastReviewAt: null },
    });

    await createAdminAction(tx, {
      adminUserId: adminResult.id,
      actionType: "HIDE_LISTING",
      targetType: "Listing",
      targetId: params.id,
      reason,
      metadata: { hiddenReviewCount: publishedCount },
    });
  });

  return NextResponse.json({ ok: true });
}
