import { db } from "./db";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email);
}

export const PAGE_SIZE = 25;

// ── Server-action guard ───────────────────────────────────────────────────────

/** Use inside server actions. Throws notFound() for non-admins. */
export async function requireAdmin() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) notFound();
  const user = await db.user.findUniqueOrThrow({
    where: { email: session!.user!.email! },
    select: { id: true, email: true },
  });
  return user;
}

// ── API-route guard ───────────────────────────────────────────────────────────

/** Use inside API route handlers. Returns 404 Response for non-admins. */
export async function requireAdminApi(): Promise<{ id: string; email: string } | Response> {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return new Response("Not Found", { status: 404 });
  }
  const user = await db.user.findUniqueOrThrow({
    where: { email: session!.user!.email! },
    select: { id: true, email: true },
  });
  return user;
}

// ── ListingStats recompute ────────────────────────────────────────────────────

type PrismaTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Recompute ListingStats from all currently PUBLISHED reviews.
 * Must be called AFTER the review status change within the same transaction.
 */
export async function recomputeStats(
  tx: PrismaTransaction,
  listingId: string,
) {
  const reviews = await tx.review.findMany({
    where: { listingId, status: "PUBLISHED" },
    select: { rating: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const count = reviews.length;
  const avg =
    count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

  await tx.listingStats.upsert({
    where: { listingId },
    create: {
      listingId,
      avgRating: avg,
      reviewCount: count,
      lastReviewAt: reviews[0]?.createdAt ?? null,
    },
    update: {
      avgRating: avg,
      reviewCount: count,
      lastReviewAt: reviews[0]?.createdAt ?? null,
    },
  });
}

// ── Slug helpers ──────────────────────────────────────────────────────────────

export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generate a unique slug with a numeric suffix if needed. */
export async function uniqueSlug(
  base: string,
  excludeId?: string,
): Promise<string> {
  const slug = toSlug(base);
  let candidate = slug;
  let n = 1;
  while (true) {
    const existing = await db.listing.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${slug}-${n++}`;
  }
}

// ── AdminAction helper ────────────────────────────────────────────────────────

export async function createAdminAction(
  tx: PrismaTransaction,
  opts: {
    adminUserId: string;
    actionType: string;
    targetType: string;
    targetId: string;
    reason?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return tx.adminAction.create({
    data: {
      adminUserId: opts.adminUserId,
      actionType: opts.actionType,
      targetType: opts.targetType,
      targetId: opts.targetId,
      reason: opts.reason ?? null,
      metadata: opts.metadata ?? {},
    },
  });
}
