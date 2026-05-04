import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Simple liveness endpoint for uptime monitors (Better Stack, UptimeRobot, etc.).
 * Returns 200 + a JSON body. No auth required. No DB queries.
 *
 * Uptime monitor config:
 *   URL:      https://mumrated.com/api/health
 *   Method:   GET
 *   Interval: 3–5 minutes
 *   Assert:   HTTP status 200 AND response body contains "ok":true
 */
export const dynamic = "force-dynamic"; // never cache this route

export async function GET() {
  return NextResponse.json(
    { ok: true, timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
