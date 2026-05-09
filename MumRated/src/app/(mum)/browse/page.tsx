import Link from "next/link";
import type { Metadata } from "next";
import { getAllCategories } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Browse all categories, Best baby products & services in Nigeria | MumRated!",
  description:
    "Browse every category on MumRated, nappies, crèches, paediatricians, baby food, photographers and more. Honest reviews from Nigerian mums.",
  openGraph: {
    title: "Browse all categories, MumRated!",
    description:
      "Nappies, crèches, paediatricians, baby food and more, all rated by Nigerian mums.",
    type: "website",
    images: [{ url: "/logo-stamp.png", width: 512, height: 512, alt: "MumRated! logo" }],
  },
  twitter: {
    card: "summary",
    title: "Browse all categories, MumRated!",
    description: "Nappies, crèches, paediatricians, baby food and more, all rated by Nigerian mums.",
    images: ["/logo-stamp.png"],
  },
};

export const revalidate = 3600;

const CATEGORY_ICONS: Record<string, string> = {
  "baby-products": "🛒",
  "nappies-essentials": "🧷",
  "baby-food-nutrition": "🍼",
  "creches-schools": "🏫",
  paediatricians: "👩‍⚕️",
};

export default async function BrowsePage() {
  const categories = await getAllCategories();
  const products = categories.filter((c) => c.type === "PRODUCT");
  const services = categories.filter((c) => c.type === "SERVICE");

  return (
    <div className="container py-10">
      <h1 className="font-display text-2xl font-bold text-dark mb-2">
        Browse all categories
      </h1>
      <p className="text-muted text-sm mb-8">
        Choose a category to see listings and read mum reviews.
      </p>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Products */}
        <div>
          <h2 className="font-display text-lg font-bold text-dark mb-4 flex items-center gap-2">
            <span className="rounded-pill bg-crimson/10 text-crimson px-3 py-1 text-sm font-semibold">
              Products
            </span>
          </h2>
          <ul className="space-y-2">
            {products.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/category/${cat.slug}`}
                  className="flex items-center justify-between rounded-card border border-border bg-card px-4 py-3 hover:border-crimson/30 hover:shadow-card-sm transition group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl" aria-hidden="true">
                      {CATEGORY_ICONS[cat.slug] ?? "📦"}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-dark group-hover:text-crimson transition">
                        {cat.name}
                      </p>
                      <p className="text-xs text-muted">
                        {cat._count.listings}{" "}
                        {cat._count.listings === 1 ? "listing" : "listings"}
                      </p>
                    </div>
                  </div>
                  <svg
                    className="h-4 w-4 text-muted group-hover:text-crimson transition"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Services */}
        <div>
          <h2 className="font-display text-lg font-bold text-dark mb-4 flex items-center gap-2">
            <span className="rounded-pill bg-gold/20 text-[#6B5000] px-3 py-1 text-sm font-semibold">
              Services
            </span>
          </h2>
          <ul className="space-y-2">
            {services.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/category/${cat.slug}`}
                  className="flex items-center justify-between rounded-card border border-border bg-card px-4 py-3 hover:border-gold/50 hover:shadow-card-sm transition group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl" aria-hidden="true">
                      {CATEGORY_ICONS[cat.slug] ?? "🏥"}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-dark group-hover:text-crimson transition">
                        {cat.name}
                      </p>
                      <p className="text-xs text-muted">
                        {cat._count.listings}{" "}
                        {cat._count.listings === 1 ? "listing" : "listings"}
                      </p>
                    </div>
                  </div>
                  <svg
                    className="h-4 w-4 text-muted group-hover:text-crimson transition"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Suggest CTA */}
      <div className="mt-12 rounded-card border border-border bg-bgLight px-6 py-5 text-center">
        <p className="text-sm text-muted mb-2">
          Don’t see the category you need?
        </p>
        <Link href="/suggest" className="btn-outline text-sm py-2 px-5">
          Suggest a listing
        </Link>
      </div>
    </div>
  );
}
