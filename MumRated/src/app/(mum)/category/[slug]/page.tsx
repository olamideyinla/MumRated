import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCategoryBySlug,
  getListingsByCategory,
  type SortOption,
} from "@/lib/listings";
import ListingCard from "@/components/ui/ListingCard";

interface Props {
  params: { slug: string };
  searchParams: { sort?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = await getCategoryBySlug(params.slug);
  if (!cat) return { title: "Category not found — MumRated!" };
  return {
    title: `${cat.name} reviews — MumRated!`,
    description: `Read honest mum reviews of ${cat.name.toLowerCase()} in Nigeria.`,
    openGraph: {
      title: `${cat.name} — MumRated!`,
      description: `Honest Nigerian mum reviews of ${cat.name.toLowerCase()}.`,
    },
  };
}

export const revalidate = 300;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "highest-rated", label: "Highest rated" },
  { value: "most-reviewed", label: "Most reviewed" },
  { value: "most-recent", label: "Most recent" },
];

export default async function CategoryPage({ params, searchParams }: Props) {
  const cat = await getCategoryBySlug(params.slug);
  if (!cat) notFound();

  const sort = (
    SORT_OPTIONS.find((o) => o.value === searchParams.sort)?.value ??
    "highest-rated"
  ) as SortOption;

  const listings = await getListingsByCategory(params.slug, sort);

  return (
    <div className="container py-10">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted mb-6 flex items-center gap-1.5">
        <Link href="/" className="hover:text-dark">Home</Link>
        <span>/</span>
        <Link href="/browse" className="hover:text-dark">Browse</Link>
        <span>/</span>
        <span className="text-dark font-medium">{cat.name}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <span className="cat-tag mb-2 inline-block">
            {cat.type === "PRODUCT" ? "Product" : "Service"}
          </span>
          <h1 className="font-display text-2xl font-bold text-dark">{cat.name}</h1>
          <p className="text-sm text-muted mt-1">
            {listings.length}{" "}
            {listings.length === 1 ? "listing" : "listings"}
          </p>
        </div>

        {/* Sort — only review-data-based options */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted">Sort by</span>
          {SORT_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={`?sort=${opt.value}`}
              className={`rounded-pill px-3 py-1.5 text-xs font-medium transition ${
                sort === opt.value
                  ? "bg-crimson text-white"
                  : "bg-card border border-border text-mid hover:border-crimson/40"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-card border border-border bg-bgLight px-6 py-12 text-center">
          <p className="text-2xl mb-3" aria-hidden="true">🔍</p>
          <p className="text-dark font-semibold mb-1">No listings yet</p>
          <p className="text-sm text-muted mb-4">
            Be the first to suggest something in this category.
          </p>
          <Link href="/suggest" className="btn-primary text-sm py-2 px-5">
            Suggest a listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/suggest" className="btn-outline text-sm py-2 px-5">
          Suggest a new listing →
        </Link>
      </div>
    </div>
  );
}
