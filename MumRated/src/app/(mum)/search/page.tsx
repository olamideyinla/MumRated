import type { Metadata } from "next";
import { searchListings } from "@/lib/search";
import ListingCard from "@/components/ui/ListingCard";
import Link from "next/link";

interface Props {
  searchParams: { q?: string };
}

export function generateMetadata({ searchParams }: Props): Metadata {
  const q = searchParams.q?.trim();
  return {
    title: q ? `"${q}" — MumRated!` : "Search — MumRated!",
    description: q
      ? `Nigerian mum reviews for "${q}".`
      : "Search baby products and services reviewed by Nigerian mums.",
    robots: { index: false }, // don't index search result pages
  };
}

// Search results are never cached — always fresh
export const revalidate = 0;

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() ?? "";
  const results = q ? await searchListings(q) : [];

  return (
    <div className="container py-10">
      {/* Search form */}
      <form role="search" action="/search" method="GET" className="mb-8 flex max-w-xl gap-2">
        <label htmlFor="search-input" className="sr-only">
          Search products and services
        </label>
        <input
          id="search-input"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search nappies, crèches, paediatricians…"
          autoFocus
          aria-label="Search products and services reviewed by Nigerian mums"
          className="flex-1 rounded-input border border-border bg-card px-4 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson"
        />
        <button type="submit" className="btn-primary px-5 py-2.5 text-sm">
          Search
        </button>
      </form>

      {q ? (
        <>
          <h1 className="font-display text-xl font-bold text-dark mb-1">
            {results.length > 0
              ? `${results.length} result${results.length !== 1 ? "s" : ""} for &ldquo;${q}&rdquo;`
              : `No results for "${q}"`}
          </h1>
          <p className="text-sm text-muted mb-6">
            Ranked by relevance and review count — not by any commercial status.
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
                Nothing found for &ldquo;{q}&rdquo;
              </p>
              <p className="text-sm text-muted mb-4">
                Try different words, or suggest a new listing if it doesn&rsquo;t exist yet.
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
            Try &ldquo;Pampers&rdquo;, &ldquo;Lekki paediatrician&rdquo;, or &ldquo;crèche Victoria Island&rdquo;
          </p>
          <Link href="/browse" className="btn-outline text-sm py-2.5 px-6">
            Browse all categories
          </Link>
        </div>
      )}
    </div>
  );
}
