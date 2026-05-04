import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | MumRated!",
  description:
    "MumRated! is a reviews platform built for mums, honest, experience-based ratings on baby products and family services. Learn who we are and why we built this.",
  openGraph: {
    title: "About Us | MumRated!",
    description:
      "MumRated!, honest reviews from real mums, for every family.",
    type: "website",
  },
};

export const revalidate = 86400;

const values = [
  {
    title: "Honesty over harmony",
    body: "A 2-star review is as valuable as a 5-star one. We don't suppress negative feedback, we surface it clearly so mums can make informed decisions.",
  },
  {
    title: "Mums come first",
    body: "Every product decision, every policy, every feature is tested against one question: does this help mums, or does it serve a commercial interest at their expense?",
  },
  {
    title: "Trust is the product",
    body: "We earn no revenue from ranking or visibility. Our only sustainable model is building a platform mums trust so completely that they return, and tell other mums.",
  },
  {
    title: "Built for where you are",
    body: "MumRated! was designed for families in Africa first, not adapted from a Western template. That means local brands, local services, local pricing context, and local voices at the centre.",
  },
];

export default function AboutPage() {
  return (
    <div className="container py-12 max-w-2xl space-y-12">
      {/* Header */}
      <header>
        <p className="label mb-2">Our story</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-dark leading-tight">
          About MumRated!
        </h1>
        <p className="mt-4 text-muted text-base leading-relaxed">
          Say it. Rate it. Trust it.
        </p>
      </header>

      <hr className="border-border" />

      {/* Origin */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-dark">
          Why we built this
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          When you&apos;re a new mum, every decision feels high-stakes, which
          formula to try, which cr&egrave;che to trust with your baby, which
          paediatrician actually listens. And yet the information you need most
          is scattered across WhatsApp groups, buried in comment threads, or
          simply word-of-mouth from whoever you happen to know.
        </p>
        <p className="text-sm text-muted leading-relaxed">
          MumRated! was built to fix that. We wanted one place where mums could
          find honest, experience-based reviews on the products and services
          that matter most to their families, written by people who&apos;ve
          actually been there.
        </p>
        <p className="text-sm text-muted leading-relaxed">
          We started in Nigeria because that&apos;s where the gap was clearest.
          But the need is universal: every mum, everywhere, deserves access to
          trusted information from other mums.
        </p>
      </section>

      <hr className="border-border" />

      {/* What we cover */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-dark">
          What MumRated! covers
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          From nappies to cr&egrave;ches, baby formula to birthday party
          planners, if it&apos;s relevant to a mum&apos;s life with her child,
          it belongs on MumRated!.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              category: "Products",
              examples:
                "Baby formula, nappies, prams, feeding gear, wipes, sterilisers",
            },
            {
              category: "Childcare",
              examples: "Crèches, day-care centres, nannies, after-school care",
            },
            {
              category: "Health",
              examples: "Paediatricians, child dentists, lactation consultants",
            },
            {
              category: "Education",
              examples: "Home tutors, early learning centres, nursery schools",
            },
            {
              category: "Events & celebrations",
              examples:
                "Birthday party planners, bounce houses, children's entertainers",
            },
            {
              category: "Photography",
              examples:
                "Newborn photographers, family portrait studios, baby milestone shoots",
            },
          ].map((item) => (
            <div
              key={item.category}
              className="rounded-card border border-border bg-bgLight px-4 py-3"
            >
              <p className="font-display font-bold text-dark text-sm">
                {item.category}
              </p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                {item.examples}
              </p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">
          Don&apos;t see your category?{" "}
          <a
            href="mailto:hello@mumrated.com"
            className="text-crimson hover:underline font-medium"
          >
            Tell us what&apos;s missing.
          </a>
        </p>
      </section>

      <hr className="border-border" />

      {/* Values */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-dark">
          What we stand for
        </h2>
        <div className="space-y-3">
          {values.map((v) => (
            <div key={v.title} className="space-y-1">
              <h3 className="font-display font-bold text-dark">{v.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-border" />

      {/* Contact */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-dark">
          Get in touch
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          We&apos;re a small team and we read every message. Whether you have a
          question, a suggestion, a complaint, or just want to say hello , 
          we&apos;d love to hear from you.
        </p>
        <div className="rounded-card bg-bgLight border border-border px-5 py-4 space-y-2 text-sm">
          <p>
            <span className="font-medium text-dark">General enquiries: </span>
            <a
              href="mailto:hello@mumrated.com"
              className="text-crimson hover:underline font-medium"
            >
              hello@mumrated.com
            </a>
          </p>
          <p>
            <span className="font-medium text-dark">Provider claims: </span>
            <a
              href="mailto:hello@mumrated.com"
              className="text-crimson hover:underline font-medium"
            >
              hello@mumrated.com
            </a>
          </p>
          <p>
            <span className="font-medium text-dark">Report a concern: </span>
            Use the report button on any review, or email us directly.
          </p>
        </div>
      </section>

      <hr className="border-border" />

      {/* CTA */}
      <section className="text-center space-y-4">
        <p className="font-display text-lg font-bold text-dark">
          Join the community
        </p>
        <p className="text-sm text-muted">
          Every review you write makes it easier for the next mum to make a
          confident decision.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/sign-in" className="btn-primary">
            Create a free account
          </Link>
          <Link href="/browse" className="btn-outline">
            Browse listings
          </Link>
        </div>
      </section>
    </div>
  );
}
