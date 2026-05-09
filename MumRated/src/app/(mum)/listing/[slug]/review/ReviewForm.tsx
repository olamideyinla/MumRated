"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleReCaptchaProvider,
  useGoogleReCaptcha,
} from "react-google-recaptcha-v3";
import type { ChildAgeBand } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  name: string;
  slug: string;
  type: "PRODUCT" | "SERVICE";
  category: { name: string };
}

interface UserProfile {
  childAgeBand: ChildAgeBand | null;
  city: string | null;
}

// ── Star selector ─────────────────────────────────────────────────────────────

function StarSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

  return (
    <div>
      <div
        className="flex items-center gap-2"
        role="radiogroup"
        aria-label="Rating"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}, ${labels[star]}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className={`h-10 w-10 transition-all duration-100 ${
                star <= active
                  ? "fill-gold scale-110 drop-shadow"
                  : "fill-border scale-100"
              }`}
              aria-hidden="true"
            >
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        ))}
      </div>
      {active > 0 && (
        <p className="mt-1 text-sm font-medium text-gold">{labels[active]}</p>
      )}
    </div>
  );
}

// ── Prompt config ─────────────────────────────────────────────────────────────

const PRODUCT_PROMPTS = [
  {
    key: "loved",
    label: "What did you love?",
    placeholder:
      'e.g. "No leaks overnight, my baby slept so well. Worth every kobo."',
  },
  {
    key: "surprised",
    label: "What surprised you?",
    placeholder:
      "e.g. I didn't expect it to last so long before needing a change.",
  },
  {
    key: "recommend",
    label: "Would you recommend it to your sister?",
    placeholder:
      "e.g. Absolutely, I've already sent the link to three mum friends.",
  },
] as const;

const SERVICE_PROMPTS = [
  {
    key: "experience",
    label: "What was the experience like?",
    placeholder:
      "e.g. Very warm and professional. The waiting room was clean and well-organised.",
  },
  {
    key: "staff",
    label: "How were the staff or provider?",
    placeholder:
      "e.g. Dr. Amaka took her time and explained everything clearly. No rushing.",
  },
  {
    key: "bookAgain",
    label: "Would you book again?",
    placeholder: "e.g. Yes, we've already booked our next appointment.",
  },
] as const;

const AGE_BAND_LABELS: Record<ChildAgeBand, string> = {
  NEWBORN: "Newborn (0–3 months)",
  INFANT: "Infant (3–12 months)",
  TODDLER: "Toddler (1–3 years)",
  PRESCHOOL: "Preschool (3–5 years)",
  SCHOOL_AGE: "School age (5+ years)",
};
const AGE_BANDS = Object.keys(AGE_BAND_LABELS) as ChildAgeBand[];

// ── Photo picker ──────────────────────────────────────────────────────────────

interface UploadedPhoto {
  preview: string; // local data URI for preview
  url: string | null; // Cloudinary URL, null while uploading
  uploading: boolean;
  error: string | null;
}

