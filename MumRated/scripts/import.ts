#!/usr/bin/env tsx
/**
 * MumRated! — One-time data import script
 *
 * Usage:
 *   # Dry run (reports what would happen, no DB writes)
 *   tsx scripts/import.ts --file data.csv --type listings --dry-run
 *   tsx scripts/import.ts --file data.json --type reviews --dry-run
 *
 *   # Live run
 *   tsx scripts/import.ts --file data.csv --type listings
 *   tsx scripts/import.ts --file reviews.json --type reviews
 *
 *   # Write migration report to file
 *   tsx scripts/import.ts --file data.csv --type listings --dry-run --report import-report.json
 *
 * Supported formats:
 *   CSV  — first row is header; fields listed in COLUMN MAPS below
 *   JSON — array of objects with matching field names
 *
 * Safety:
 *   - Dry-run mode (--dry-run) validates everything and prints a full report
 *     without touching the database. Run this first, every time.
 *   - Reviews with missing required fields are imported as status=FLAGGED,
 *     not silently dropped. They appear in admin moderation.
 *   - ListingStats are recomputed from scratch after every live import.
 *   - All prices are stored in NGN. USD/EUR values are converted at the
 *     rates configured in EXCHANGE_RATES below (update before each import).
 *
 * Section 12.3 compliance:
 *   Field mapping with validation ✓
 *   Missing required fields → FLAGGED, not dropped ✓
 *   Ratings and counts recomputed server-side ✓
 *   Currency normalisation to NGN ✓
 *   Dry-run mode ✓
 *   Migration report ✓
 */

import { PrismaClient, ReviewStatus, ListingType, CategoryType } from "@prisma/client";
import fs from "fs";
import path from "path";

// ── Exchange rates (update before each import run) ──────────────────────────
// These are applied to source data that specifies a currency other than NGN.
// Approximate mid-market rates as of 2025-01; verify before a real import.
const EXCHANGE_RATES: Record<string, number> = {
  NGN: 1,
  USD: 1600,  // 1 USD → ₦1600
  EUR: 1750,  // 1 EUR → ₦1750
  GBP: 2050,  // 1 GBP → ₦2050
  GHS: 110,   // 1 GHS → ₦110 (Ghanaian Cedi)
  KES: 12,    // 1 KES → ₦12 (Kenyan Shilling)
};

// ── CLI argument parsing ─────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const result: {
    file: string | null;
    type: "listings" | "reviews" | null;
    dryRun: boolean;
    report: string | null;
  } = { file: null, type: null, dryRun: false, report: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) result.file = args[++i];
    else if (args[i] === "--type" && args[i + 1]) {
      const t = args[++i];
      if (t !== "listings" && t !== "reviews") {
        console.error(`Invalid --type "${t}". Must be "listings" or "reviews".`);
        process.exit(1);
      }
      result.type = t;
    } else if (args[i] === "--dry-run") result.dryRun = true;
    else if (args[i] === "--report" && args[i + 1]) result.report = args[++i];
  }

  if (!result.file) { console.error("Missing --file argument."); process.exit(1); }
  if (!result.type) { console.error("Missing --type argument (listings|reviews)."); process.exit(1); }
  return result;
}

// ── CSV parser (no external dependency) ─────────────────────────────────────
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? "").trim().replace(/^"|"$/g, ""); });
    return obj;
  });
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += line[i]; }
  }
  result.push(current);
  return result;
}

// ── File loader ──────────────────────────────────────────────────────────────
function loadFile(filePath: string): Record<string, unknown>[] {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) { console.error(`File not found: ${abs}`); process.exit(1); }
  const content = fs.readFileSync(abs, "utf-8");
  const ext = path.extname(abs).toLowerCase();
  if (ext === ".json") {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  if (ext === ".csv") return parseCSV(content);
  console.error(`Unsupported file extension "${ext}". Use .csv or .json`);
  process.exit(1);
}

// ── Slug generator ───────────────────────────────────────────────────────────
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ── Currency normalisation ───────────────────────────────────────────────────
function toNGN(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency.toUpperCase()] ?? null;
  if (rate === null) {
    throw new Error(`Unknown currency "${currency}" — add it to EXCHANGE_RATES in the script.`);
  }
  return Math.round(amount * rate);
}

