/**
 * Sentry — Edge runtime configuration (middleware, edge API routes)
 *
 * Loaded by Next.js instrumentation (src/instrumentation.ts).
 * The Edge runtime has a restricted API surface — no Node.js built-ins.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
});
