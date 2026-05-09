/**
 * /terms, Terms of Use (placeholder)
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  LEGAL REVIEW REQUIRED BEFORE PUBLIC LAUNCH                  ║
 * ║                                                                  ║
 * ║  This is a PLACEHOLDER document. It MUST be reviewed and         ║
 * ║  replaced by a complete Terms of Use drafted or reviewed by a    ║
 * ║  qualified Nigerian commercial lawyer before any public launch.  ║
 * ║                                                                  ║
 * ║  Priority items for counsel:                                     ║
 * ║   • User-generated content ownership and licensing               ║
 * ║   • Liability limitation for review accuracy                     ║
 * ║   • NDPR (Nigeria Data Protection Regulation) compliance         ║
 * ║   • Governing law, Nigerian Federal jurisdiction                ║
 * ║   • Provider subscription terms and refund policy                ║
 * ║   • Dispute resolution mechanism                                 ║
 * ║                                                                  ║
 * ║  This file is a HARD BLOCKER in LAUNCH_CHECKLIST.md.            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use | MumRated!",
  description: "MumRated! Terms of Use, the rules for using our platform.",
  robots: { index: false }, // don't index until lawyer-reviewed
};

export const revalidate = 86400;

export default function TermsPage() {
  return (
    <div className="container py-12 max-w-2xl space-y-8">
      {/* ── Lawyer review banner ──────────────────────────────── */}
      <div className="rounded-card border-2 border-amber-400 bg-amber-50 px-5 py-4">
        <p className="font-bold text-amber-800 text-sm mb-1">
          ⚠️ Draft, Pending Nigerian commercial lawyer review
        </p>
        <p className="text-amber-700 text-sm leading-relaxed">
          This document is a working draft and has not yet been reviewed by legal counsel.
          It is published here for transparency during the soft-launch period only.
          It will be replaced with a lawyer-reviewed version before public launch.
          For questions, email{" "}
          <a href="mailto:hello@mumrated.com" className="underline">hello@mumrated.com</a>.
        </p>
      </div>

      <header>
        <h1 className="font-display text-3xl font-bold text-dark">Terms of Use</h1>
        <p className="text-muted text-sm mt-2">
          Effective date: [DATE, to be confirmed by counsel] · Last updated: May 2025
        </p>
      </header>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">1. Who we are</h2>
        <p>
          MumRated! (“MumRated!”, “we”, “us”) is a consumer
          review platform operated in Nigeria. By using our website at mumrated.com and any
          associated applications, you agree to these Terms of Use.
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">2. Eligibility</h2>
        <p>
          You must be at least 18 years old to create an account and submit reviews. By creating
          an account, you confirm that you meet this requirement.
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">3. Your reviews</h2>
        <p>
          When you submit a review, you confirm that:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You have genuinely used the product or service you are reviewing.</li>
          <li>The review represents your honest personal opinion.</li>
          <li>You are not affiliated with the business you are reviewing, or if you are, you have disclosed this.</li>
          <li>The content does not contain unlawful material, hate speech, or false statements of fact presented as true.</li>
        </ul>
        <p>
          You retain ownership of the content you submit. By submitting a review, you grant
          MumRated! a worldwide, royalty-free, non-exclusive licence to display, reproduce, and
          distribute your review on our platform.
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">4. Content we remove</h2>
        <p>
          We may remove content that violates these Terms. Our moderation standards are described
          in full on our{" "}
          <Link href="/trust" className="text-crimson hover:underline">Trust page</Link>.
          We will not remove content solely at the request of a business subject to a negative review.
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">5. Provider accounts</h2>
        <p>
          Businesses may pay to claim a listing. Claimed listings receive a “Verified”
          badge (identity verification only) and the ability to respond to reviews. Claiming a
          listing does not affect its ranking in search results or category pages. Subscription
          fees are non-refundable. [COUNSEL: add full payment and cancellation terms here.]
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">6. Limitation of liability</h2>
        <p>
          MumRated! is a platform for user-generated content. We are not responsible for the
          accuracy, completeness, or reliability of any review published by a user.
          [COUNSEL: insert full limitation of liability clause compliant with Nigerian law here.]
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">7. Governing law</h2>
        <p>
          These Terms are governed by the laws of the Federal Republic of Nigeria.
          [COUNSEL: add jurisdiction clause and dispute resolution mechanism.]
        </p>
      </section>

      <section className="space-y-4 text-dark leading-relaxed">
        <h2 className="font-display text-xl font-bold">8. Contact</h2>
        <p>
          For any questions about these Terms, email us at{" "}
          <a href="mailto:hello@mumrated.com" className="text-crimson hover:underline">
            hello@mumrated.com
          </a>.
        </p>
      </section>

      <hr className="border-border" />
      <p className="text-xs text-muted">
        This draft will be replaced with the final lawyer-reviewed version before public launch.
        See <Link href="/trust" className="underline">Trust & Transparency</Link> for our principles.
      </p>
    </div>
  );
}