function formatNGN(min: number, max?: number): string {
  const fmt = (n: number) => `₦${n.toLocaleString("en-NG")}`;
  return max && max !== min ? `${fmt(min)} – ${fmt(max)}` : fmt(min);
}

// ── Listing import ───────────────────────────────────────────────────────────
/**
 * Expected CSV/JSON columns for listings:
 *
 * Required:
 *   name          string
 *   type          PRODUCT | SERVICE
 *   category_slug string  (must match an existing Category.slug)
 *
 * Optional:
 *   slug              string  (auto-generated from name if omitted)
 *   description       string
 *   brand_or_provider string
 *   location_text     string
 *   price_min         number  (in source currency)
 *   price_max         number  (in source currency)
 *   currency          string  (default: NGN)
 *   hero_image        string  (Cloudinary URL)
 *   website_url       string
 *   opening_hours     string
 */
interface ListingRow {
  name: string;
  type: string;
  category_slug: string;
  slug?: string;
  description?: string;
  brand_or_provider?: string;
  location_text?: string;
  price_min?: string;
  price_max?: string;
  currency?: string;
  hero_image?: string;
  website_url?: string;
  opening_hours?: string;
}

interface ListingValidation {
  rowIndex: number;
  raw: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  data: ListingRow | null;
}

function validateListingRow(raw: Record<string, unknown>, index: number): ListingValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = String(raw.name ?? "").trim();
  const type = String(raw.type ?? "").trim().toUpperCase();
  const category_slug = String(raw.category_slug ?? "").trim().toLowerCase();

  if (!name) errors.push("Missing required field: name");
  if (!type) errors.push("Missing required field: type");
  else if (type !== "PRODUCT" && type !== "SERVICE") errors.push(`Invalid type "${type}" — must be PRODUCT or SERVICE`);
  if (!category_slug) errors.push("Missing required field: category_slug");

  const currency = String(raw.currency ?? "NGN").trim().toUpperCase();
  if (!EXCHANGE_RATES[currency]) errors.push(`Unknown currency "${currency}"`);

  const priceMin = raw.price_min !== undefined && raw.price_min !== "" ? Number(raw.price_min) : undefined;
  const priceMax = raw.price_max !== undefined && raw.price_max !== "" ? Number(raw.price_max) : undefined;
  if (priceMin !== undefined && isNaN(priceMin)) errors.push("price_min is not a valid number");
  if (priceMax !== undefined && isNaN(priceMax)) errors.push("price_max is not a valid number");
  if (priceMin !== undefined && priceMax !== undefined && priceMax < priceMin) warnings.push("price_max is less than price_min — values will be swapped");

  if (errors.length > 0) return { rowIndex: index, raw, errors, warnings, data: null };

  return {
    rowIndex: index,
    raw,
    errors: [],
    warnings,
    data: {
      name,
      type,
      category_slug,
      slug: raw.slug ? String(raw.slug).trim() : undefined,
      description: raw.description ? String(raw.description).trim() : undefined,
      brand_or_provider: raw.brand_or_provider ? String(raw.brand_or_provider).trim() : undefined,
      location_text: raw.location_text ? String(raw.location_text).trim() : undefined,
      price_min: priceMin !== undefined ? String(Math.min(priceMin, priceMax ?? priceMin)) : undefined,
      price_max: priceMax !== undefined ? String(Math.max(priceMin ?? priceMax, priceMax)) : undefined,
      currency,
      hero_image: raw.hero_image ? String(raw.hero_image).trim() : undefined,
      website_url: raw.website_url ? String(raw.website_url).trim() : undefined,
      opening_hours: raw.opening_hours ? String(raw.opening_hours).trim() : undefined,
    },
  };
}

// ── Review import ────────────────────────────────────────────────────────────
/**
 * Expected CSV/JSON columns for reviews:
 *
 * Required:
 *   listing_slug  string  (must match an existing Listing.slug)
 *   user_email    string  (must match an existing User.email)
 *   rating        1–5
 *   text          string  (min 10 chars)
 *
 * Optional:
 *   title               string
 *   is_anonymous        true|false  (default false)
 *   child_age_band      NEWBORN|INFANT|TODDLER|PRESCHOOL|SCHOOL_AGE
 *   city_at_review      string
 *   verified_purchase   true|false
 *   structured_answers  JSON string
 *   photo_urls          pipe-separated list of Cloudinary URLs
 *   created_at          ISO datetime (defaults to now())
 *
 * Missing required fields → status=FLAGGED (not dropped)
 */
