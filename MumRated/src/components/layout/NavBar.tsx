import { auth } from "@/auth";
import Link from "next/link";
import NavBarClient from "./NavBarClient";

export default async function NavBar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-display text-xl font-bold text-crimson tracking-tight"
        >
          MumRated<span className="text-gold">!</span>
        </Link>

        {/* Centre nav links — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/baby-products" className="nav-link">
            Baby products
          </Link>
          <Link href="/creches" className="nav-link">
            Crèches
          </Link>
          <Link href="/paediatricians" className="nav-link">
            Paediatricians
          </Link>
          <Link href="/tutors" className="nav-link">
            Tutors
          </Link>
        </nav>

        {/* Right side — auth state */}
        <NavBarClient session={session} />
      </div>
    </header>
  );
}
