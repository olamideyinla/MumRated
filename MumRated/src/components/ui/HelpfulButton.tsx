"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  reviewId: string;
  initialCount: number;
  hasVoted: boolean;
  isAuthenticated: boolean;
}

export default function HelpfulButton({
  reviewId,
  initialCount,
  hasVoted,
  isAuthenticated,
}: Props) {
  // Optimistic state: update immediately, reconcile on response
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(hasVoted);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (voted || loading) return;

    if (!isAuthenticated) {
      router.push("/sign-in?callbackUrl=" + encodeURIComponent(window.location.pathname));
      return;
    }

    // Optimistic update
    setCount((c) => c + 1);
    setVoted(true);
    setLoading(true);

    try {
      const res = await fetch("/api/helpful", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId }),
      });
      const data = (await res.json()) as { helpfulCount?: number; error?: string };

      if (!res.ok) {
        // Reconcile: revert optimistic update
        setCount(data.helpfulCount ?? initialCount);
        setVoted(res.status === 409 && data.error === "already_voted");
      } else {
        // Server confirmed — use the authoritative count
        if (data.helpfulCount !== undefined) setCount(data.helpfulCount);
      }
    } catch {
      // Network error — revert
      setCount(initialCount);
      setVoted(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={voted || loading}
      aria-pressed={voted}
      aria-label={
        voted
          ? `You marked this helpful (${count} total)`
          : `Mark as helpful (${count} total)`
      }
      className={`flex items-center gap-1.5 text-xs transition disabled:cursor-default ${
        voted
          ? "text-verified font-semibold"
          : "text-muted hover:text-dark"
      }`}
    >
      {/* Thumbs up icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill={voted ? "currentColor" : "none"}
        stroke={voted ? "none" : "currentColor"}
        strokeWidth={1.5}
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0114 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 01-2.096 6.336C16.304 16.99 15.421 17.5 14.5 17.5h-3.653c-.634 0-1.22-.276-1.95-.974a13.153 13.153 0 01-.894-.998 1 1 0 00-.79-.286c-.68.082-1.213.82-1.213 1.51V17a1 1 0 01-1 1H4a1 1 0 01-1-1v-6.5a1 1 0 011-1h1.5c.434 0 .831-.14 1.15-.375C7.88 8.232 9 6.237 9 4V3a2 2 0 012-2z" />
      </svg>
      <span>
        {voted ? "Helpful" : "Helpful"}
        {" "}
        <span className="tabular-nums">({count})</span>
      </span>
    </button>
  );
}
