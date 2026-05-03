// Mum-facing layout
// Wraps all public / consumer-side routes:
//   /               → home (browse reviews)
//   /browse         → filtered review grid
//   /category/[id]  → category page
//   /item/[id]      → item detail
//   /review/new     → write a review (multi-step, auth-protected)
//   /search         → search
//   /profile        → logged-in mum profile
//   /about          → info pages (about / how-it-works / faq / contact)

import NavBar from "@/components/layout/NavBar";
import Link from "next/link";

export default function MumLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main id="main-content">{children}</main>
      <footer className="border-t border-border bg-bgLight mt-auto">
        <div className="container py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <p className="font-display font-bold text-dark">MumRated!</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
            <Link href="/trust" className="hover:text-crimson transition-colors">
              Trust &amp; Transparency
            </Link>
            <Link href="/terms" className="hover:text-crimson transition-colors">
              Terms of Use
            </Link>
            <Link href="/privacy" className="hover:text-crimson transition-colors">
              Privacy Policy
            </Link>
            <a href="mailto:hello@mumrated.com" className="hover:text-crimson transition-colors">
              Contact
            </a>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} MumRated!</p>
        </div>
      </footer>
    </>
  );
}
