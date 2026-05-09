import type { Metadata } from "next";
import Link from "next/link";
import SuggestForm from "./SuggestForm";

export const metadata: Metadata = {
  title: "Suggest a listing \u2013 MumRated!",
  description:
    "Can\u2019t find a baby product or family service on MumRated? Suggest it and we\u2019ll add it within 48 hours.",
  robots: { index: false },
};

export default function SuggestPage() {
  return (
    <div className="container py-10 max-w-2xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-1.5 text-xs text-muted">
          <li>
            <Link href="/home" className="hover:text-crimson transition">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-dark font-medium">Suggest a listing</li>
        </ol>
      </nav>

      <h1 className="font-display text-2xl font-bold text-dark mb-2">
        Suggest a listing
      </h1>
      <p className="text-muted text-sm leading-relaxed mb-8">
        Can&apos;t find a product or service? Tell us about it and we&apos;ll add it within 48 hours.
        Listing here is always free.
      </p>

      <SuggestForm />

      {/* Already listed? */}
      <p className="mt-8 text-center text-sm text-muted">
        Already listed?{" "}
        <Link href="/browse" className="text-crimson font-medium hover:underline">
          Browse all categories
        </Link>
        {" "}or{" "}
        <Link href="/search" className="text-crimson font-medium hover:underline">
          search for it
        </Link>
        .
      </p>
    </div>
  );
}
