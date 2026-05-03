/**
 * Sentry — Node.js server (RSC / Route Handlers / Server Actions) configuration
 *
 * Loaded by Next.js instrumentation (src/instrumentation.ts).
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",

  // Ignore well-known non-error Next.js redirects / not-founds
  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],
});
