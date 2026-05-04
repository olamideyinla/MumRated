"use client";

import { useTransition } from "react";
import { softDeleteListing } from "./actions";

export default function DeleteListingButton({
  listingId,
  name,
}: {
  listingId: string;
  name: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const reason = window.prompt(
      `Reason for hiding "${name}"?`,
      "Admin removal",
    );
    if (reason === null) return; // cancelled
    startTransition(async () => {
      await softDeleteListing(listingId, reason || "Admin removal");
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "Hiding…" : "Hide"}
    </button>
  );
}
