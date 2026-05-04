"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ChildAgeBand } from "@prisma/client";

interface UserProfile {
  id: string;
  displayName: string | null;
  photo: string | null;
  childAgeBand: ChildAgeBand | null;
  city: string | null;
  email: string;
  isVerified: boolean;
  createdAt: Date;
}

const AGE_BAND_LABELS: Record<ChildAgeBand, string> = {
  NEWBORN: "Newborn (0–3 months)",
  INFANT: "Infant (3–12 months)",
  TODDLER: "Toddler (1–3 years)",
  PRESCHOOL: "Preschool (3–5 years)",
  SCHOOL_AGE: "School age (5+ years)",
};

const AGE_BANDS = Object.keys(AGE_BAND_LABELS) as ChildAgeBand[];

function VerifiedBadge() {
  return (
    <span className="verified-badge inline-flex items-center gap-1.5 text-sm font-semibold">
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full bg-verified text-white text-xs font-bold"
        aria-hidden="true"
      >
        ✓
      </span>
      Verified Mum
    </span>
  );
}

function PendingBadge({
  has,
}: {
  has: { name: boolean; photo: boolean; band: boolean };
}) {
  const missing = [
    !has.name && "display name",
    !has.photo && "photo",
    !has.band && "child's age",
  ].filter(Boolean);

  return (
    <div className="rounded-card border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
      <p className="font-semibold text-dark mb-1">Almost there!</p>
      <p className="text-muted">
        Add your{" "}
        {missing.map((m, i) => (
          <span key={i as number}>
            {i > 0 && (i === missing.length - 1 ? " and " : ", ")}
            <span className="font-medium text-dark">{m}</span>
          </span>
        ))}{" "}
        to earn your Verified Mum badge.
      </p>
    </div>
  );
}

export default function ProfileForm({ user }: { user: UserProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Local state for the form
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [childAgeBand, setChildAgeBand] = useState<ChildAgeBand | "">(
    user.childAgeBand ?? "",
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    user.photo ?? null,
  );
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(user.isVerified);

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Badge eligibility preview (client-side, matches server logic)
  const eligible =
    displayName.trim().length >= 2 &&
    (photoDataUri !== null || user.photo !== null) &&
    childAgeBand !== "";

  // Photo picker
  const handlePhotoPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg(
          "That photo is a bit large (max 5 MB). Try a smaller one.",
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const uri = ev.target?.result as string;
        setPhotoPreview(uri);
        setPhotoDataUri(uri);
        setErrorMsg("");
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  // Submit
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    startTransition(async () => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          city: city.trim() || undefined,
          childAgeBand: childAgeBand || null,
          photoDataUri: photoDataUri ?? undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(
          (data as { error?: string }).error ??
            "Couldn't save your profile right now, give it another go.",
        );
        return;
      }

      const updated = (await res.json()) as {
        isVerified: boolean;
        photo: string | null;
      };
      setIsVerified(updated.isVerified);
      if (updated.photo) setPhotoPreview(updated.photo);
      setPhotoDataUri(null); // clear the blob, server has the permanent URL now
      setSuccessMsg(
        updated.isVerified
          ? "Profile saved! You've earned your Verified Mum badge. 🌟"
          : "Profile saved.",
      );
      router.refresh(); // revalidate server session data
    });
  }

  const initials = (user.displayName ?? user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* ── Verification badge / pending notice ── */}
      {isVerified ? (
        <VerifiedBadge />
      ) : (
        <PendingBadge
          has={{
            name: displayName.trim().length >= 2,
            photo: photoPreview !== null,
            band: childAgeBand !== "",
          }}
        />
      )}

      {/* ── Avatar upload ── */}
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative h-20 w-20 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-border hover:ring-gold transition group"
          aria-label="Change profile photo"
        >
          {photoPreview ? (
            <Image
              src={photoPreview}
              alt="Your photo"
              fill
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-crimson text-xl font-bold text-white">
              {initials}
            </span>
          )}
          {/* Hover overlay */}
          <span className="absolute inset-0 flex items-center justify-center bg-dark/40 opacity-0 group-hover:opacity-100 transition text-white text-xs font-medium">
            Change
          </span>
        </button>

        <div className="space-y-1">
          <p className="text-sm font-medium text-dark">Profile photo</p>
          <p className="text-xs text-muted">
            JPEG or PNG · max 5 MB · we crop it square
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs text-crimson underline underline-offset-2 hover:text-crimson-dark"
          >
            Upload a photo
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handlePhotoPick}
        />
      </div>

      {/* ── Display name ── */}
      <div>
        <label className="label" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Adaeze O."
          maxLength={60}
          className="mt-1 w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson"
        />
        <p className="mt-1 text-xs text-muted">
          This is how your name appears on your reviews.
        </p>
      </div>

      {/* ── Child's age band ── */}
      <div>
        <label className="label" htmlFor="childAgeBand">
          My child&rsquo;s age
        </label>
        <select
          id="childAgeBand"
          value={childAgeBand}
          onChange={(e) =>
            setChildAgeBand(e.target.value as ChildAgeBand | "")
          }
          className="mt-1 w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson"
        >
          <option value="">Choose an age group…</option>
          {AGE_BANDS.map((band) => (
            <option key={band} value={band}>
              {AGE_BAND_LABELS[band]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          We store this as a band, not a date of birth, your privacy stays intact.
        </p>
      </div>

      {/* ── City ── */}
      <div>
        <label className="label" htmlFor="city">
          City{" "}
          <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="city"
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Lagos, Abuja, Port Harcourt…"
          maxLength={80}
          className="mt-1 w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson"
        />
        <p className="mt-1 text-xs text-muted">
          Helps other mums know where your reviews are coming from.
        </p>
      </div>

      {/* ── Account info (read-only) ── */}
      <div className="rounded-card bg-bgLight border border-border px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">
          Account
        </p>
        <p className="text-sm text-dark">{user.email}</p>
        <p className="text-xs text-muted">
          Member since{" "}
          {new Date(user.createdAt).toLocaleDateString("en-NG", {
            year: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {/* ── Feedback messages ── */}
      {errorMsg && (
        <p className="text-sm text-red-600 rounded-card bg-red-50 px-4 py-3 border border-red-200">
          {errorMsg}
        </p>
      )}
      {successMsg && (
        <p className="text-sm text-[#2A6B3A] rounded-card bg-[#F0F7F2] px-4 py-3 border border-[#A8D5B5]">
          {successMsg}
        </p>
      )}

      {/* ── Save button ── */}
      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save profile"}
      </button>

      {/* Badge eligibility hint */}
      {!isVerified && eligible && !isPending && (
        <p className="text-center text-xs text-[#2A6B3A] font-medium">
          Save now to earn your Verified Mum badge!
        </p>
      )}
    </form>
  );
}
