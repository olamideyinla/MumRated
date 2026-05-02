import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Routes that require a signed-in mum
const PROTECTED_PREFIXES = ["/review/new", "/profile"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (needsAuth && !req.auth) {
    // Preserve the destination so we can redirect back after sign-in
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

// Only run middleware on routes that might need protection.
// Exclude static files, images, and the api/auth routes.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)",
  ],
};
