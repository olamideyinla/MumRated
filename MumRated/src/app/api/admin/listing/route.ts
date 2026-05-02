import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi, uniqueSlug } from "@/lib/admin";
import { z } from "zod";

const listingSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).optional(),
  type: z.enum(["PRODUCT", "SERVICE"]),
  categoryId: z.string().min(1),
  description: z.string().max(5000).nullable().optional(),
  brandOrProvider: z.string().max(255).nullable().optional(),
  locationText: z.string().max(255).nullable().optional(),
  priceRangeNGN: z.string().max(100).nullable().optional(),
  priceRangeMin: z.number().int().nonnegative().nullable().optional(),
  priceRangeMax: z.number().int().nonnegative().nullable().optional(),
  heroImage: z.string().url().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const adminResult = await requireAdminApi();
  if (adminResult instanceof Response) return adminResult;

  const body = await req.json().catch(() => null);
  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, slug: rawSlug, ...rest } = parsed.data;
  const slug = await uniqueSlug(rawSlug || name);

  // Verify category exists
  const category = await db.category.findUnique({
    where: { id: rest.categoryId },
    select: { id: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  const listing = await db.listing.create({
    data: {
      name,
      slug,
      type: rest.type,
      categoryId: rest.categoryId,
      description: rest.description ?? null,
      brandOrProvider: rest.brandOrProvider ?? null,
      locationText: rest.locationText ?? null,
      priceRangeNGN: rest.priceRangeNGN ?? null,
      priceRangeMin: rest.priceRangeMin ?? null,
      priceRangeMax: rest.priceRangeMax ?? null,
      heroImage: rest.heroImage ?? null,
      createdById: adminResult.id,
    },
    select: { id: true, slug: true },
  });

  return NextResponse.json(listing, { status: 201 });
}
