"use client";

import { useState, useTransition } from "react";

interface Props {
  reviewId: string;
  existingReply: string | null;
  repliedAt: Date | null;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProviderReplyBox({
  reviewId,
  existingReply,
  repliedAt,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(existingReply ?? "");
  const [saved, setSaved] = useState(existingReply ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(repliedAt);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (text.trim().length < 5) {
      setError("Response must be at least 5 characters.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/provider/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, reply: text.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to save response.");
        return;
      }

      setSaved(text.trim());
      setSavedAt(new Date());
      setEditing(false);
    });
  };

  // Collapsed state: has a saved reply
  if (saved && !editing) {
    return (
      <div className="mt-2 rounded-lg bg-bgLight border border-border px-4 py-3">
        <p className="text-xs font-semibold text-crimson mb-1">
          Provider response
          {savedAt && (
            <span className="font-normal text-muted ml-1">
              · {formatDate(savedAt)}
            </span>
          )}
        </p>
        <p className="text-sm text-dark leading-relaxed">{saved}</p>
        <button
          onClick={() => setEditing(true)}
          className="mt-2 text-xs text-muted hover:text-dark underline"
        >
          Edit response
        </button>
      </div>
    );
  }

  // Editing / adding state
  if (editing || !saved) {
    return (
      <div className="mt-2 space-y-2">
        <label className="block text-xs font-semibold text-muted uppercase tracking-wide">
          {saved ? "Edit your response" : "Add a public response"}
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Respond publicly to this review…"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm text-dark placeholder:text-muted/60 resize-none focus:outline-none focus:ring-2 focus:ring-crimson/30"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-crimson text-white px-4 py-1.5 text-xs font-semibold hover:bg-crimson/90 transition-colors disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Post response"}
          </button>
          {saved && (
            <button
              onClick={() => {
                setText(saved);
                setEditing(false);
                setError(null);
              }}
              className="text-xs text-muted hover:text-dark"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // Shouldn't reach here, but handle gracefully
  return null;
}
