import { requireProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

const TIERS = [
  {
    key: "CLAIM",
    name: "Claim",
    price: "₦15,000 / mo",
    description: "Verify your identity and manage your listing profile.",
    features: [
      "Identity-verified badge on listing",
      "Respond publicly to reviews",
      "Update opening hours, location, photos",
      "Contact email / phone displayed",
    ],
    cta: "Current plan — contact us",
  },
  {
    key: "CLAIM_PLUS",
    name: "Claim+",
    price: "₦25,000 / mo",
    description: "Everything in Claim, plus priority moderation response.",
    features: [
      "Everything in Claim",
      "Priority moderation SLA (48 hrs)",
      "Up to 5 photo gallery images",
      "Quarterly email report",
    ],
    cta: "Upgrade — contact us",
  },
  {
    key: "CLAIM_PRO",
    name: "Claim Pro",
    price: "₦45,000 / mo",
    description: "Full access including API and analytics export.",
    features: [
      "Everything in Claim+",
      "Analytics export (CSV)",
      "API access",
      "Dedicated account manager",
    ],
    cta: "Upgrade — contact us",
  },
] as const;

export default async function ProviderBillingPage() {
  const { provider } = await requireProvider();

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-3xl font-bold text-dark mb-2">
        Billing &amp; Plans
      </h1>
      <p className="text-sm text-muted mb-8">
        Current plan:{" "}
        <span className="font-semibold text-dark">
          {provider.subscriptionTier === "NONE"
            ? "None (unclaimed)"
            : provider.subscriptionTier}
        </span>
      </p>

      {/* Trust boundary callout */}
      <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <strong>Transparency notice:</strong> Your subscription tier has no
        effect on your listing&apos;s position in search results or category
        pages. Rankings are determined solely by mum review data — rating and
        review count. This is a core principle of MumRated and will never
        change.
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const isCurrent = provider.subscriptionTier === tier.key;
          return (
            <div
              key={tier.key}
              className={`rounded-xl border p-5 flex flex-col ${
                isCurrent
                  ? "border-crimson bg-crimson/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="mb-3">
                <p className="font-display font-bold text-dark text-lg">
                  {tier.name}
                </p>
                <p className="text-xl font-semibold text-dark mt-1">
                  {tier.price}
                </p>
                <p className="text-xs text-muted mt-1">{tier.description}</p>
              </div>

              <ul className="flex-1 space-y-1.5 mb-5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-dark">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <span className="block text-center rounded-lg border border-crimson/30 px-4 py-2 text-xs font-semibold text-crimson">
                  Current plan
                </span>
              ) : (
                <a
                  href={`mailto:hello@mumrated.com?subject=Upgrade to ${tier.name} — ${provider.businessName}`}
                  className="block text-center rounded-lg bg-crimson text-white px-4 py-2 text-xs font-semibold hover:bg-crimson/90 transition-colors"
                >
                  {tier.cta}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted">
        To upgrade or downgrade, email{" "}
        <a
          href="mailto:hello@mumrated.com"
          className="underline hover:text-dark"
        >
          hello@mumrated.com
        </a>
        . Payment integration coming soon.
      </p>
    </div>
  );
}
