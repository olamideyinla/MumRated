/**
 * Provider layout — authenticated provider-side surface.
 *
 * Trust boundary (business concept § 7.4):
 *   - Providers pay to claim and manage listings.
 *   - Claiming a listing NEVER affects listing visibility, search ranking, or
 *     review treatment. Ranking is driven by ListingStats (avgRating / reviewCount)
 *     which is derived solely from Review records.
 *   - The "Verified" badge signals identity verification, not an endorsement.
 */

import Link from "next/link";
import { requireProvider } from "@/lib/provider";

const NAV_LINKS = [
  { href: "/provider/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/provider/billing", label: "Billing & Plans", icon: "💳" },
];

export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, provider } = await requireProvider();

  const email = session.user?.email ?? "";
  const name = provider.businessName;

  // Show a "pending" banner when identity is not yet verified
  const isPending = !provider.verifiedIdentity;

  return (
    <div className="flex min-h-screen bg-[#F9F6F2]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[#7B1818] text-white flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <p className="font-display font-bold text-lg tracking-tight text-[#C9A227]">
            MumRated
          </p>
          <p className="text-xs text-white/50 mt-0.5 truncate">{name}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <span className="text-base leading-none">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-xs text-white/40 truncate">{email}</p>
          <Link
            href="/"
            className="text-xs text-white/50 hover:text-white/80 transition-colors mt-1 block"
          >
            ← Back to site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {isPending && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-800">
            <strong>Identity verification pending.</strong> Our team is reviewing
            your claim. You&apos;ll receive an email once your listing is verified.
          </div>
        )}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
