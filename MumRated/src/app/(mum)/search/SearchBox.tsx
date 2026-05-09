"use client";

import { useState, useRef } from "react";

interface Props {
  defaultValue?: string;
}

export default function SearchBox({ defaultValue = "" }: Props) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClear() {
    setValue("");
    inputRef.current?.focus();
  }

  return (
    // action="/search" + method="GET" keeps the form functional without JS
    <form
      role="search"
      action="/search"
      method="GET"
      className="mb-8 flex max-w-xl gap-2"
    >
      <label htmlFor="search-input" className="sr-only">
        Search products and services
      </label>

      {/* Input wrapper — relative so the × button can sit inside the border */}
      <div className="relative flex-1">
        <input
          ref={inputRef}
          id="search-input"
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search nappies, crèches, paediatricians…"
          autoFocus
          aria-label="Search products and services reviewed by Nigerian mums"
          // pr-9 leaves room for the × button; hide the browser's native clear (x)
          className="w-full rounded-input border border-border bg-card px-4 py-2.5 pr-9 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson [&::-webkit-search-cancel-button]:hidden"
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            tabIndex={-1}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded text-muted hover:text-dark transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      <button type="submit" className="btn-primary px-5 py-2.5 text-sm">
        Search
      </button>
    </form>
  );
}
