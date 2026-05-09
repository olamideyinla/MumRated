"use client";

import { useState, useTransition } from "react";

export default function SuggestForm() {
  const [type, setType] = useState<"PRODUCT" | "SERVICE" | "">("");
  const [name, setName] = useState("");
  const [categoryHint, setCategoryHint] = useState("");
  const [description, setDescription] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter the name of the product or service.");
      return;
    }
    if (!type) {
      setError("Please choose whether it's a product or service.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          categoryHint: categoryHint.trim() || undefined,
          description: description.trim() || undefined,
          submitterEmail: submitterEmail.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Something went wrong. Please try again.");
      }
    });
  }

  if (submitted) {
    return (
      <div className="rounded-card border border-border bg-card px-6 py-10 text-center max-w-lg mx-auto">
        <p className="text-3xl mb-4" aria-hidden="true">✓</p>
        <h2 className="font-display text-xl font-bold text-dark mb-2">Thanks for the suggestion!</h2>
        <p className="text-sm text-muted leading-relaxed mb-6">
          Our team will review it and add it within 48 hours.
          {submitterEmail && " We'll email you when it's live."}
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setName("");
            setType("");
            setCategoryHint("");
            setDescription("");
            setSubmitterEmail("");
          }}
          className="btn-outline text-sm py-2 px-5"
        >
          Suggest another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-lg space-y-5">
      {/* Product or Service */}
      <fieldset>
        <legend className="label mb-2">Is it a product or a service?</legend>
        <div className="flex gap-3">
          {(["PRODUCT", "SERVICE"] as const).map((t) => (
            <label
              key={t}
              className={`flex-1 flex items-center justify-center gap-2 rounded-input border p-3 cursor-pointer transition text-sm font-medium ${
                type === t
                  ? "border-crimson bg-crimson/5 text-crimson"
                  : "border-border text-dark hover:border-mid"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="sr-only"
              />
              {t === "PRODUCT" ? "📦 Product" : "🏥 Service"}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Name */}
      <div>
        <label htmlFor="suggest-name" className="label">
          Name of the product or service
        </label>
        <input
          id="suggest-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pampers Premium Care, Evercare Hospital Lekki"
          maxLength={200}
          className="mt-1 w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson"
        />
      </div>

      {/* Category hint */}
      <div>
        <label htmlFor="suggest-category" className="label">
          Category{" "}
          <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="suggest-category"
          type="text"
          value={categoryHint}
          onChange={(e) => setCategoryHint(e.target.value)}
          placeholder="e.g. Nappies, Paediatricians, Baby food"
          maxLength={100}
          className="mt-1 w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="suggest-description" className="label">
          Any extra details{" "}
          <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="suggest-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Where to find it, why it should be listed, any other context…"
          rows={3}
          maxLength={500}
          className="mt-1 w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson resize-none"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="suggest-email" className="label">
          Your email{" "}
          <span className="font-normal text-muted">(optional &mdash; we&apos;ll notify you when it&apos;s added)</span>
        </label>
        <input
          id="suggest-email"
          type="email"
          value={submitterEmail}
          onChange={(e) => setSubmitterEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full py-3 text-sm disabled:opacity-60"
      >
        {isPending ? "Submitting…" : "Submit suggestion"}
      </button>
    </form>
  );
}
