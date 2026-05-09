"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const REPORT_REASONS = [
  "Inappropriate content",
  "Inaccurate information",
  "Spam or fake review",
  "Other",
] as const;

type Reason = (typeof REPORT_REASONS)[number];

interface Props {
  reviewId: string;
  isAuthenticated: boolean;
}

export default function ReportModal({ reviewId, isAuthenticated }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | "">("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  // Sync open state with native dialog element
  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dialogRef.current?.close();
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleOpen() {
    if (!isAuthenticated) {
      router.push("/sign-in?callbackUrl=" + encodeURIComponent(window.location.pathname));
      return;
    }
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    // Reset after animation
    setTimeout(() => {
      setReason("");
      setDetails("");
      setError("");
      setSubmitted(false);
    }, 200);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) { setError("Please choose a reason."); return; }
    setError("");

    startTransition(async () => {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, reason, details: details.trim() || undefined }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("Couldn't send your report right now, try again in a moment.");
      }
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-xs text-muted hover:text-dark transition"
        aria-label="Report this review"
      >
        Report
      </button>

      {/* Native <dialog> for accessibility */}
      <dialog
        ref={dialogRef}
        onClose={handleClose}
        className="m-auto max-w-sm w-full rounded-card bg-card shadow-card p-0 backdrop:bg-dark/40 backdrop:backdrop-blur-sm"
        style={{ border: "none" }}
      >
        {submitted ? (
          /* Success state */
          <div className="p-6 text-center space-y-3">
            <p className="text-2xl" aria-hidden="true">✓</p>
            <h2 className="font-display font-semibold text-dark">Thanks for flagging this</h2>
            <p className="text-sm text-muted leading-relaxed">
              Our moderation team will take a look. We take every report seriously
              and aim to review it within 24 hours.
            </p>
            <button
              onClick={handleClose}
              className="btn-primary w-full text-sm py-2.5"
            >
              Done
            </button>
          </div>
        ) : (
          /* Report form */
          <form onSubmit={handleSubmit}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
              <h2 className="font-display font-semibold text-dark">Report this review</h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="text-muted hover:text-dark transition p-1"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-muted">
                What’s the issue with this review?
              </p>

              <fieldset className="space-y-2">
                <legend className="sr-only">Report reason</legend>
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-3 rounded-input border p-3 cursor-pointer transition ${
                      reason === r
                        ? "border-crimson bg-crimson/5"
                        : "border-border hover:border-mid"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => { setReason(r); setError(""); }}
                      className="accent-crimson"
                    />
                    <span className="text-sm text-dark">{r}</span>
                  </label>
                ))}
              </fieldset>

              {/* Optional detail, only when "Other" or "Inaccurate" */}
              {(reason === "Other" || reason === "Inaccurate information") && (
                <div>
                  <label className="label" htmlFor="report-details">
                    Tell us more{" "}
                    <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <textarea
                    id="report-details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Briefly describe the issue…"
                    className="mt-1 w-full rounded-input border border-border bg-bgLight px-3.5 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson resize-none"
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="btn-outline flex-1 text-sm py-2.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !reason}
                className="btn-primary flex-1 text-sm py-2.5 disabled:opacity-60"
              >
                {isPending ? "Sending…" : "Submit report"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
