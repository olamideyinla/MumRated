# MumRated! — Schema Design Notes

## The Trust Boundary

MumRated!'s core brand promise is: **Say it. Rate it. Trust it.**

That promise collapses the moment a mum suspects that a listing appears at the top of results because the provider paid for it. This document explains how the schema is designed to make that impossible — not just by policy, but structurally.

---

## What is the trust boundary?

> **Listings are always free. Claiming is paid. Visibility is never for sale.**

| Rule | Enforcement |
|---|---|
| Any business can be listed and reviewed | `Listing` is created freely; no subscription required |
| Providers pay to *manage* their listing (respond, update) | `Provider.subscriptionTier` gates provider features |
| Subscription status has zero effect on ranking | `subscriptionTier` lives in a separate table; ranking queries never touch it |

---

## How the schema enforces this

### 1. The `Listing` model has no commercial field

Search ranking can only sort by data that exists in the schema. The `Listing` model deliberately omits:

```
✗  featured       Boolean    — would allow paid placement
✗  promoted       Boolean    — same
✗  boosted        Boolean    — same
✗  rankScore      Float      — could be updated on payment
✗  promotedUntil  DateTime   — timed paid placement
✗  paidPlacement  Int        — ordered paid placement
```

This is documented with a large comment block in `prisma/schema.prisma`. Any PR that adds one of these fields should be rejected.

### 2. Ranking data lives in `ListingStats` — driven solely by reviews

```
ListingStats
  avgRating    Float     ← recomputed when review status changes
  reviewCount  Int       ← same
  lastReviewAt DateTime  ← same
```

The canonical ranking query:
```sql
SELECT l.*, ls.avg_rating, ls.review_count
FROM listing l
JOIN listing_stats ls ON ls.listing_id = l.id
WHERE l.category_id = ?
ORDER BY ls.avg_rating DESC, ls.review_count DESC;
```

`ListingStats` is updated **only** when a `Review` record changes status (PUBLISHED → HIDDEN, HIDDEN → PUBLISHED, etc.). It is never updated in response to a payment event.

### 3. `Provider.subscriptionTier` is deliberately in a separate table

`subscriptionTier` is on the `Provider` model, which is **not joined** into listing search or browse queries. A developer would have to actively introduce a `JOIN providers` into the ranking query and then add a condition on `subscription_tier` — a change that would be visible in code review.

Compare this with the alternative (subscription tier on Listing):
```
// BAD — do NOT do this
model Listing {
  subscriptionTier SubscriptionTier   // ← now it's one query away from ranking
}
```

By keeping it on Provider, two things are required to break the trust boundary:
1. Add the JOIN
2. Write the condition

Both are visible, reviewable, and easy to flag.

### 4. The audit log (`AdminAction`) is append-only

Every moderation decision (hiding a review, approving a claim) creates an `AdminAction` row. Rows are never deleted. This means:

- If a review was hidden and someone wants to know why, the answer is always findable.
- If a claim was approved without a reason, the empty `reason` field is visible in the log.
- Any tampering with ranking (e.g. manually editing `ListingStats.avgRating`) would need to be done outside Prisma, which is itself an audit red flag.

---

## What subscription tiers actually unlock

| Tier | Capabilities |
|---|---|
| `NONE` | Listing exists; mums can review it; provider has no access |
| `CLAIM` | Provider can respond to reviews, update description/photos |
| `CLAIM_PLUS` | Everything in CLAIM + priority moderation SLA |
| `CLAIM_PRO` | Everything in CLAIM_PLUS + analytics export, API access |

None of these tiers affect:
- Position in category browse
- Position in search results
- Whether the listing appears at all
- `ListingStats.avgRating` or `ListingStats.reviewCount`

---

## Code review checklist for future contributors

When reviewing any PR that touches `Listing`, `ListingStats`, or the query layer, check:

- [ ] No new field on `Listing` that could affect sort order
- [ ] No JOIN from `ListingStats` to `Provider` in ranking queries
- [ ] `ListingStats` updates triggered only by `Review` status changes
- [ ] `AdminAction` log includes an entry for every moderation decision
- [ ] `HelpfulVote` unique constraint `[reviewId, userId]` is intact

---

## Relationship diagram (simplified)

```
User ──────────┬──── Review ────────────── Listing ──────── ListingStats
               │         │                     │
               │    HelpfulVote           Category
               │         │
               └──── Report
                         │
                    AdminAction
                         │
                       User (admin)

Provider ──── Listing (via claimedByProviderId)
              (subscriptionTier has no path to ListingStats)
```

The absence of a line between `Provider.subscriptionTier` and `ListingStats` is intentional and load-bearing.
