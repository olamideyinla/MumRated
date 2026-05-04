import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import NavBarClient from "./NavBarClient";

export default async function NavBar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2" aria-label="MumRated! — home">
          <Image
            src="/logo-stamp.png"
            alt="MumRated! logo"
            width={38}
            height={38}
            className="rounded-full object-contain"
            style={{ mixBlendMode: "multiply" }}
            priority
          />
          <span className="font-display text-xl font-bold text-crimson tracking-tight">
            MumRated<span className="text-gold">!</span>
          </span>
        </Link>

        {/* Centre nav links — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/how-it-works" className="nav-link">
            How it Works
          </Link>
          <Link href="/browse" className="nav-link">
            Categories
          </Link>
          <Link href="/providers" className="nav-link">
            Providers
          </Link>
          <Link href="/about" className="nav-link">
            About Us
          </Link>
        </nav>

        {/* Right side — auth state */}
        <NavBarClient session={session} />
      </div>
    </header>
  );
}
