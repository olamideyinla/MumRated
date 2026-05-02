"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface ListingData {
  id: string;
  name: string;
  slug: string;
  type: string;
  categoryId: string;
  description: string | null;
  brandOrProvider: string | null;
  locationText: string | null;
  priceRangeNGN: string | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  heroImage: string | null;
}

interface Props {
  categories: Category[];
  listing?: ListingData;
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ListingForm({ categories, listing }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(listing?.name ?? "");
  const [slug, setSlug] = useState(listing?.slug ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!listing);
  const [type, setType] = useState(listing?.type ?? "PRODUCT");
  const [categoryId, setCategoryId] = useState(listing?.categoryId ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [brandOrProvider, setBrandOrProvider] = useState(
    listing?.brandOrProvider ?? "",
  );
  const [locationText, setLocationText] = useState(
    listing?.locationText ?? "",
  );
  const [priceRangeNGN, setPriceRangeNGN] = useState(
    listing?.priceRangeNGN ?? "",
  );
  const [priceRangeMin, setPriceRangeMin] = useState(
    listing?.priceRangeMin?.toString() ?? "",
  );
  const [priceRangeMax, setPriceRangeMax] = useState(
    listing?.priceRangeMax?.toString() ?? "",
  );
  const [heroImage, setHeroImage] = useState(listing?.heroImage ?? "");

  function handleNameChange(v: string) {
    setName(v);
    if (!slugManuallyEdited) setSlug(toSlug(v));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body = {
      name,
      slug,
      type,
      categoryId,
      description: description || null,
      brandOrProvider: brandOrProvider || null,
      locationText: locationText || null,
      priceRangeNGN: priceRangeNGN || null,
      priceRangeMin: priceRangeMin ? parseInt(priceRangeMin, 10) : null,
      priceRangeMax: priceRangeMax ? parseInt(priceRangeMax, 10) : null,
      heroImage: heroImage || null,
    };

    startTransition(async () => {
      try {
        const url = listing
          ? `/api/admin/listing/${listing.id}`
          : "/api/admin/listing";
        const method = listing ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Something went wrong.");
          return;
        }

        router.push("/admin/listings");
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  const inputCls =
    "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1818]/30";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name *</label>
          <input
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Slug *</label>
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManuallyEdited(true);
            }}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Type *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputCls}
          >
            <option value="PRODUCT">Product</option>
            <option value="SERVICE">Service</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Category *</label>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Brand / Provider</label>
        <input
          value={brandOrProvider}
          onChange={(e) => setBrandOrProvider(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputCls + " resize-none"}
        />
      </div>

      <div>
        <label className={labelCls}>Location text</label>
        <input
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          placeholder='e.g. "Lekki Phase 1, Lagos" or "Jumia · Shoprite"'
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Price range (display)</label>
          <input
            value={priceRangeNGN}
            onChange={(e) => setPriceRangeNGN(e.target.value)}
            placeholder="e.g. ₦5,000 – ₦15,000"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Min price (₦)</label>
          <input
            type="number"
            min="0"
            value={priceRangeMin}
            onChange={(e) => setPriceRangeMin(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Max price (₦)</label>
          <input
            type="number"
            min="0"
            value={priceRangeMax}
            onChange={(e) => setPriceRangeMax(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Hero image URL</label>
        <input
          type="url"
          value={heroImage}
          onChange={(e) => setHeroImage(e.target.value)}
          placeholder="https://res.cloudinary.com/…"
          className={inputCls}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-[#7B1818] text-white px-5 py-2 text-sm font-medium hover:bg-[#6a1515] disabled:opacity-50 transition"
        >
          {isPending
            ? "Saving…"
            : listing
              ? "Save changes"
              : "Create listing"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/listings")}
          className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