function PhotoPicker({
  photos,
  onAdd,
  onRemove,
}: {
  photos: UploadedPhoto[];
  onAdd: (file: File) => void;
  onRemove: (index: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {photos.map((p, i) => (
          <div key={i} className="relative h-20 w-20 rounded-img overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.preview}
              alt={`Photo ${i + 1}`}
              className="h-full w-full object-cover"
            />
            {p.uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-dark/50 text-white text-xs">
                ↑
              </div>
            )}
            {p.error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-500/80 text-white text-xs px-1 text-center">
                Error
              </div>
            )}
            {!p.uploading && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-dark/70 text-white text-xs hover:bg-dark transition"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {photos.length < 4 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-img border-2 border-dashed border-border hover:border-gold transition text-muted hover:text-dark"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            <span className="text-[10px]">Add photo</span>
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { onAdd(file); e.target.value = ""; }
        }}
      />
      <p className="mt-1.5 text-xs text-muted">Up to 4 photos · JPEG/PNG/WebP · max 8 MB each</p>
    </div>
  );
}

// ── Inner form (has access to reCAPTCHA hook) ─────────────────────────────────

function ReviewFormInner({
  listing,
  userProfile,
}: {
  listing: Listing;
  userProfile: UserProfile;
}) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const prompts = listing.type === "PRODUCT" ? PRODUCT_PROMPTS : SERVICE_PROMPTS;

  // Form state
  const [rating, setRating] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [childAgeBand, setChildAgeBand] = useState<ChildAgeBand | "">(
    userProfile.childAgeBand ?? "",
  );
  const [city, setCity] = useState(userProfile.city ?? "");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  // Submission state
  const [submitted, setSubmitted] = useState(false);
  const [publishedStatus, setPublishedStatus] = useState<"PUBLISHED" | "FLAGGED" | null>(null);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Photo upload
  const handleAddPhoto = useCallback(async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      setFormError("That photo is over 8 MB. Try a smaller one.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUri = ev.target?.result as string;
      const idx = photos.length;
      setPhotos((prev) => [
        ...prev,
        { preview: dataUri, url: null, uploading: true, error: null },
      ]);

      try {
        const res = await fetch("/api/upload-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUri }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");

        setPhotos((prev) =>
          prev.map((p, i) =>
            i === idx ? { ...p, url: data.url!, uploading: false } : p,
          ),
        );
      } catch (err) {
        setPhotos((prev) =>
          prev.map((p, i) =>
            i === idx
              ? { ...p, uploading: false, error: (err as Error).message }
              : p,
          ),
        );
      }
    };
    reader.readAsDataURL(file);
  }, [photos.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Validate and submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const errors: Record<string, string> = {};

    if (rating === 0) errors.rating = "Please choose a star rating.";

    const nonEmpty = Object.values(answers).filter((v) => v.trim().length > 0);
    if (nonEmpty.length === 0) {
      errors.answers = "Please fill in at least one field below.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    // Get reCAPTCHA token
    let recaptchaToken = "";
    if (executeRecaptcha) {
      try {
        recaptchaToken = await executeRecaptcha("submit_review");
      } catch {
        // Non-fatal, moderation will handle missing token
      }
    }

    // Wait for any still-uploading photos
    const uploadedUrls = photos
      .filter((p) => p.url !== null)
      .map((p) => p.url as string);

    startTransition(async () => {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          rating,
          structuredAnswers: answers,
          photoUrls: uploadedUrls,
          childAgeBandAtReview: childAgeBand || null,
          cityAtReview: city.trim() || undefined,
          isAnonymous,
          recaptchaToken,
        }),
      });

      const data = (await res.json()) as {
        published?: boolean;
        status?: "PUBLISHED" | "FLAGGED";
        error?: string;
      };

      if (!res.ok) {
        setFormError(
          data.error ?? "Something went wrong, try again in a moment.",
        );
        return;
      }

      setPublishedStatus(data.status ?? (data.published ? "PUBLISHED" : "FLAGGED"));
      setSubmitted(true);
    });
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (submitted && publishedStatus) {
    const isPublished = publishedStatus === "PUBLISHED";
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-4xl" aria-hidden="true">
          {isPublished ? "🌟" : "📬"}
        </p>
        <h2 className="font-display text-xl font-bold text-dark">
          {isPublished ? "Your review is live!" : "Thanks, we'll read this shortly"}
        </h2>
        <p className="text-sm text-muted leading-relaxed max-w-xs mx-auto">
          {isPublished
            ? "Other Nigerian mums can now read your honest take. Thank you for helping the community."
            : "We want to make sure every review on MumRated! is fair and trustworthy. We'll publish this once it's been read, usually within 24 hours."}
        </p>
        <button
          onClick={() => router.push(`/listing/${listing.slug}`)}
          className="btn-primary text-sm px-6 py-2.5"
        >
          Back to {listing.name}
        </button>
      </div>
    );
  }

  // ── Review form ────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* ── Star rating ────────────────────────────────────────────── */}
      <div>
        <p className="label mb-3">
          Your overall rating <span className="text-crimson">*</span>
        </p>
        <StarSelector value={rating} onChange={(v) => { setRating(v); setFieldErrors((e) => ({ ...e, rating: "" })); }} />
        {fieldErrors.rating && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.rating}</p>
        )}
      </div>

      {/* ── Structured prompts ─────────────────────────────────────── */}
      <div className="space-y-5">
        <p className="label">
          Your experience{" "}
          <span className="font-normal text-muted">(at least one field)</span>
          {fieldErrors.answers && (
            <span className="ml-2 text-xs text-red-600">{fieldErrors.answers}</span>
          )}
        </p>
        {prompts.map((prompt) => (
          <div key={prompt.key}>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor={`answer-${prompt.key}`}>
              {prompt.label}
            </label>
            <textarea
              id={`answer-${prompt.key}`}
              value={answers[prompt.key] ?? ""}
              onChange={(e) => {
                setAnswers((prev) => ({ ...prev, [prompt.key]: e.target.value }));
                if (fieldErrors.answers) setFieldErrors((err) => ({ ...err, answers: "" }));
              }}
              rows={3}
              maxLength={2000}
              placeholder={prompt.placeholder}
              className="w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson resize-none"
            />
          </div>
        ))}
      </div>

      {/* ── Photos ────────────────────────────────────────────────── */}
      <div>
        <p className="label mb-3">
          Photos{" "}
          <span className="font-normal text-muted">(optional · up to 4)</span>
        </p>
        <PhotoPicker photos={photos} onAdd={handleAddPhoto} onRemove={handleRemovePhoto} />
      </div>

      {/* ── Context (age band + city) ──────────────────────────────── */}
      <div className="rounded-card bg-bgLight border border-border p-4 space-y-4">
        <p className="text-sm font-semibold text-dark">
          A bit about you{" "}
          <span className="font-normal text-muted">(optional, helps other mums)</span>
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="childAgeBand">My child’s age</label>
            <select
              id="childAgeBand"
              value={childAgeBand}
              onChange={(e) => setChildAgeBand(e.target.value as ChildAgeBand | "")}
              className="mt-1 w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson"
            >
              <option value="">Choose age…</option>
              {AGE_BANDS.map((b) => (
                <option key={b} value={b}>{AGE_BAND_LABELS[b]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="city">Your city</label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={80}
              placeholder="Lagos, Abuja…"
              className="mt-1 w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson"
            />
          </div>
        </div>
      </div>

      {/* ── Anonymous toggle ────────────────────────────────────────── */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="h-4 w-4 accent-crimson"
        />
        <span className="text-sm text-dark">
          Post anonymously{" "}
          <span className="text-muted">(your name won’t be shown)</span>
        </span>
      </label>

      {/* ── Errors ──────────────────────────────────────────────────── */}
      {formError && (
        <div className="rounded-card bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      {/* ── Submit ──────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isPending || photos.some((p) => p.uploading)}
        className="btn-primary w-full py-3 text-base disabled:opacity-60"
      >
        {isPending ? "Sharing…" : "Share your honest take"}
      </button>

      <p className="text-xs text-center text-muted">
        By submitting you confirm this is your honest personal experience.
        MumRated! may contact you if your review needs clarification.
      </p>
    </form>
  );
}

// ── Public export, wraps with reCAPTCHA provider ────────────────────────────

export default function ReviewForm({
  listing,
  userProfile,
}: {
  listing: Listing;
  userProfile: UserProfile;
}) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

  if (!siteKey) {
    // Dev mode: render form without reCAPTCHA provider
    return <ReviewFormInner listing={listing} userProfile={userProfile} />;
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={siteKey}>
      <ReviewFormInner listing={listing} userProfile={userProfile} />
    </GoogleReCaptchaProvider>
  );
}
