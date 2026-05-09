import type { Metadata } from "next";
import { searchListings } from "@/lib/search";
import ListingCard from "@/components/ui/ListingCard";
import Link from "next/link";
import SearchBox from "./SearchBox";

interface Props {
  searchParams: { q?: string };
}

export function generateMetadata({ searchParams }: Props): Metadata {
  const q = searchParams.q?.trim();
  return {
    title: q ? `\u201C${q}\u201D \u2013 MumRated!` : "Search \u2013 MumRated!",
    description: q
      ? `Nigerian mum reviews for \u201C${q}\u201D.`
      : "Search baby products and services reviewed by Nigerian mums.",
    robots: { index: false }, // don't index search result pages
  };
}

// Search results are never cached, always fresh
export const revalidate = 0;

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() ?? "";
  const results = q ? await searchListings(q) : [];

  return (
    <div className="container py-10">
      {/* Search form — client component handles the clear (×) button */}
      <SearchBox defaultValue={q} />

      {q ? (
        <>
          <h1 className="font-display text-xl font-bold text-dark mb-1">
            {results.length > 0
              ? `${results.length} result${results.length !== 1 ? "s" : ""} for \u201C${q}\u201D`
              : `No results for \u201C${q}\u201D`}
          </h1>
          <p className="text-sm text-muted mb-6">
            Ranked by relevance and review count, not by any commercial status.
          </p>

          {results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {results.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="rounded-card border border-border bg-bgLight px-6 py-10 text-center">
              <p className="text-2xl mb-3" aria-hidden="true">🔍</p>
              <p className="font-semibold text-dark mb-1">
                {`Nothing found for \u201C${q}\u201D`}
              </p>
              <p className="text-sm text-muted mb-4">
                Try different words, or suggest a new listing if it doesn&apos;t exist yet.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href="/browse" className="btn-outline text-sm py-2 px-5">
                  Browse categories
                </Link>
                <Link href="/suggest" className="btn-primary text-sm py-2 px-5">
                  Suggest a listing
                </Link>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-4xl mb-4" aria-hidden="true">🔍</p>
          <p className="font-display text-xl font-bold text-dark mb-2">
            What are you looking for?
          </p>
          <p className="text-sm text-muted mb-6">
            Try &ldquo;Pampers&rdquo;, &ldquo;Lekki paediatrician&rdquo;, or &ldquo;cr&egrave;che Victoria Island&rdquo;
          </p>
          <Link href="/browse" className="btn-outline text-sm py-2.5 px-6">
            Browse all categories
          </Link>
        </div>
      )}
    </div>
  );
}
