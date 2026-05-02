// Provider-facing layout
// Wraps all business / provider-side routes:
//   /provider             → provider dashboard (claimed listings)
//   /provider/claim/[id]  → claim a listing (3-step flow)
//   /provider/settings    → account / subscription settings
//   /provider/reviews     → view & respond to reviews
//
// Trust boundary (from README):
//   - Listings are always FREE to exist (mums can review any business)
//   - Claiming a listing is PAID (₦15,000/month Pro plan)
//   - Visibility in search results is NEVER for sale — ranking is purely by quality

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
