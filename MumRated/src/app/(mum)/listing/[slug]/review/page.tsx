import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import ReviewForm from "./ReviewForm";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await db.listing.findUnique({
    where: { slug: params.slug },
    select: { name: true },
  });
  return {
    title: listing ? `Review ${listing.name}, MumRated!` : "Write a review, MumRated!",
    robots: { index: false },
  };
}

export default async function ReviewPage({ params }: Props) {
  // Auth guard, middleware covers this but double-check server-side
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/listing/${params.slug}/review`);
  }

  const [listing, user] = await Promise.all([
    db.listing.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        category: { select: { name: true } },
      },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { childAgeBand: true, city: true },
    }),
  ]);

  if (!listing) notFound();

  // Check if this user has already reviewed this listing
  const existingReview = await db.review.findFirst({
    where: {
      listingId: listing.id,
      userId: session.user.id,
    },
    select: { id: true },
  });

  return (
    <div className="container py-8 max-w-xl">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted mb-6 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-dark">Home</Link>
        <span>/</span>
        <Link href={`/listing/${params.slug}`} className="hover:text-dark">{listing.name}</Link>
        <span>/</span>
        <span className="text-dark font-medium">Write a review</span>
      </nav>

      {/* Listing context */}
      <div className="mb-6">
        <span className="cat-tag mb-2 inline-block">{listing.category.name}</span>
        <h1 className="font-display text-2xl font-bold text-dark">
          {listing.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Share your honest experience, no sponsored content, no brand partnerships.
        </p>
      </div>

      {/* Already-reviewed notice */}
      {existingReview ? (
        <div className="rounded-card border border-border bg-bgLight px-6 py-8 text-center space-y-3">
          <p className="text-2xl" aria-hidden="true">✍️</p>
          <p className="font-semibold text-dark">You&rsquo;ve already reviewed this</p>
          <p className="text-sm text-muted">
            Each mum can review a listing once to keep things fair. If your
            experience has changed, contact us and we&rsquo;ll update it together.
          </p>
          <Link href={`/listing/${params.slug}`} className="btn-outline text-sm py-2 px-5">
            Back to listing
          </Link>
        </div>
      ) : (
        <div className="card p-6">
          <ReviewForm
            listing={listing}
            userProfile={{
              childAgeBand: user?.childAgeBand ?? null,
              city: user?.city ?? null,
            }}
          />
        </div>
      )}
    </div>
  );
}
