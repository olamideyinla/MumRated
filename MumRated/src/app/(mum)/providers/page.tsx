import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Providers | MumRated!",
  description:
    "Is your business on MumRated!? Claim your free listing, respond to reviews, and build trust with thousands of mums. Listing is always free.",
  openGraph: {
    title: "For Providers | MumRated!",
    description:
      "Claim your free listing on MumRated! and start building trust with mums.",
    type: "website",
  },
};

export const revalidate = 86400;

const benefits = [
  {
    title: "Respond to reviews",
    body: "A claimed listing lets you reply publicly to any review — good or critical. Mums notice providers who engage honestly and take feedback seriously.",
  },
  {
    title: "Verified badge",
    body: "Verification confirms your business identity. It signals to mums that you're a real, accountable provider — not a ghost listing.",
  },
  {
    title: "Keep your profile current",
    body: "Update your description, location, price range, and contact details whenever things change. Accurate listings get more engagement.",
  },
  {
    title: "Understand your reputation",
    body: "See your average rating, review trends, and what mums say about you most. No analytics dashboard exists yet — that's Tier 2 — but your reviews tell the story.",
  },
];

const principles = [
  {
    label: "Listings are free — always",
    detail:
      "Any product or service that serves mums and families can be listed on MumRated! at no cost. We will never charge for a listing to exist.",
  },
  {
    label: "You cannot pay for a better rank",
    detail:
      "Search results are ordered by review quality and recency. There is no sponsored placement, no boosting, no ranking algorithm you can buy your way into.",
  },
  {
    label: "You cannot delete reviews",
    detail:
      "Reviews belong to the mums who wrote them. You can respond, but you cannot remove. MumRated! only removes reviews that violate community guidelines.",
  },
  {
    label: "Verification ≠ endorsement",
    detail:
      "Claiming and verifying your listing confirms your identity. It does not mean MumRated! endorses the quality of your product or service — that's what the ratings are for.",
  },
];

export default function ProvidersPage() {
  return (
    <div className="container py-12 max-w-2xl space-y-12">
      {/* Header */}
      <header>
        <p className="label mb-2">For businesses</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-dark leading-tight">
          Is your business on MumRated!?
        </h1>
        <p className="mt-4 text-muted text-base leading-relaxed">
          Thousands of mums use MumRated! to decide which products to buy and
          which services to trust with their children. If you serve families,
          your listing is already here — or it can be. Claiming it is free.
        </p>
      </header>

      <hr className="border-border" />

      {/* How listing works */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-dark">
          How listings work
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          Any mum can add a product or service to MumRated! and review it —
          even if the provider has never heard of us. Listings are created by
          the community and belong to the community.
        </p>
        <p className="text-sm text-muted leading-relaxed">
          If your business is already listed, you can claim it. If it isn't,
          you can add it yourself — or ask us to add it by getting in touch.
        </p>
        <div className="rounded-card bg-bgLight border border-border px-5 py-4 space-y-2">
          <p className="font-display font-bold text-dark text-sm">
            What happens when you claim a listing
          </p>
          <ol className="list-decimal list-inside text-sm text-muted space-y-1 leading-relaxed">
            <li>You verify your business identity with MumRated!</li>
            <li>Your listing gets a verified badge visible to all mums</li>
            <li>You can respond publicly to any review on your listing</li>
            <li>You can update your listing details at any time</li>
          </ol>
        </div>
      </section>

      <hr className="border-border" />

      {/* Benefits grid */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-dark">
          What you get with a claimed listing
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-card border border-border bg-card px-4 py-4 space-y-1"
            >
              <h3 className="font-display font-bold text-dark text-sm">
                {b.title}
              </h3>
              <p className="text-xs text-muted leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-border" />

      {/* Trust principles for providers */}
      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold text-dark">
            The rules of the platform
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            MumRated! is built on a trust boundary that protects mums. These
            principles are non-negotiable for every provider on the platform.
          </p>
        </div>
        <div className="space-y-3">
          {principles.map((p) => (
            <div
              key={p.label}
              className="rounded-card border border-border bg-bgLight px-4 py-3 space-y-0.5"
            >
              <p className="font-display font-bold text-dark text-sm">
                {p.label}
              </p>
              <p className="text-xs text-muted leading-relaxed">{p.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-border" />

      {/* Pricing clarity */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-dark">
          What does it cost?
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          Claiming and verifying your listing is paid — this covers the cost of
          identity verification and keeps the platform free for mums. Listing
          itself (unclaimed) is always free, and mums can review any listing at
          any time regardless of whether you've claimed it.
        </p>
        <p className="text-sm text-muted leading-relaxed">
          We're in early access. If you'd like to claim your listing, contact
          us and we'll walk you through the process.
        </p>
      </section>

      <hr className="border-border" />

      {/* CTA */}
      <section className="text-center space-y-4">
        <p className="font-display text-lg font-bold text-dark">
          Ready to take ownership of your reputation?
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/browse" className="btn-primary">
            Find your listing
          </Link>
          <a
            href="mailto:hello@mumrated.com"
            className="btn-outline"
          >
            Contact us to claim
          </a>
        </div>
        <p className="text-xs text-muted">
          Already claimed?{" "}
          <Link href="/sign-in" className="text-crimson hover:underline font-medium">
            Sign in to your provider account
          </Link>
        </p>
      </section>
    </div>
  );
}
