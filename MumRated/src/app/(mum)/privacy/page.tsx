/**
 * /privacy — Privacy Policy (placeholder)
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  LEGAL REVIEW REQUIRED BEFORE PUBLIC LAUNCH                  ║
 * ║                                                                  ║
 * ║  This is a PLACEHOLDER document. It MUST be reviewed and         ║
 * ║  replaced by a complete Privacy Policy drafted or reviewed by    ║
 * ║  a qualified Nigerian commercial lawyer before any public launch. ║
 * ║                                                                  ║
 * ║  NDPR COMPLIANCE IS THE PRIORITY:                                ║
 * ║   The Nigeria Data Protection Regulation (NDPR) 2019 and the     ║
 * ║   Nigeria Data Protection Act 2023 (NDPA) impose specific        ║
 * ║   obligations on data controllers. Key items for counsel:        ║
 * ║                                                                  ║
 * ║   • Lawful basis for processing (consent / legitimate interest)  ║
 * ║   • Data subject rights: access, rectification, deletion,        ║
 * ║     portability, objection                                       ║
 * ║   • Data retention schedules for each data category              ║
 * ║   • Third-party processor agreements (Supabase/Vercel/           ║
 * ║     Cloudinary — all non-Nigerian hosting; cross-border transfer ║
 * ║     provisions required)                                         ║
 * ║   • NITDA registration requirement (organisations processing     ║
 * ║     personal data of ≥1,000 Nigerian data subjects per month)    ║
 * ║   • Cookie consent — Analytics and Sentry set cookies            ║
 * ║   • Breach notification obligations                              ║
 * ║                                                                  ║
 * ║  This file is a HARD BLOCKER in LAUNCH_CHECKLIST.md.            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | MumRated!",
  description: "How MumRated! collects, uses, and protects your personal information.",
  robots: { index: false }, // don't index until lawyer-reviewed
};

export const revalidate = 86400;

export default function PrivacyPage() {
  return (
    <div className="container py-12 max-w-2xl space-y-8">
      {/* ── Lawyer review banner ──────────────────────────────── */}
      <div className="rounded-card border-2 border-amber-400 bg-amber-50 px-5 py-4">
        <p className="font-bold text-amber-800 text-sm mb-1">
          ⚠️ Draft — Pending Nigerian commercial lawyer review (NDPR priority)
        </p>
        <p className="text-amber-700 text-sm leading-relaxed">
          This document is a working draft. NDPR / NDPA compliance review by qualified
          Nigerian legal counsel is required before public launch. This version is published
          for transparency during soft-launch only.
        </p>
      </div>

      <header>
        <h1 className="font-display text-3xl font-bold text-dark">Privacy Policy</h1>
        <p className="text-muted text-sm mt-2">
          Effective date: [DATE — to be confirmed by counsel] · Last updated: May 2025
        </p>
      </header>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">1. Who this policy applies to</h2>
        <p>
          This policy applies to all users of mumrated.com — mums who write reviews, visitors
          who read reviews, and businesses who claim listings. It is published to meet our
          obligations under the Nigeria Data Protection Regulation (NDPR) 2019 and the Nigeria
          Data Protection Act 2023 (NDPA).
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">2. What information we collect</h2>

        <h3 className="font-semibold text-dark">When you create an account:</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Email address (required)</li>
          <li>Display name (optional, chosen by you)</li>
          <li>Profile photo (optional, Cloudinary-hosted)</li>
          <li>City and country (optional)</li>
          <li>Child&rsquo;s age band — e.g. &ldquo;Toddler&rdquo;, not exact date of birth (optional)</li>
          <li>If you sign in with Google: your name and profile photo from Google</li>
        </ul>

        <h3 className="font-semibold text-dark mt-4">When you write a review:</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Review text and star rating</li>
          <li>Optional structured answers (e.g. &ldquo;Would you buy again?&rdquo;)</li>
          <li>Optional photos (uploaded to Cloudinary)</li>
          <li>The date and time of submission (stored automatically)</li>
        </ul>

        <h3 className="font-semibold text-dark mt-4">Automatically collected:</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Standard web server logs (IP address, browser type, pages visited)</li>
          <li>Error traces via Sentry (may include device info and page state at time of error)</li>
          <li>Session cookies set by Auth.js for authentication</li>
        </ul>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">3. How we use your information</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li><strong>To provide the service:</strong> Display your reviews, maintain your account, enable login.</li>
          <li><strong>To moderate content:</strong> Detect spam, fake reviews, and content that breaks our rules.</li>
          <li><strong>To contact you:</strong> Email you if there is a problem with your review or your account.</li>
          <li><strong>To fix errors:</strong> Sentry error reports help us identify and fix bugs.</li>
          <li><strong>To comply with law:</strong> We will disclose information if required by a valid Nigerian court order.</li>
        </ul>
        <p className="text-sm">
          We do <strong>not</strong> use your data for advertising. We do not sell your data.
          We do not share your data with third parties for marketing purposes.
          [COUNSEL: confirm lawful basis under NDPR for each processing activity above.]
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">4. Who we share data with</h2>
        <p className="text-sm">
          We use the following service providers to operate MumRated!. Each is a data processor
          acting on our instructions:
        </p>
        <div className="space-y-2">
          {[
            ["Supabase (PostgreSQL database)", "Hosted on AWS us-east-1 (USA). Stores all account and review data. [COUNSEL: cross-border transfer safeguards required.]"],
            ["Vercel (web hosting)", "Hosted on AWS / Cloudflare Edge globally. Serves the website. [COUNSEL: confirm adequacy or appropriate safeguards.]"],
            ["Cloudinary (image hosting)", "USA-based. Stores uploaded photos and profile images."],
            ["Sentry (error tracking)", "USA-based. May receive page URLs, device info, and error context when a user encounters a bug. Data is anonymised where possible."],
            ["Resend (transactional email)", "USA-based. Sends account emails (magic links, review confirmations)."],
            ["Google (OAuth)", "Sign-in with Google shares your Google profile with us on first login."],
          ].map(([name, desc]) => (
            <div key={name} className="card-sm px-4 py-3 text-sm">
              <span className="font-semibold text-dark">{name}:</span>{" "}
              <span className="text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">5. Your rights</h2>
        <p className="text-sm">
          Under the NDPR and NDPA, you have the right to:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>Access</strong> the personal data we hold about you</li>
          <li><strong>Rectify</strong> inaccurate data</li>
          <li><strong>Delete</strong> your account and associated data</li>
          <li><strong>Object</strong> to certain processing activities</li>
          <li><strong>Portability</strong> — request your data in a portable format</li>
          <li><strong>Withdraw consent</strong> where processing is based on consent</li>
        </ul>
        <p className="text-sm">
          To exercise any of these rights, email{" "}
          <a href="mailto:privacy@mumrated.com" className="text-crimson hover:underline">
            privacy@mumrated.com
          </a>. We will respond within 30 days (as required by NDPR Article 2.6).
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">6. Data retention</h2>
        <p className="text-sm">
          [COUNSEL: Insert data retention schedule. Provisional draft below — requires legal review.]
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
          <li>Account data: retained while account is active + 2 years after deletion request</li>
          <li>Reviews: retained for 5 years or until deletion request</li>
          <li>Server logs: 90 days</li>
          <li>Sentry error data: 90 days (Sentry default)</li>
        </ul>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">7. Cookies</h2>
        <p className="text-sm">
          We use session cookies for authentication (required for login to work).
          Sentry may set cookies for session replay. We do not use advertising cookies.
          [COUNSEL: cookie consent banner may be required under NDPR.]
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">8. Contact</h2>
        <p className="text-sm">
          For privacy questions or to exercise your rights:{" "}
          <a href="mailto:privacy@mumrated.com" className="text-crimson hover:underline">
            privacy@mumrated.com
          </a>
        </p>
        <p className="text-sm">
          [COUNSEL: Add Data Protection Officer contact and NITDA registration number if applicable.]
        </p>
      </section>

      <hr className="border-border" />
      <p className="text-xs text-muted">
        NDPR / NDPA legal review by Nigerian counsel is a hard requirement before public launch.
        See also: <Link href="/trust" className="underline">Trust & Transparency</Link>,{" "}
        <Link href="/terms" className="underline">Terms of Use</Link>.
      </p>
    </div>
  );
}
