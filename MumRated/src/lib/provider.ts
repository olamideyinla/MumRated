import { db } from "./db";
import { auth } from "@/auth";
import { notFound } from "next/navigation";

// ── Server-action / layout guard ─────────────────────────────────────────────

/**
 * Use in provider layouts and server actions.
 * Returns the Provider record if the session user has one; notFound() otherwise.
 * A user with role=PROVIDER but no Provider row should not exist — treated as not found.
 */
export async function requireProvider() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const provider = await db.provider.findUnique({
    where: { userId: session.user.id },
    include: {
      claimedListings: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          slug: true,
          claimStatus: true,
          stats: { select: { avgRating: true, reviewCount: true } },
        },
      },
    },
  });

  if (!provider) notFound();
  return { session, provider };
}

// ── API-route guard ───────────────────────────────────────────────────────────

/**
 * Use in API route handlers. Returns 404 Response for users without a provider record.
 */
export async function requireProviderApi(): Promise<
  { userId: string; providerId: string } | Response
> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Not Found", { status: 404 });
  }

  const provider = await db.provider.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!provider) {
    return new Response("Not Found", { status: 404 });
  }

  return { userId: session.user.id, providerId: provider.id };
}
