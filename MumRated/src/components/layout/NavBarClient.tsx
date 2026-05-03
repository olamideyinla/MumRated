"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import type { Session } from "next-auth";

interface Props {
  session: Session | null;
}

export default function NavBarClient({ session }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  if (!session?.user) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/sign-in" className="btn-outline py-1.5 px-4 text-sm">
          Sign in
        </Link>
        <Link
          href="/sign-in"
          className="btn-primary py-1.5 px-4 text-sm"
        >
          Join MumRated
        </Link>
      </div>
    );
  }

  const { name, image, email } = session.user;
  const displayName = name ?? email ?? "Mum";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Safely read extended fields added in auth callback
  const isVerified = (session.user as { isVerified?: boolean }).isVerified;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-pill px-2 py-1 hover:bg-bgLight transition"
      >
        {/* Avatar */}
        {image ? (
          <Image
            src={image}
            alt={displayName}
            width={32}
            height={32}
            className="rounded-full object-cover ring-2 ring-gold/40"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-crimson text-xs font-bold text-white">
            {initials}
          </span>
        )}

        {/* Name + badge */}
        <span className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-dark max-w-[120px] truncate">
          {displayName}
          {isVerified && (
            <span
              title="Verified mum"
              className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-verified text-white text-[9px] font-bold"
              aria-label="Verified mum"
            >
              ✓
            </span>
          )}
        </span>

        {/* Chevron */}
        <svg
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-52 rounded-card bg-card shadow-card border border-border py-1 animate-fadeIn"
        >
          <div className="px-4 py-2 border-b border-border">
            <p className="text-xs font-semibold text-dark truncate">
              {displayName}
            </p>
            <p className="text-xs text-muted truncate">{email}</p>
          </div>

          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-dark hover:bg-bgLight transition"
          >
            My profile
          </Link>

          <Link
            href="/review/new"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-dark hover:bg-bgLight transition"
          >
            Share your honest take
          </Link>

          <hr className="my-1 border-border" />

          <button
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full text-left px-4 py-2 text-sm text-mid hover:text-dark hover:bg-bgLight transition"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
