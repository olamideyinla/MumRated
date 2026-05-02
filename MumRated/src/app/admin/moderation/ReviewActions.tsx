"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveReview,
  removeReview,
  restoreReview,
  resolveReports,
} from "./actions";

interface Props {
  reviewId: string;
  currentStatus: string;
  listingId: string;
}

export default function ReviewActions({
  reviewId,
  currentStatus,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function handleAction(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  function openRemoveDialog() {
    setReason("");
    setError(null);
    dialogRef.current?.showModal();
  }

  function handleRemove() {
    if (!reason.trim()) {
      setError("Please provide a reason.");
      return;
    }
    handleAction(async () => {
      await removeReview(reviewId, reason.trim());
      dialogRef.current?.close();
    });
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {currentStatus !== "PUBLISHED" && currentStatus !== "REMOVED" && (
        <button
          onClick={() => handleAction(() => approveReview(reviewId))}
          disabled={isPending}
          className="rounded px-3 py-1.5 text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
        >
          Approve & Publish
        </button>
      )}

      {currentStatus === "PUBLISHED" && (
        <button
          onClick={() => handleAction(() => resolveReports(reviewId))}
          disabled={isPending}
          className="rounded px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
        >
          Resolve Reports
        </button>
      )}

      {currentStatus !== "REMOVED" && (
        <button
          onClick={openRemoveDialog}
          disabled={isPending}
          className="rounded px-3 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
        >
          Remove
        </button>
      )}

      {(currentStatus === "REMOVED" || currentStatus === "HIDDEN") && (
        <button
          onClick={() => handleAction(() => restoreReview(reviewId))}
          disabled={isPending}
          className="rounded px-3 py-1.5 text-xs font-medium bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 transition"
        >
          Restore
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Remove reason dialog */}
      <dialog
        ref={dialogRef}
        className="rounded-lg p-6 w-full max-w-md shadow-xl backdrop:bg-black/40"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          Remove review
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          Provide a reason (internal, not shown to the reviewer).
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Defamatory content, violates community guidelines"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="rounded bg-red-600 text-white px-4 py-2 text-sm hover:bg-red-700 disabled:opacity-50 transition"
          >
            {isPending ? "Removing…" : "Confirm remove"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
