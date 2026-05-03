/**
 * Sentry — browser (client) configuration
 *
 * This file is loaded automatically by Next.js when Sentry instrumentation
 * is enabled. It initialises Sentry in the browser runtime.
 *
 * Required env vars (set in Vercel dashboard + .env.local):
 *   NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
 *   SENTRY_ORG=mumrated
 *   SENTRY_PROJECT=mumrated-web
 *   SENTRY_AUTH_TOKEN=<source-maps-upload-token>   ← build-time only
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Trace 10% of transactions in production; 100% in dev/preview
  tracesSampleRate: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.1 : 1.0,

  // Session replays — 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Only upload source maps in production — reduces bundle size in dev
  enabled: process.env.NODE_ENV === "production",

  // Integrate replays (adds ~50 KB; acceptable for error debugging)
  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media in replays by default
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Attach environment + release tags for filtering in Sentry dashboard
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
});
