import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mumrated.com";

/**
 * robots.txt — served at /robots.txt.
 *
 * Allow all public mum-facing pages.
 * Block admin and provider routes (they return 404 for non-authenticated
 * users anyway, but blocking here prevents crawlers wasting crawl budget
 * and keeps the routes' existence private).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/provider/dashboard",
          "/provider/billing",
          "/provider/listing/",
          "/api/",
          "/sign-in/check-email",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
