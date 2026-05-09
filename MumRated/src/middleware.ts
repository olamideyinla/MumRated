import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Routes that require a signed-in user (mum or provider)
const PROTECTED_PREFIXES = ["/review/new", "/profile", "/provider/dashboard", "/provider/billing", "/provider/listing"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Also protect /listing/[slug]/review — can't use startsWith alone for this pattern
  const isReviewPage = pathname.startsWith("/listing/") && pathname.endsWith("/review");

  const needsAuth = isReviewPage || PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (needsAuth && !req.auth) {
    // Preserve the destination so we can redirect back after sign-in.
    // Pass an absolute callbackUrl so Auth.js v5 open-redirect validation
    // accepts it cleanly regardless of which beta version is running.
    const url = new URL("/sign-in", req.url);
    const origin = process.env.AUTH_URL ?? req.nextUrl.origin;
    url.searchParams.set("callbackUrl", `${origin}${pathname}`);
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
