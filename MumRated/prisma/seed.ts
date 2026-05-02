/**
 * MumRated! — Prisma Seed
 *
 * Seed data:
 *   5 categories (3 product, 2 service)
 *   10 listings  (6 product, 4 service)
 *   3 sample mums
 *   15 sample reviews
 *   11 helpful votes (cross-user, to demonstrate the unique constraint)
 *
 * Run:  npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding MumRated! database…\n");

  // ── 1. CATEGORIES ────────────────────────────────────────────────────────

  console.log("  → Categories");
  const [catBaby, catNappies, catFood, catCreches, catPaeds] =
    await Promise.all([
      db.category.upsert({
        where: { slug: "baby-products" },
        update: {},
        create: {
          name: "Baby Products",
          slug: "baby-products",
          type: "PRODUCT",
        },
      }),
      db.category.upsert({
        where: { slug: "nappies-essentials" },
        update: {},
        create: {
          name: "Nappies & Essentials",
          slug: "nappies-essentials",
          type: "PRODUCT",
        },
      }),
      db.category.upsert({
        where: { slug: "baby-food-nutrition" },
        update: {},
        create: {
          name: "Baby Food & Nutrition",
          slug: "baby-food-nutrition",
          type: "PRODUCT",
        },
      }),
      db.category.upsert({
        where: { slug: "creches-schools" },
        update: {},
        create: {
          name: "Crèches & Schools",
          slug: "creches-schools",
          type: "SERVICE",
        },
      }),
      db.category.upsert({
        where: { slug: "paediatricians" },
        update: {},
        create: {
          name: "Paediatricians",
          slug: "paediatricians",
          type: "SERVICE",
        },
      }),
    ]);

  const categories = { catBaby, catNappies, catFood, catCreches, catPaeds };
  console.log(`     ✓ ${Object.keys(categories).length} categories`);

  // ── 2. MUMS (Users) ───────────────────────────────────────────────────────

  console.log("  → Users (mums)");
  const [adaeze, ngozi, funke] = await Promise.all([
    db.user.upsert({
      where: { email: "adaeze@mumrated-seed.dev" },
      update: {},
      create: {
        email: "adaeze@mumrated-seed.dev",
        displayName: "Adaeze O.",
        childAgeBand: "INFANT",
        city: "Lagos Island",
        country: "NG",
        isVerified: true,
      },
    }),
    db.user.upsert({
      where: { email: "ngozi@mumrated-seed.dev" },
      update: {},
      create: {
        email: "ngozi@mumrated-seed.dev",
        displayName: "Ngozi E.",
        childAgeBand: "TODDLER",
        city: "Abuja",
        country: "NG",
        isVerified: true,
      },
    }),
    db.user.upsert({
      where: { email: "funke@mumrated-seed.dev" },
      update: {},
      create: {
        email: "funke@mumrated-seed.dev",
        displayName: "Funke B.",
        childAgeBand: "INFANT",
        city: "Port Harcourt",
        country: "NG",
        isVerified: false,
      },
    }),
  ]);

  console.log("     ✓ 3 mums");

  // ── 3. LISTINGS ───────────────────────────────────────────────────────────

  console.log("  → Listings");

  // Products — Nappies (3)
  const pampers = await db.listing.upsert({
    where: { slug: "pampers-premium-care-size-3" },
    update: {},
    create: {
      type: "PRODUCT",
      name: "Pampers Premium Care (Size 3)",
      slug: "pampers-premium-care-size-3",
      description:
        "Double-leg barriers and wetness indicator. Designed for all-night protection.",
      brandOrProvider: "Pampers",
      categoryId: catNappies.id,
      locationText: "Jumia · Shoprite · SPAR",
      priceRangeNGN: "₦4,200 – ₦7,500",
      priceRangeMin: 4200,
      priceRangeMax: 7500,
      createdById: adaeze.id,
    },
  });

  const huggies = await db.listing.upsert({
    where: { slug: "huggies-natural-care-wipes" },
    update: {},
    create: {
      type: "PRODUCT",
      name: "Huggies Natural Care Wipes",
      slug: "huggies-natural-care-wipes",
      description:
        "Fragrance-free baby wipes with natural aloe vera and vitamin E.",
      brandOrProvider: "Huggies",
      categoryId: catNappies.id,
      locationText: "Jumia · Konga · Shoprite",
      priceRangeNGN: "₦2,000 – ₦4,000",
      priceRangeMin: 2000,
      priceRangeMax: 4000,
      createdById: ngozi.id,
    },
  });

  const molfix = await db.listing.upsert({
    where: { slug: "molfix-comfort-fix-size-4" },
    update: {},
    create: {
      type: "PRODUCT",
      name: "Molfix Comfort Fix Nappies (Size 4)",
      slug: "molfix-comfort-fix-size-4",
      description:
        "Budget-friendly nappy with soft inner layer and flexible waistband.",
      brandOrProvider: "Molfix",
      categoryId: catNappies.id,
      locationText: "Jumia · Local supermarkets",
      priceRangeNGN: "₦2,800 – ₦5,000",
      priceRangeMin: 2800,
      priceRangeMax: 5000,
      createdById: funke.id,
    },
  });

  // Products — Baby Food (2)
  const cerelac = await db.listing.upsert({
    where: { slug: "cerelac-wheat-with-milk-stage-1" },
    update: {},
    create: {
      type: "PRODUCT",
      name: "Cerelac Wheat with Milk (Stage 1)",
      slug: "cerelac-wheat-with-milk-stage-1",
      description:
        "Iron-fortified baby cereal for 6+ months. Smooth texture for first foods.",
      brandOrProvider: "Nestlé",
      categoryId: catFood.id,
      locationText: "Jumia · Shoprite · SPAR · Pharmacy",
      priceRangeNGN: "₦3,500 – ₦6,000",
      priceRangeMin: 3500,
      priceRangeMax: 6000,
      createdById: funke.id,
    },
  });

  const aptamil = await db.listing.upsert({
    where: { slug: "aptamil-follow-on-milk-stage-2" },
    update: {},
    create: {
      type: "PRODUCT",
      name: "Aptamil Follow On Milk (Stage 2)",
      slug: "aptamil-follow-on-milk-stage-2",
      description:
        "UK-formulated follow-on milk for 6–12 months. Commonly brought in from abroad.",
      brandOrProvider: "Aptamil",
      categoryId: catFood.id,
      locationText: "iHerb (imported) · some Lagos pharmacies",
      priceRangeNGN: "₦18,000 – ₦32,000",
      priceRangeMin: 18000,
      priceRangeMax: 32000,
      createdById: ngozi.id,
    },
  });

  // Products — Baby Products (1)
  const graco = await db.listing.upsert({
    where: { slug: "graco-fastaction-stroller" },
    update: {},
    create: {
      type: "PRODUCT",
      name: "Graco FastAction Stroller",
      slug: "graco-fastaction-stroller",
      description:
        "One-second fold, compact storage. Multi-position recline suitable from birth.",
      brandOrProvider: "Graco",
      categoryId: catBaby.id,
      locationText: "Jumia · selected Lagos baby stores",
      priceRangeNGN: "₦95,000 – ₦140,000",
      priceRangeMin: 95000,
      priceRangeMax: 140000,
      createdById: adaeze.id,
    },
  });

  // Services — Crèches (2)
  const littleStars = await db.listing.upsert({
    where: { slug: "little-stars-creche-vi" },
    update: {},
    create: {
      type: "SERVICE",
      name: "Little Stars Crèche, Victoria Island",
      slug: "little-stars-creche-vi",
      description:
        "Montessori-influenced nursery school with CCTV access for parents. Ages 6 weeks–5 years.",
      brandOrProvider: "Little Stars Crèche",
      categoryId: catCreches.id,
      locationText: "Victoria Island, Lagos",
      priceRangeNGN: "₦80,000 – ₦120,000/month",
      priceRangeMin: 80000,
      priceRangeMax: 120000,
      claimStatus: "UNCLAIMED",
      createdById: adaeze.id,
    },
  });

  const happyKids = await db.listing.upsert({
    where: { slug: "happy-kids-nursery-ikeja" },
    update: {},
    create: {
      type: "SERVICE",
      name: "Happy Kids Nursery, Ikeja",
      slug: "happy-kids-nursery-ikeja",
      description:
        "Warm, structured nursery school in Ikeja with daily WhatsApp parent updates.",
      brandOrProvider: "Happy Kids",
      categoryId: catCreches.id,
      locationText: "Ikeja, Lagos",
      priceRangeNGN: "₦45,000 – ₦75,000/month",
      priceRangeMin: 45000,
      priceRangeMax: 75000,
      claimStatus: "UNCLAIMED",
      createdById: ngozi.id,
    },
  });

  // Services — Paediatricians (2)
  const drAmaka = await db.listing.upsert({
    where: { slug: "dr-amaka-osei-paediatrician-lekki" },
    update: {},
    create: {
      type: "SERVICE",
      name: "Dr. Amaka Osei — Paediatrician",
      slug: "dr-amaka-osei-paediatrician-lekki",
      description:
        "Consultant paediatrician with 14 years experience. Accepts walk-ins and appointments.",
      brandOrProvider: "Dr. Amaka Osei",
      categoryId: catPaeds.id,
      locationText: "Lekki Phase 1, Lagos",
      priceRangeNGN: "₦15,000 – ₦25,000 per consult",
      priceRangeMin: 15000,
      priceRangeMax: 25000,
      claimStatus: "UNCLAIMED",
      createdById: funke.id,
    },
  });

  const drChukwu = await db.listing.upsert({
    where: { slug: "dr-chukwu-paediatrics-wuse" },
    update: {},
    create: {
      type: "SERVICE",
      name: "Dr. Chukwu Paediatrics, Wuse",
      slug: "dr-chukwu-paediatrics-wuse",
      description:
        "Busy but thorough paediatrics clinic in Wuse 2. Well-organised waiting area.",
      brandOrProvider: "Dr. Chukwu",
      categoryId: catPaeds.id,
      locationText: "Wuse 2, Abuja",
      priceRangeNGN: "₦12,000 – ₦20,000 per consult",
      priceRangeMin: 12000,
      priceRangeMax: 20000,
      claimStatus: "UNCLAIMED",
      createdById: adaeze.id,
    },
  });

  const listings = {
    pampers, huggies, molfix, cerelac, aptamil,
    graco, littleStars, happyKids, drAmaka, drChukwu,
  };
  console.log(`     ✓ ${Object.keys(listings).length} listings`);

  // ── 4. REVIEWS (15) ───────────────────────────────────────────────────────

  console.log("  → Reviews");

  type ReviewInput = {
    listingId: string;
    userId: string;
    rating: number;
    text: string;
    tags: string[];
    cityAtReview: string;
    childAgeBandAtReview: "NEWBORN" | "INFANT" | "TODDLER" | "PRESCHOOL" | "SCHOOL_AGE";
    structuredAnswers: object;
    isAnonymous?: boolean;
    helpfulCount: number;
  };

  const reviewData: ReviewInput[] = [
    // ── Pampers (2 reviews) ──────────────────────────────────────────────
    {
      listingId: pampers.id,
      userId: adaeze.id,
      rating: 5,
      text: "Best nappies I have used since my first born. No leaks overnight, my son sleeps peacefully and wakes up dry. Worth every kobo.",
      tags: ["No leaks", "Overnight safe", "Worth the price"],
      cityAtReview: "Lagos Island",
      childAgeBandAtReview: "INFANT",
      structuredAnswers: {
        wouldBuyAgain: true,
        purchasedFrom: "Shoprite",
        qualityRating: 5,
      },
      helpfulCount: 34,
    },
    {
      listingId: pampers.id,
      userId: ngozi.id,
      rating: 4,
      text: "Very good quality, my daughter has sensitive skin and these do not cause any rash. Only downside is the price — it adds up fast with twins.",
      tags: ["Sensitive skin safe", "No rash"],
      cityAtReview: "Abuja",
      childAgeBandAtReview: "TODDLER",
      structuredAnswers: {
        wouldBuyAgain: true,
        purchasedFrom: "Jumia",
        qualityRating: 4,
      },
      helpfulCount: 21,
    },

    // ── Huggies Wipes (1 review) ─────────────────────────────────────────
    {
      listingId: huggies.id,
      userId: funke.id,
      rating: 3,
      text: "Good for wiping but gave my baby a mild rash after a week. Not recommended for babies with sensitive skin. I have since switched to a different brand.",
      tags: ["Sensitive skin risk"],
      cityAtReview: "Port Harcourt",
      childAgeBandAtReview: "INFANT",
      structuredAnswers: {
        wouldBuyAgain: false,
        purchasedFrom: "Shoprite",
        qualityRating: 3,
      },
      helpfulCount: 19,
    },

    // ── Molfix (1 review) ────────────────────────────────────────────────
    {
      listingId: molfix.id,
      userId: ngozi.id,
      rating: 4,
      text: "Good budget alternative to Pampers. Holds well for 4–5 hours. I would not trust it overnight but for daytime use, it is solid for the price.",
      tags: ["Budget friendly", "Daytime only"],
      cityAtReview: "Abuja",
      childAgeBandAtReview: "TODDLER",
      structuredAnswers: {
        wouldBuyAgain: true,
        purchasedFrom: "local market",
        qualityRating: 4,
      },
      helpfulCount: 17,
    },

    // ── Cerelac (2 reviews) ──────────────────────────────────────────────
    {
      listingId: cerelac.id,
      userId: funke.id,
      rating: 5,
      text: "My baby has been on this for 3 months. She loves the taste and her weight gain has been excellent. The paediatrician also recommended it.",
      tags: ["Great weight gain", "Loved by baby", "Doctor recommended"],
      cityAtReview: "Port Harcourt",
      childAgeBandAtReview: "INFANT",
      structuredAnswers: {
        wouldBuyAgain: true,
        purchasedFrom: "Pharmacy",
        qualityRating: 5,
      },
      helpfulCount: 29,
    },
    {
      listingId: cerelac.id,
      userId: ngozi.id,
      rating: 5,
      text: "Classic choice for first foods. My twins both took to it immediately. Easy to prepare and the iron fortification gives me peace of mind.",
      tags: ["Easy to prepare", "Iron fortified", "Good for twins"],
      cityAtReview: "Abuja",
      childAgeBandAtReview: "INFANT",
      structuredAnswers: {
        wouldBuyAgain: true,
        purchasedFrom: "Shoprite",
        qualityRating: 5,
      },
      helpfulCount: 18,
    },

    // ── Aptamil (1 review) ───────────────────────────────────────────────
    {
      listingId: aptamil.id,
      userId: adaeze.id,
      rating: 5,
      text: "Expensive but worth it. My baby had reflux issues with local formulas and this solved everything. I order it via iHerb every month. Customer service at iHerb is excellent too.",
      tags: ["Reflux safe", "Premium quality", "Import cost high"],
      cityAtReview: "Lagos Island",
      childAgeBandAtReview: "INFANT",
      structuredAnswers: {
        wouldBuyAgain: true,
        purchasedFrom: "iHerb",
        qualityRating: 5,
      },
      helpfulCount: 44,
    },

    // ── Graco Stroller (1 review) ────────────────────────────────────────
    {
      listingId: graco.id,
      userId: adaeze.id,
      rating: 5,
      text: "Best investment I made. Folds in one second, fits in my Keke boot, and my baby sleeps in it beautifully. I have used it every single day for 8 months.",
      tags: ["Easy fold", "Sturdy", "Baby loves it"],
      cityAtReview: "Lagos Island",
      childAgeBandAtReview: "INFANT",
      structuredAnswers: {
        wouldBuyAgain: true,
        purchasedFrom: "Jumia",
        qualityRating: 5,
      },
      helpfulCount: 48,
    },

    // ── Little Stars Crèche (2 reviews) ─────────────────────────────────
    {
      listingId: littleStars.id,
      userId: adaeze.id,
      rating: 4,
      text: "The teachers are warm, the place is spotlessly clean, and they actually communicate via WhatsApp daily. My son has been there since 8 months. Only issue is the price — it is not cheap.",
      tags: ["Clean facility", "Good teachers", "Parent updates"],
      cityAtReview: "Lagos Island",
      childAgeBandAtReview: "INFANT",
      structuredAnswers: {
        monthsUsed: 7,
        wouldRecommend: true,
        staffRating: 5,
        facilityRating: 4,
        communicationRating: 5,
      },
      helpfulCount: 28,
    },
    {
      listingId: littleStars.id,
      userId: funke.id,
      rating: 5,
      text: "My daughter has been thriving there. The Montessori approach is working wonders — she is so confident. Staff turn-over is low which means the teachers know your child well.",
      tags: ["Montessori", "Low staff turnover", "Child development"],
      cityAtReview: "Port Harcourt",
      childAgeBandAtReview: "TODDLER",
      structuredAnswers: {
        monthsUsed: 14,
        wouldRecommend: true,
        staffRating: 5,
        facilityRating: 5,
        communicationRating: 5,
      },
      helpfulCount: 41,
      isAnonymous: false,
    },

    // ── Happy Kids Nursery (1 review) ────────────────────────────────────
    {
      listingId: happyKids.id,
      userId: ngozi.id,
      rating: 4,
      text: "My son has been going since he was 1 year old. The staff are very attentive and the CCTV parent access is a big plus for me. The food menu could be more varied.",
      tags: ["CCTV access", "Attentive staff"],
      cityAtReview: "Abuja",
      childAgeBandAtReview: "TODDLER",
      structuredAnswers: {
        monthsUsed: 10,
        wouldRecommend: true,
        staffRating: 4,
        facilityRating: 4,
        communicationRating: 3,
      },
      helpfulCount: 33,
    },

    // ── Dr. Amaka (2 reviews) ────────────────────────────────────────────
    {
      listingId: drAmaka.id,
      userId: adaeze.id,
      rating: 5,
      text: "She is patient, explains everything clearly, and does not rush you out of the room. My twins have been seeing her since birth. She remembers every child's history without needing to look at the file.",
      tags: ["Patient", "Explains clearly", "Remembers patients"],
      cityAtReview: "Lagos Island",
      childAgeBandAtReview: "TODDLER",
      structuredAnswers: {
        wouldRecommend: true,
        waitTime: "20 minutes",
        staffRating: 5,
        facilityRating: 5,
      },
      helpfulCount: 52,
    },
    {
      listingId: drAmaka.id,
      userId: ngozi.id,
      rating: 5,
      text: "Best paediatrician I have found in Lagos. She speaks plainly, no unnecessary prescriptions, and always follows up. Highly recommend to any mum in Lekki.",
      tags: ["No over-prescribing", "Follows up", "Lagos Lekki"],
      cityAtReview: "Abuja",
      childAgeBandAtReview: "INFANT",
      structuredAnswers: {
        wouldRecommend: true,
        waitTime: "30 minutes",
        staffRating: 5,
        facilityRating: 5,
      },
      helpfulCount: 38,
    },

    // ── Dr. Chukwu (2 reviews) ───────────────────────────────────────────
    {
      listingId: drChukwu.id,
      userId: funke.id,
      rating: 4,
      text: "Good doctor but the waiting time can be up to 2 hours. Worth it for the quality of care though — very thorough and calm. The clinic is clean and well organised.",
      tags: ["Thorough", "Calm manner", "Long wait"],
      cityAtReview: "Port Harcourt",
      childAgeBandAtReview: "INFANT",
      structuredAnswers: {
        wouldRecommend: true,
        waitTime: "90–120 minutes",
        staffRating: 4,
        facilityRating: 4,
      },
      helpfulCount: 26,
    },
    {
      listingId: drChukwu.id,
      userId: adaeze.id,
      rating: 4,
      text: "Competent and careful. He caught an ear infection my son was not even complaining about. The receptionist could be more organised but the doctor himself is excellent.",
      tags: ["Thorough examination", "Catches issues early"],
      cityAtReview: "Lagos Island",
      childAgeBandAtReview: "TODDLER",
      structuredAnswers: {
        wouldRecommend: true,
        waitTime: "45 minutes",
        staffRating: 3,
        facilityRating: 4,
      },
      helpfulCount: 14,
    },
  ];

  // Create all reviews
  const createdReviews = await Promise.all(
    reviewData.map((r) =>
      db.review.create({
        data: {
          listingId: r.listingId,
          userId: r.userId,
          rating: r.rating,
          text: r.text,
          structuredAnswers: r.structuredAnswers,
          childAgeBandAtReview: r.childAgeBandAtReview,
          cityAtReview: r.cityAtReview,
          isAnonymous: r.isAnonymous ?? false,
          status: "PUBLISHED",
          helpfulCount: r.helpfulCount,
        } as Parameters<typeof db.review.create>[0]["data"],
      })
    )
  );

  console.log(`     ✓ ${createdReviews.length} reviews`);

  // ── 5. LISTING STATS (compute from reviews) ───────────────────────────────

  console.log("  → Computing listing stats");

  // Group reviews by listing
  const statsByListing = new Map<
    string,
    { sum: number; count: number; lastAt: Date }
  >();
  for (const r of reviewData) {
    const existing = statsByListing.get(r.listingId);
    if (existing) {
      existing.sum += r.rating;
      existing.count += 1;
    } else {
      statsByListing.set(r.listingId, { sum: r.rating, count: 1, lastAt: new Date() });
    }
  }

  await Promise.all(
    Array.from(statsByListing.entries()).map(([listingId, { sum, count, lastAt }]) =>
      db.listingStats.upsert({
        where: { listingId },
        update: {
          avgRating: sum / count,
          reviewCount: count,
          lastReviewAt: lastAt,
        },
        create: {
          listingId,
          avgRating: sum / count,
          reviewCount: count,
          lastReviewAt: lastAt,
        },
      })
    )
  );

  console.log(`     ✓ ${statsByListing.size} listing stats computed`);

  // ── 6. HELPFUL VOTES (cross-user to demonstrate unique constraint) ─────────

  console.log("  → Helpful votes");

  // User IDs for quick reference
  const userIds = { adaeze: adaeze.id, ngozi: ngozi.id, funke: funke.id };

  // 11 votes: each [reviewIndex, voterName] pair
  // (reviewIndex corresponds to reviewData array position)
  const voteTargets: [number, keyof typeof userIds][] = [
    [0, "ngozi"],  // ngozi votes helpful on adaeze's Pampers review
    [0, "funke"],  // funke votes helpful on adaeze's Pampers review
    [1, "adaeze"], // adaeze votes helpful on ngozi's Pampers review
    [1, "funke"],  // funke votes helpful on ngozi's Pampers review
    [2, "adaeze"], // adaeze votes helpful on funke's Huggies review
    [2, "ngozi"],  // ngozi votes helpful on funke's Huggies review
    [6, "ngozi"],  // ngozi votes helpful on adaeze's Aptamil review
    [6, "funke"],  // funke votes helpful on adaeze's Aptamil review
    [10, "adaeze"],// adaeze votes helpful on ngozi's Happy Kids review
    [11, "funke"], // funke votes helpful on adaeze's Dr. Amaka review
    [12, "adaeze"],// adaeze votes helpful on ngozi's Dr. Amaka review
  ];

  let votesCreated = 0;
  for (const [reviewIdx, voterKey] of voteTargets) {
    const review = createdReviews[reviewIdx];
    const voterId = userIds[voterKey];
    // Skip if voter is the review author (can't vote on own review)
    if (review.userId === voterId) continue;
    await db.helpfulVote
      .create({
        data: {
          reviewId: review.id,
          userId: voterId,
        },
      })
      .catch(() => {
        /* ignore duplicate on re-seed */
      });
    votesCreated++;
  }

  console.log(`     ✓ ${votesCreated} helpful votes`);

  // ── Summary ───────────────────────────────────────────────────────────────

  const [
    catCount,
    userCount,
    listingCount,
    reviewCount,
    statsCount,
    voteCount,
  ] = await Promise.all([
    db.category.count(),
    db.user.count(),
    db.listing.count(),
    db.review.count(),
    db.listingStats.count(),
    db.helpfulVote.count(),
  ]);

  console.log("\n✅  Seed complete:\n");
  console.log(`   Categories:    ${catCount}`);
  console.log(`   Users:         ${userCount}`);
  console.log(`   Listings:      ${listingCount}`);
  console.log(`   Reviews:       ${reviewCount}`);
  console.log(`   Listing stats: ${statsCount}`);
  console.log(`   Helpful votes: ${voteCount}`);
  console.log("");

  // Spot-check: top 3 listings by avgRating
  const topListings = await db.listingStats.findMany({
    orderBy: [{ avgRating: "desc" }, { reviewCount: "desc" }],
    take: 3,
    include: { listing: { select: { name: true } } },
  });

  console.log("   Top 3 listings by avgRating (trust-boundary check):");
  topListings.forEach((s, i) => {
    console.log(
      `   ${i + 1}. ${s.listing.name} — ${s.avgRating.toFixed(2)} ★  (${s.reviewCount} review${s.reviewCount !== 1 ? "s" : ""})`
    );
  });
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
