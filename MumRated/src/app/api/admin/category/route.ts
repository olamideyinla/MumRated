import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  type: z.enum(["PRODUCT", "SERVICE"]),
  parentId: z.string().nullable().optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  type: z.enum(["PRODUCT", "SERVICE"]).optional(),
  parentId: z.string().nullable().optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const adminResult = await requireAdminApi();
  if (adminResult instanceof Response) return adminResult;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await db.category.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Slug "${parsed.data.slug}" is already in use.` },
      { status: 409 },
    );
  }

  const category = await db.category.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      type: parsed.data.type,
      parentId: parsed.data.parentId ?? null,
    },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json(category, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const adminResult = await requireAdminApi();
  if (adminResult instanceof Response) return adminResult;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const { id, ...data } = parsed.data;

  const category = await db.category.update({
    where: { id },
    data,
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json(category);
}

export async function DELETE(req: NextRequest) {
  const adminResult = await requireAdminApi();
  if (adminResult instanceof Response) return adminResult;

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  // Guard: cannot delete if listings exist
  const listingCount = await db.listing.count({
    where: { categoryId: parsed.data.id },
  });
  if (listingCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${listingCount} listing(s) are assigned to this category. Reassign or delete them first.`,
      },
      { status: 409 },
    );
  }

  await db.category.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
