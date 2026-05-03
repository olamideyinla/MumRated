/**
 * /trust — MumRated! Trust & Transparency page
 *
 * ⚠️  LEGAL REVIEW DEPENDENCY
 * This page must be reviewed and approved by a Nigerian commercial lawyer
 * before public launch. Specifically:
 *  - The "what gets removed" section for alignment with Nigerian consumer
 *    protection law (FCCPA) and defamation exposure.
 *  - The "claiming" section for any implied warranties.
 *  - The "never sold" list for consistency with the Terms of Use.
 *
 * Flag this as a HARD BLOCKER in LAUNCH_CHECKLIST.md.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How MumRated! Works — Trust & Transparency | MumRated!",
  description:
    "Honest answers to your questions about who can write reviews, how we handle fake or unfair reviews, and what it means when a business is 'verified' on MumRated!",
  openGraph: {
    title: "How MumRated! Works — Trust & Transparency",
    description: "The full truth about how reviews work on MumRated!",
    type: "website",
  },
};

// This page is static — no DB queries, long cache.
export const revalidate = 86400;

export default function TrustPage() {
  return (
    <div className="container py-12 max-w-2xl space-y-10">
      {/* ── Header ─────────────────────────────────────────── */}
      <header>
        <p className="label mb-2">Transparency</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-dark leading-tight">
          How MumRated! works
        </h1>
        <p className="mt-4 text-muted text-base leading-relaxed">
          We built MumRated! because we wanted a place Nigerian mums could trust. That means being
          completely open about how everything works — who can write, what we remove,
          and what money can and cannot buy here.
        </p>
      </header>

      <hr className="border-border" />

      {/* ── Section 1: Who can write a review ──────────────── */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-dark">
          1. Who can write a review?
        </h2>
        <p className="text-dark leading-relaxed">
          Any Nigerian mum (or carer) who has actually used a product or service. That&rsquo;s it.
          You need to create a free account — we ask for an email address so we can contact you
          if there&rsquo;s a problem with your review.
        </p>
        <p className="text-dark leading-relaxed">
          We ask for your child&rsquo;s age band and your city (optional) because those details
          help other mums understand the context of your experience. A crèche review from
          a Lekki mum with a toddler is more useful than a nameless &ldquo;it was nice.&rdquo;
        </p>
        <p className="text-dark leading-relaxed">
          You can choose to post anonymously if you&rsquo;d prefer — your name won&rsquo;t appear,
          but your account still exists behind the scenes. We do this because some sensitive
          reviews (medical, school-related) might affect a mum&rsquo;s relationship with a provider
          if they were easily traced.
        </p>
        <div className="rounded-card bg-bgLight border border-border px-4 py-3 text-sm text-dark">
          <strong>One review per listing, per mum.</strong> We don&rsquo;t allow the same person
          to write multiple reviews for the same product or service — not even from different accounts.
        </div>
      </section>

      {/* ── Section 2: How moderation works ─────────────────── */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-dark">
          2. How moderation works
        </h2>
        <p className="text-dark leading-relaxed">
          Every review goes through an automated screening when it&rsquo;s submitted. We check
          for patterns that suggest fake reviews, spam, medical misinformation, or content that
          would embarrass your mother (and ours). Most genuine reviews pass instantly.
        </p>
        <p className="text-dark leading-relaxed">
          Reviews that trigger a flag are held in a &ldquo;pending review&rdquo; state — they
          remain visible while the MumRated! team reads them. If a review is fine, it&rsquo;s
          cleared. If it breaks the rules below, it&rsquo;s removed.
        </p>
        <p className="text-dark leading-relaxed">
          We also allow other mums to flag reviews they think are unfair or fake. Every flag
          is read by a human. We do not remove reviews just because a business asks us to.
        </p>
      </section>

      {/* ── Section 3: What gets removed ────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-dark">
          3. What gets removed — and why
        </h2>
        <p className="text-dark leading-relaxed">
          We remove a review only when it falls into one of these categories:
        </p>
        <ul className="space-y-2 pl-1">
          {[
            ["Fake reviews", "Posted by someone who clearly never used the product or service, or posted by someone affiliated with the business. We look at account patterns, review timing, and language."],
            ["Hate speech or discrimination", "Anything targeting ethnicity, religion, gender, disability, or any other protected characteristic."],
            ["Dangerous medical claims", "A review that advises mums to stop medication, use an unproven treatment, or make a clinical decision. We flag these and ask the reviewer to rephrase."],
            ["Personal information", "If a review includes someone's home address, phone number, or other private information — especially about a third party."],
            ["Legal orders", "We comply with valid Nigerian court orders. We will not remove content simply because a business threatens legal action — only a court order triggers mandatory removal."],
            ["Clear spam", "Reviews that are clearly promotional content, link farming, or competitor sabotage."],
          ].map(([title, desc]) => (
            <li key={title} className="card-sm px-4 py-3">
              <span className="font-semibold text-dark">{title}:</span>{" "}
              <span className="text-dark">{desc}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted text-sm">
          A negative review is not a reason to remove a review. A business complaining about
          a review is not a reason to remove a review. We exist to protect mums&rsquo; right
          to share genuine experiences.
        </p>
      </section>

      {/* ── Section 4: How listings work ────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-dark">
          4. How listings work
        </h2>
        <p className="text-dark leading-relaxed">
          Any product or service a mum wants to review can appear on MumRated! — we don&rsquo;t
          require businesses to sign up or pay anything. Mums suggest listings; our team
          adds them within 48 hours.
        </p>
        <p className="text-dark leading-relaxed">
          The order you see products and services in is determined entirely by the reviews
          themselves — average rating, number of reviews, and how recent they are.
          Nothing else.
        </p>
        <div className="rounded-card bg-bgLight border border-border px-4 py-3 text-sm text-dark">
          No business has ever paid to appear higher on MumRated!, and no business ever will.
          See the &ldquo;What we will never sell&rdquo; section below.
        </div>
      </section>

      {/* ── Section 5: What claiming means ──────────────────── */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-dark">
          5. What &ldquo;Verified&rdquo; means — and what it doesn&rsquo;t
        </h2>
        <p className="text-dark leading-relaxed">
          Businesses can pay a small annual fee to &ldquo;claim&rdquo; their listing on MumRated!
          When a listing is claimed, you&rsquo;ll see a small{" "}
          <span className="inline-flex items-center gap-1 rounded-pill bg-verified px-2 py-0.5 text-[10px] font-bold text-white">
            ✓ Verified
          </span>{" "}
          badge. This means one thing: we have verified the identity of the business owner.
          We have checked that the person managing the listing is who they say they are.
        </p>
        <p className="text-dark leading-relaxed">
          It does <strong>not</strong> mean:
        </p>
        <ul className="space-y-1 pl-4 list-disc text-dark">
          <li>That we endorse the business or its products</li>
          <li>That we have inspected the premises or tested the products</li>
          <li>That the business gets any kind of ranking advantage</li>
          <li>That negative reviews will be removed at the business&rsquo;s request</li>
        </ul>
        <p className="text-dark leading-relaxed">
          Claimed businesses can respond to reviews — you&rsquo;ll see their replies clearly
          labelled &ldquo;Provider response&rdquo; below the original review. Providers cannot
          edit reviews. They cannot delete reviews. Only MumRated!&rsquo;s moderation team can
          do that.
        </p>
      </section>

      {/* ── Section 6: The never-sold list ──────────────────── */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-dark">
          6. What we will never sell
        </h2>
        <p className="text-dark leading-relaxed">
          This is the list of things that are permanently off the table — no matter how much
          money is involved. We are writing this publicly so you can hold us to it.
        </p>
        <div className="space-y-2">
          {[
            ["Higher placement in search results", "Search results on MumRated! are ranked by review score and count only. We will never sell a higher position."],
            ["A 'recommended' or 'featured' label", "We don't have sponsored slots. There is no badge or label you can pay for that changes how a listing appears relative to others."],
            ["Review removal", "A business cannot pay us to remove a negative review. We will not entertain this conversation."],
            ["Review suppression", "We will not hide, delay, or \"balance\" a negative review to make a listing look better for money."],
            ["Mum data", "We will never sell, rent, or trade the personal information of our users to third parties for commercial purposes."],
            ["Verification of product claims", "Our 'Verified' badge is identity verification only. We will never sell certification, endorsement, or quality marks."],
          ].map(([title, desc]) => (
            <div key={title} className="card-sm px-4 py-3 flex gap-3">
              <span className="text-crimson font-bold flex-shrink-0 mt-0.5" aria-hidden="true">✗</span>
              <div>
                <span className="font-semibold text-dark">{title}:</span>{" "}
                <span className="text-dark text-sm">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 7: Contact & questions ──────────────────── */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-dark">
          7. Questions?
        </h2>
        <p className="text-dark leading-relaxed">
          If you have questions about a specific review, a listing, or anything on this page,
          email us at{" "}
          <a href="mailto:hello@mumrated.com" className="text-crimson hover:underline font-medium">
            hello@mumrated.com
          </a>
          . We read every message and respond within 48 hours (usually faster).
        </p>
        <p className="text-dark leading-relaxed">
          You can also read our{" "}
          <Link href="/terms" className="text-crimson hover:underline font-medium">Terms of Use</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-crimson hover:underline font-medium">Privacy Policy</Link>
          {" "}for the legal detail behind everything on this page.
        </p>
      </section>

      <hr className="border-border" />

      <footer className="text-xs text-muted space-y-1">
        <p>Last updated: May 2025. This page is reviewed every 6 months.</p>
        <p className="font-semibold text-dark">
          {/* LEGAL REVIEW DEPENDENCY — see file header */}
          ⚠️ This page is pending review by a Nigerian commercial lawyer before public launch.
        </p>
      </footer>
    </div>
  );
}