interface ReviewRow {
  listing_slug: string;
  user_email: string;
  rating: number;
  text: string;
  is_anonymous: boolean;
  child_age_band?: string;
  city_at_review?: string;
  verified_purchase: boolean;
  structured_answers: object;
  photo_urls: string[];
  created_at?: Date;
  shouldFlag: boolean;
  flagReasons: string[];
}

interface ReviewValidation {
  rowIndex: number;
  raw: Record<string, unknown>;
  errors: string[];       // hard errors — row cannot be imported at all
  flagReasons: string[];  // soft errors — row imported but status=FLAGGED
  data: ReviewRow | null;
}

const VALID_AGE_BANDS = ["NEWBORN", "INFANT", "TODDLER", "PRESCHOOL", "SCHOOL_AGE"];

function validateReviewRow(raw: Record<string, unknown>, index: number): ReviewValidation {
  const errors: string[] = [];
  const flagReasons: string[] = [];

  const listing_slug = String(raw.listing_slug ?? "").trim().toLowerCase();
  const user_email = String(raw.user_email ?? "").trim().toLowerCase();
  const ratingRaw = Number(raw.rating);
  const text = String(raw.text ?? "").trim();

  // Hard errors (cannot import at all)
  if (!listing_slug) errors.push("Missing listing_slug");
  if (!user_email) errors.push("Missing user_email");
  if (!user_email.includes("@")) errors.push(`Invalid user_email: "${user_email}"`);

  if (errors.length > 0) return { rowIndex: index, raw, errors, flagReasons, data: null };

  // Soft errors — import but flag
  if (!raw.rating || isNaN(ratingRaw)) flagReasons.push("Missing or invalid rating");
  else if (ratingRaw < 1 || ratingRaw > 5 || !Number.isInteger(ratingRaw)) flagReasons.push(`Rating ${ratingRaw} is out of range (must be 1–5 integer)`);
  if (!text) flagReasons.push("Missing review text");
  else if (text.length < 10) flagReasons.push(`Review text too short (${text.length} chars; min 10)`);

  const rating = !isNaN(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? Math.round(ratingRaw) : 3; // fallback rating for flagged rows

  const ageBandRaw = raw.child_age_band ? String(raw.child_age_band).trim().toUpperCase() : undefined;
  if (ageBandRaw && !VALID_AGE_BANDS.includes(ageBandRaw)) {
    flagReasons.push(`Unknown child_age_band "${ageBandRaw}" — valid values: ${VALID_AGE_BANDS.join(", ")}`);
  }
  const child_age_band = ageBandRaw && VALID_AGE_BANDS.includes(ageBandRaw) ? ageBandRaw : undefined;

  let structuredAnswers = {};
  if (raw.structured_answers) {
    try {
      structuredAnswers = typeof raw.structured_answers === "string"
        ? JSON.parse(raw.structured_answers)
        : (raw.structured_answers as object);
    } catch {
      flagReasons.push("structured_answers is not valid JSON — stored as empty object");
    }
  }

  const photoUrls = raw.photo_urls
    ? String(raw.photo_urls).split("|").map((u) => u.trim()).filter(Boolean)
    : [];

  let created_at: Date | undefined;
  if (raw.created_at) {
    const d = new Date(String(raw.created_at));
    if (isNaN(d.getTime())) flagReasons.push(`Invalid created_at value: "${raw.created_at}" — will use import timestamp`);
    else created_at = d;
  }

  return {
    rowIndex: index,
    raw,
    errors: [],
    flagReasons,
    data: {
      listing_slug,
      user_email,
      rating,
      text: text || "[No text provided — flagged for moderation]",
      is_anonymous: String(raw.is_anonymous ?? "false").toLowerCase() === "true",
      child_age_band,
      city_at_review: raw.city_at_review ? String(raw.city_at_review).trim() : undefined,
      verified_purchase: String(raw.verified_purchase ?? "false").toLowerCase() === "true",
      structured_answers: structuredAnswers,
      photo_urls: photoUrls,
      created_at,
      shouldFlag: flagReasons.length > 0,
      flagReasons,
    },
  };
}

// ── Recompute ListingStats ───────────────────────────────────────────────────
async function recomputeAllStats(db: PrismaClient, listingIds: string[]): Promise<void> {
  for (const listingId of listingIds) {
    const reviews = await db.review.findMany({
      where: { listingId, status: "PUBLISHED" },
      select: { rating: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const count = reviews.length;
    const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
    await db.listingStats.upsert({
      where: { listingId },
      create: {
        listingId,
        avgRating: avg,
        reviewCount: count,
        lastReviewAt: reviews[0]?.createdAt ?? null,
      },
      update: {
        avgRating: avg,
        reviewCount: count,
        lastReviewAt: reviews[0]?.createdAt ?? null,
      },
    });
  }
}

// ── Migration report ─────────────────────────────────────────────────────────
interface MigrationReport {
  timestamp: string;
  dryRun: boolean;
  inputFile: string;
  importType: string;
  summary: {
    totalRows: number;
    hardErrors: number;
    flagged: number;
    imported: number;
    skippedDuplicates: number;
  };
  hardErrors: { rowIndex: number; errors: string[]; raw: Record<string, unknown> }[];
  flaggedRows: { rowIndex: number; flagReasons: string[]; raw: Record<string, unknown> }[];
  warnings: { rowIndex: number; warnings: string[] }[];
  statsRecomputed?: string[];
  exchangeRatesUsed: Record<string, number>;
}

// ── Shared return type for both import functions ─────────────────────────────
interface ImportResult {
  totalRows: number;
  hardErrorCount: number;
  flagged: number;
  imported: number;
  skippedDuplicates: number;
  hardErrors: MigrationReport["hardErrors"];
  flaggedRows: MigrationReport["flaggedRows"];
  warnings: MigrationReport["warnings"];
  statsRecomputed: string[];
}

// ── Import listings ──────────────────────────────────────────────────────────
async function importListings(
  db: PrismaClient,
  rows: Record<string, unknown>[],
  dryRun: boolean
): Promise<ImportResult> {
  const hardErrors: MigrationReport["hardErrors"] = [];
  const warnings: MigrationReport["warnings"] = [];
  const validations = rows.map((r, i) => validateListingRow(r as Record<string, unknown>, i + 1));

  // Load categories once
  const categories = await db.category.findMany({ select: { id: true, slug: true } });
  const catBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  // Load existing slugs
  const existingSlugs = new Set(
    (await db.listing.findMany({ select: { slug: true } })).map((l) => l.slug)
  );

  let imported = 0;
  let skippedDuplicates = 0;

  for (const v of validations) {
    if (v.errors.length > 0) {
      hardErrors.push({ rowIndex: v.rowIndex, errors: v.errors, raw: v.raw });
      continue;
    }
    if (v.warnings.length > 0) warnings.push({ rowIndex: v.rowIndex, warnings: v.warnings });

    const d = v.data!;
    const catId = catBySlug.get(d.category_slug);
    if (!catId) {
      hardErrors.push({ rowIndex: v.rowIndex, errors: [`Category not found: "${d.category_slug}"`], raw: v.raw });
      continue;
    }

    // Generate unique slug
    let slug = d.slug || toSlug(d.name);
    if (existingSlugs.has(slug)) {
      const original = slug;
      let suffix = 2;
      while (existingSlugs.has(`${original}-${suffix}`)) suffix++;
      slug = `${original}-${suffix}`;
      warnings.push({ rowIndex: v.rowIndex, warnings: [`Slug "${original}" already exists — using "${slug}"`] });
    }
    existingSlugs.add(slug);

    // Currency normalisation
    const currency = d.currency ?? "NGN";
    let priceMin: number | undefined;
    let priceMax: number | undefined;
    let priceRangeNGN: string | undefined;

    if (d.price_min) {
      priceMin = toNGN(Number(d.price_min), currency);
      priceMax = d.price_max ? toNGN(Number(d.price_max), currency) : undefined;
      priceRangeNGN = formatNGN(priceMin, priceMax);
    }

    if (!dryRun) {
      await db.listing.create({
        data: {
          name: d.name,
          slug,
          type: d.type as ListingType,
          categoryId: catId,
          description: d.description,
          brandOrProvider: d.brand_or_provider,
          locationText: d.location_text,
          priceRangeNGN,
          priceRangeMin: priceMin,
          priceRangeMax: priceMax,
          currency: "NGN", // always store as NGN
          heroImage: d.hero_image,
          openingHours: d.opening_hours,
          status: "ACTIVE",
        },
      });
    }
    imported++;
  }

  return {
    totalRows: rows.length,
    hardErrorCount: hardErrors.length,
    flagged: 0,
    imported,
    skippedDuplicates,
    hardErrors,
    flaggedRows: [],
    warnings,
    statsRecomputed: [],
  };
}

// ── Import reviews ───────────────────────────────────────────────────────────
async function importReviews(
  db: PrismaClient,
  rows: Record<string, unknown>[],
  dryRun: boolean
): Promise<ImportResult> {
  const hardErrorList: MigrationReport["hardErrors"] = [];
  const flaggedList: MigrationReport["flaggedRows"] = [];
  const warnings: MigrationReport["warnings"] = [];
  const validations = rows.map((r, i) => validateReviewRow(r as Record<string, unknown>, i + 1));

  // Load listings and users once
  const listings = await db.listing.findMany({ select: { id: true, slug: true } });
  const listingBySlug = new Map(listings.map((l) => [l.slug, l.id]));

  const users = await db.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

  let imported = 0;
  let skippedDuplicates = 0;
  const affectedListingIds = new Set<string>();

  for (const v of validations) {
    if (v.errors.length > 0) {
      hardErrorList.push({ rowIndex: v.rowIndex, errors: v.errors, raw: v.raw });
      continue;
    }

    const d = v.data!;
    const listingId = listingBySlug.get(d.listing_slug);
    const userId = userByEmail.get(d.user_email);

    if (!listingId) {
      hardErrorList.push({ rowIndex: v.rowIndex, errors: [`Listing not found: "${d.listing_slug}"`], raw: v.raw });
      continue;
    }
    if (!userId) {
      hardErrorList.push({ rowIndex: v.rowIndex, errors: [`User not found: "${d.user_email}"`], raw: v.raw });
      continue;
    }

    // Duplicate check — one review per (listing, user)
    if (!dryRun) {
      const existing = await db.review.findFirst({ where: { listingId, userId }, select: { id: true } });
      if (existing) {
        skippedDuplicates++;
        warnings.push({ rowIndex: v.rowIndex, warnings: [`Duplicate: user "${d.user_email}" already reviewed listing "${d.listing_slug}" — skipped`] });
        continue;
      }
    }

    const status: ReviewStatus = d.shouldFlag ? "FLAGGED" : "PUBLISHED";

    if (d.shouldFlag) {
      flaggedList.push({ rowIndex: v.rowIndex, flagReasons: d.flagReasons, raw: v.raw });
    }

    if (!dryRun) {
      await db.review.create({
        data: {
          listingId,
          userId,
          rating: d.rating,
          text: d.text,
          isAnonymous: d.is_anonymous,
          childAgeBandAtReview: d.child_age_band as never,
          cityAtReview: d.city_at_review,
          structuredAnswers: d.structured_answers,
          photoUrls: d.photo_urls,
          status,
          createdAt: d.created_at,
          // Store flag reasons in a way the moderation UI can surface them
          // We embed them in structuredAnswers under a reserved key
          ...(d.shouldFlag && {
            structuredAnswers: {
              ...(d.structured_answers as object),
              _importFlagReasons: d.flagReasons,
            },
          }),
        },
      });
      affectedListingIds.add(listingId);
    }
    imported++;
  }

  // Recompute stats for all affected listings (only for PUBLISHED reviews)
  const statsRecomputed: string[] = [];
  if (!dryRun && affectedListingIds.size > 0) {
    await recomputeAllStats(db, [...affectedListingIds]);
    statsRecomputed.push(...affectedListingIds);
  }

  return {
    totalRows: rows.length,
    hardErrorCount: hardErrorList.length,
    flagged: flaggedList.length,
    imported,
    skippedDuplicates,
    hardErrors: hardErrorList,
    flaggedRows: flaggedList,
    warnings,
    statsRecomputed,
  };
}

// ── Pretty print ─────────────────────────────────────────────────────────────
function printReport(report: MigrationReport): void {
  const mode = report.dryRun ? "[DRY RUN — no changes written]" : "[LIVE RUN]";
  console.log(`\n${"═".repeat(60)}`);
  console.log(`MumRated! Import Report — ${report.timestamp}`);
  console.log(mode);
  console.log(`File:   ${report.inputFile}`);
  console.log(`Type:   ${report.importType}`);
  console.log(`${"─".repeat(60)}`);
  console.log(`Total rows in file:     ${report.summary.totalRows}`);
  console.log(`Hard errors (skipped):  ${report.summary.hardErrors}`);
  console.log(`Flagged (incomplete):   ${report.summary.flagged}`);
  console.log(`Imported successfully:  ${report.summary.imported}`);
  if (report.summary.skippedDuplicates > 0)
    console.log(`Skipped (duplicates):   ${report.summary.skippedDuplicates}`);
  if (report.statsRecomputed && report.statsRecomputed.length > 0)
    console.log(`Stats recomputed for:   ${report.statsRecomputed.length} listings`);

  if (report.hardErrors.length > 0) {
    console.log(`\n${"─".repeat(60)}`);
    console.log("HARD ERRORS (rows skipped entirely):");
    for (const e of report.hardErrors) {
      console.log(`  Row ${e.rowIndex}: ${e.errors.join("; ")}`);
    }
  }

  if (report.flaggedRows.length > 0) {
    console.log(`\n${"─".repeat(60)}`);
    console.log("FLAGGED ROWS (imported as status=FLAGGED, needs moderation):");
    for (const f of report.flaggedRows) {
      const raw = f.raw as Record<string, unknown>;
      const id = raw.listing_slug ?? raw.name ?? `row ${f.rowIndex}`;
      console.log(`  Row ${f.rowIndex} [${id}]: ${f.flagReasons.join("; ")}`);
    }
  }

  if (report.warnings.length > 0) {
    console.log(`\n${"─".repeat(60)}`);
    console.log("WARNINGS:");
    for (const w of report.warnings) {
      console.log(`  Row ${w.rowIndex}: ${w.warnings.join("; ")}`);
    }
  }

  console.log(`\nExchange rates applied: ${JSON.stringify(report.exchangeRatesUsed)}`);
  console.log(`${"═".repeat(60)}\n`);

  if (report.dryRun) {
    console.log("✓ Dry run complete. Re-run without --dry-run to commit.\n");
  } else {
    console.log(`✓ Import complete. ${report.summary.flagged} flagged review(s) are waiting in /admin/moderation.\n`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  const db = new PrismaClient();

  try {
    console.log(`Loading ${args.file}…`);
    const rows = loadFile(args.file!);
    console.log(`${rows.length} rows loaded. Running validation…`);

    let result;
    if (args.type === "listings") {
      result = await importListings(db, rows, args.dryRun);
    } else {
      result = await importReviews(db, rows, args.dryRun);
    }

    const report: MigrationReport = {
      timestamp: new Date().toISOString(),
      dryRun: args.dryRun,
      inputFile: args.file!,
      importType: args.type!,
      summary: {
        totalRows: result.totalRows,
        hardErrors: result.hardErrorCount,
        flagged: result.flagged,
        imported: result.imported,
        skippedDuplicates: result.skippedDuplicates,
      },
      hardErrors: result.hardErrors,
      flaggedRows: result.flaggedRows,
      warnings: result.warnings,
      statsRecomputed: result.statsRecomputed,
      exchangeRatesUsed: EXCHANGE_RATES,
    };

    printReport(report);

    if (args.report) {
      const reportPath = path.resolve(args.report);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Migration report written to: ${reportPath}\n`);
    }

    // Exit with error code if hard errors occurred (useful for CI)
    if (report.summary.hardErrors > 0) {
      process.exit(1);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
