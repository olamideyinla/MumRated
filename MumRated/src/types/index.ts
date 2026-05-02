// ── Shared TypeScript types (data model from design README) ──────────────

export type ImgType = "product" | "school" | "doctor" | "camera" | "teacher";

export type CategoryId =
  | "baby-products"
  | "creches"
  | "paediatricians"
  | "photographers"
  | "birthday"
  | "tutors"
  | "party"
  | "nappies";

export interface Category {
  id: CategoryId;
  name: string;
  sub: string;   // subtitle
  count: number; // review count
}

export interface Item {
  id: string;
  name: string;
  cat: CategoryId;
  avgRating: number;
  reviewCount: number;
  type: "product" | "service";
  where: string; // "Lekki Phase 1, Lagos" or "Jumia · Shoprite"
}

export interface Review {
  id: number;
  name: string;       // "Adaeze O."
  loc: string;        // "Lagos Island"
  ini: string;        // initials for avatar "AO"
  ac: string;         // avatar color hex
  item: string;       // product/service name
  iid: string;        // item ID
  cat: CategoryId;
  catLabel: string;   // display label
  rating: number;     // 1–5
  date: string;       // relative "2 days ago"
  verified: boolean;
  featured: boolean;
  text: string;       // review body
  helpful: number;
  tags: string[];
  imgBg: string;
  imgType: ImgType;
}

// ── DB model types (re-exports from Prisma for convenience) ──────────────
// Import these from "@prisma/client" in server components and API routes.
// Do NOT import @prisma/client in client components.
export type {
  User,
  Listing,
  Category as DbCategory,
  Review as DbReview,
  Provider,
  HelpfulVote,
  Report,
  AdminAction,
  ListingStats,
  UserRole,
  ChildAgeBand,
  CategoryType,
  ListingType,
  ClaimStatus,
  SubscriptionTier,
  ReviewStatus,
  ReportStatus,
} from "@prisma/client";

export type Location =
  | "All of Nigeria"
  | "Lagos"
  | "Abuja"
  | "Port Harcourt"
  | "Ibadan"
  | "Kano"
  | "Enugu"
  | "Kaduna"
  | "Benin City";
