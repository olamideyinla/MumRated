import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { notFound } from "next/navigation";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard", icon: "⊞" },
  { href: "/admin/moderation", label: "Moderation", icon: "🛡" },
  { href: "/admin/listings", label: "Listings", icon: "📋" },
  { href: "/admin/categories", label: "Categories", icon: "🗂" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "📜" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) notFound();

  const email = session!.user!.email!;

  return (
    <div className="flex min-h-screen bg-[#F9F6F2]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[#3B2010] text-white flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <p className="font-display font-bold text-lg tracking-tight text-[#C9A227]">
            MumRated
          </p>
          <p className="text-xs text-white/50 mt-0.5">Admin Panel</p>
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

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
