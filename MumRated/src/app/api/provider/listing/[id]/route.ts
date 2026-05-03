import { NextRequest, NextResponse } from "next/server";
import { requireProviderApi } from "@/lib/provider";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  openingHours: z.string().max(200).nullable().optional(),
  locationText: z.string().max(200).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
});

/**
 * PATCH /api/provider/listing/[id]
 *
 * Allows a verified provider to update the provider-editable fields of their
 * claimed listing.
 *
 * Trust boundary: providers may NOT edit name, category, type, description,
 * heroImage, priceRange, or any ranking-related field. Those are admin-only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const guard = await requireProviderApi();
  if (guard instanceof Response) return guard;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  // Confirm this listing belongs to this provider and is CLAIMED
  const listing = await db.listing.findFirst({
    where: {
      id: params.id,
      claimedByProviderId: guard.providerId,
      claimStatus: "CLAIMED",
    },
    select: { id: true },
  });

  if (!listing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updateData: Record<string, string | null> = {};
  if (parsed.data.openingHours !== undefined) {
    updateData.openingHours = parsed.data.openingHours ?? null;
  }
  if (parsed.data.locationText !== undefined) {
    updateData.locationText = parsed.data.locationText ?? null;
  }

  // websiteUrl goes on the Provider record, not the Listing
  if (parsed.data.websiteUrl !== undefined) {
    await db.provider.update({
      where: { id: guard.providerId },
      data: { websiteUrl: parsed.data.websiteUrl ?? null },
    });
  }

  if (Object.keys(updateData).length > 0) {
    await db.listing.update({
      where: { id: params.id },
      data: updateData,
    });
  }

  return NextResponse.json({ ok: true });
}
