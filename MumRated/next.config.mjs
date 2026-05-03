/**
 * next.config.mjs
 *
 * Sentry is wrapped around the config via withSentryConfig (see bottom).
 * Required env vars for Sentry source-map upload (build-time only):
 *   SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
 */
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Serve AVIF first (best compression), fall back to WebP, then original.
    // Next.js negotiates based on Accept header — no client JS required.
    formats: ["image/avif", "image/webp"],

    // Cloudinary is the only permitted remote image host.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      // Google profile pictures served through OAuth sign-in
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],

    // Responsive breakpoints optimised for a mobile-first Nigerian audience.
    // Avoids generating unused sizes; keeps the image CDN cache lean.
    deviceSizes: [390, 430, 768, 1024, 1280],
    imageSizes: [48, 96, 200, 400, 800],

    // 80% quality is visually indistinguishable from 90% at ~30% smaller file.
    // AVIF achieves roughly 50% smaller than equivalent-quality WebP.
    minimumCacheTTL: 604800, // 7 days — listings don't change images often
  },

  // Compress HTML/JSON responses
  compress: true,

  // Power header for caching in Vercel / CDN
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
      {
        // Static assets and _next chunks — long-lived cache
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Sitemap — cache for 1 hour, revalidate in background
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organisation and project (set in Vercel env vars)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps to Sentry on every production build.
  // Requires SENTRY_AUTH_TOKEN — generate at sentry.io → Settings → Auth Tokens.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Hides Sentry webpack plugin output from normal build logs
  silent: !process.env.CI,

  // Automatically instrument Next.js data fetching methods
  autoInstrumentServerFunctions: true,

  // Automatically create Sentry releases on deploy
  // (used to correlate source maps with error events)
  automaticVercelMonitors: true,

  // Suppress the Sentry SDK telemetry banner in CLI output
  telemetry: false,
});
