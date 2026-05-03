"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ListingHit {
  id: string;
  name: string;
  type: string;
  locationText: string | null;
  category: { name: string };
}

export default function ProviderSignUpForm() {
  const router = useRouter();

  // Step 1: business details
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  // Listing search
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ListingHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedListing, setSelectedListing] = useState<ListingHit | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/provider/listings?q=${encodeURIComponent(q)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as ListingHit[];
          setResults(data);
        }
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    if (!contactEmail.trim()) {
      setError("Contact email is required.");
      return;
    }
    if (!selectedListing) {
      setError("Please select the listing you want to claim.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/provider/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
          listingId: selectedListing.id,
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-10">
        <p className="text-4xl mb-4">🎉</p>
        <h2 className="font-display text-2xl font-bold text-dark mb-2">
          Application submitted!
        </h2>
        <p className="text-sm text-muted max-w-sm mx-auto mb-6">
          Our team will review your identity and approve your claim. You&apos;ll
          receive an email once your listing is verified — usually within 2
          business days.
        </p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-crimson text-white px-5 py-2.5 text-sm font-semibold hover:bg-crimson/90 transition-colors"
        >
          Back to site
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Business details */}
      <div className="space-y-4">
        <h2 className="font-semibold text-dark text-base">
          Your business details
        </h2>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
            Business name <span className="text-crimson">*</span>
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-dark placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-crimson/30"
            placeholder="e.g. Little Sprouts Daycare"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
            Contact email <span className="text-crimson">*</span>
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-dark placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-crimson/30"
            placeholder="hello@yourbusiness.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-dark placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-crimson/30"
              placeholder="+234…"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Website (optional)
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-dark placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-crimson/30"
              placeholder="https://"
            />
          </div>
        </div>
      </div>

      {/* Listing search */}
      <div className="space-y-3">
        <h2 className="font-semibold text-dark text-base">
          Select the listing to claim
        </h2>
        <p className="text-xs text-muted">
          Search for your product or service as it appears on MumRated.
        </p>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search listings…"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-dark placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-crimson/30"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              Searching…
            </span>
          )}
        </div>

        {results.length > 0 && !selectedListing && (
          <ul className="rounded-lg border border-border bg-card divide-y divide-border max-h-64 overflow-y-auto">
            {results.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedListing(hit);
                    setSearchQuery(hit.name);
                    setResults([]);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-bgLight transition-colors"
                >
                  <p className="text-sm font-medium text-dark">{hit.name}</p>
                  <p className="text-xs text-muted">
                    {hit.category.name}
                    {hit.locationText ? ` · ${hit.locationText}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedListing && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-dark">
                {selectedListing.name}
              </p>
              <p className="text-xs text-muted">
                {selectedListing.category.name}
                {selectedListing.locationText
                  ? ` · ${selectedListing.locationText}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedListing(null);
                setSearchQuery("");
              }}
              className="text-xs text-muted hover:text-dark underline shrink-0"
            >
              Change
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-crimson text-white py-3 text-sm font-semibold hover:bg-crimson/90 transition-colors disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit claim application"}
      </button>

      <p className="text-xs text-muted text-center">
        By submitting you agree to our identity verification process. Our team
        will contact you within 2 business days.
      </p>
    </form>
  );
}
