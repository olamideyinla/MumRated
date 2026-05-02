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

export default function MumLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main>{children}</main>
    </>
  );
}
