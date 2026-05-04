import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works | MumRated!",
  description:
    "MumRated! connects mums with honest, experience-based reviews on baby products and family services. Here's how to find listings, leave reviews, and trust the ratings.",
  openGraph: {
    title: "How It Works | MumRated!",
    description:
      "Find honest reviews from real mums, here's how MumRated! works.",
    type: "website",
    images: [{ url: "/logo-stamp.png", width: 512, height: 512, alt: "MumRated! logo" }],
  },
  twitter: {
    card: "summary",
    title: "How It Works | MumRated!",
    description: "Find honest reviews from real mums, here's how MumRated! works.",
    images: ["/logo-stamp.png"],
  },
};

export const revalidate = 86400;

const steps = [
  {
    number: "01",
    title: "Search or browse",
    body: "Type what you're looking for, a brand of nappies, a crèche in your area, a paediatrician near you. Or browse by category to discover options you hadn't considered. Every listing on MumRated! can be reviewed, whether the provider is signed up or not.",
  },
  {
    number: "02",
    title: "Read real reviews",
    body: "Every review is written by a mum (or dad) who has actually used the product or service. Reviewers share their child's age at the time, the city they're in, and a star rating across key dimensions. No incentivised reviews. No paid placements. Just honest experience.",
  },
  {
    number: "03",
    title: "Leave your own review",
    body: "Had an experience, good or bad, worth sharing? Create a free account and write a review. It takes less than five minutes and helps the next mum make a better decision. Your display name can be kept anonymous if you prefer.",
  },
];

const trustPoints = [
  {
    icon: "★",
    title: "Rankings are merit-based",
    body: "Search results are ordered by average rating and review volume. No business can pay to appear higher. Ever.",
  },
  {
    icon: "✓",
    title: "Reviews belong to mums",
    body: "A provider can respond to a review but cannot delete it. MumRated! only removes reviews that violate our community guidelines (spam, hate speech, or fabricated content).",
  },
  {
    icon: "◎",
    title: "Verified badge means identity-confirmed",
    body: "When you see a verified badge on a provider's listing, it means the business has confirmed their identity with MumRated!. It is not an endorsement of quality, that's what the star rating is for.",
  },
  {
    icon: "⊘",
    title: "Listing is always free",
    body: "Any business that serves mums and families can exist on MumRated!, regardless of whether they've paid us anything. Mums can review any listing at any time.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do I need an account to read reviews?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. All reviews are publicly visible without signing in. An account is only required to write a review, mark a review as helpful, or report a concern.",
      },
    },
    {
      "@type": "Question",
      name: "What if a business isn't listed yet?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can suggest a new listing from any category page. Once added, any mum can review it immediately — the provider doesn't need to know about it or approve it.",
      },
    },
    {
      "@type": "Question",
      name: "Can a provider remove a negative review?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Providers who have claimed their listing can respond publicly to reviews, but they cannot delete them. Only MumRated! can remove a review, and only for a verified violation of community guidelines.",
      },
    },
    {
      "@type": "Question",
      name: "How do I know a reviewer is a real mum?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We verify email addresses at sign-up and use automated signals to detect co-ordinated fake reviews. If you spot something suspicious, use the Report button on any review.",
      },
    },
  ],
};

export default function HowItWorksPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    <div className="container py-12 max-w-2xl space-y-12">
      {/* Header */}
      <header>
        <p className="label mb-2">Platform guide</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-dark leading-tight">
          How MumRated! works
        </h1>
        <p className="mt-4 text-muted text-base leading-relaxed">
          MumRated! is a review platform built around one idea: mums deserve
          honest, experience-based information when making decisions for their
          families. Here&apos;s how it all fits together.
        </p>
      </header>

      <hr className="border-border" />

      {/* Three steps */}
      <section className="space-y-6">
        <h2 className="font-display text-xl font-bold text-dark">
          Finding and leaving reviews
        </h2>
        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-card border border-border bg-bgLight px-5 py-4 flex gap-5"
            >
              <span className="font-display text-2xl font-bold text-gold shrink-0 leading-none mt-0.5">
                {step.number}
              </span>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-dark">
                  {step.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-border" />

      {/* Trust principles */}
      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold text-dark">
            The trust boundary
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            Our core promise is that visibility on MumRated! is never for sale.
            Here&apos;s what that means in practice.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {trustPoints.map((point) => (
            <div
              key={point.title}
              className="rounded-card border border-border bg-card px-4 py-4 space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="text-crimson font-bold">{point.icon}</span>
                <h3 className="font-display font-bold text-dark text-sm">
                  {point.title}
                </h3>
              </div>
              <p className="text-xs text-muted leading-relaxed">{point.body}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">
          Read the full details on our{" "}
          <Link href="/trust" className="text-crimson hover:underline font-medium">
            Trust &amp; Transparency
          </Link>{" "}
          page.
        </p>
      </section>

      <hr className="border-border" />

      {/* FAQ */}
      <section className="space-y-6">
        <h2 className="font-display text-xl font-bold text-dark">
          Common questions
        </h2>
        <div className="space-y-4">
          {[
            {
              q: "Do I need an account to read reviews?",
              a: "No. All reviews are publicly visible without signing in. An account is only required to write a review, mark a review as helpful, or report a concern.",
            },
            {
              q: "What if a business isn't listed yet?",
              a: "You can suggest a new listing from any category page. Once added, any mum can review it immediately, the provider doesn't need to know about it or approve it.",
            },
            {
              q: "Can a provider remove a negative review?",
              a: "No. Providers who have claimed their listing can respond publicly to reviews, but they cannot delete them. Only MumRated! can remove a review, and only for a verified violation of community guidelines.",
            },
            {
              q: "How do I know a reviewer is a real mum?",
              a: "We verify email addresses at sign-up and use automated signals to detect co-ordinated fake reviews. If you spot something suspicious, use the Report button on any review.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="space-y-1">
              <h3 className="font-display font-bold text-dark">{q}</h3>
              <p className="text-sm text-muted leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-border" />

      {/* CTA */}
      <section className="text-center space-y-4">
        <p className="font-display text-lg font-bold text-dark">
          Ready to find your next trusted recommendation?
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/browse" className="btn-primary">
            Browse categories
          </Link>
          <Link href="/sign-in" className="btn-outline">
            Create a free account
          </Link>
        </div>
      </section>
    </div>
    </>
  );
}
