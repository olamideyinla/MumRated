/**
 * Next.js Instrumentation hook — loads Sentry for server + edge runtimes.
 *
 * Called once when the Next.js server starts. The browser Sentry config
 * is loaded separately via sentry.client.config.ts (handled by the Sentry
 * webpack plugin configured in next.config.mjs).
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
