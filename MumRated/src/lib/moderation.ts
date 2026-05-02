/**
 * MumRated! — Review Moderation Pipeline
 *
 * Runs server-side before any review is persisted.
 * Each check returns FLAGGED (with internal reason) or passes.
 * The final status is the most restrictive of all checks.
 *
 * IMPORTANT: Never expose flag reasons to the submitter.
 */

import { db } from "./db";
import OpenAI from "openai";

// ── Types ────────────────────────────────────────────────────────────────────

export type ModerationStatus = "PUBLISHED" | "FLAGGED";

export interface ModerationInput {
  /** Combined review text (synthesised from structured answers) */
  text: string;
  /** Structured answer map */
  structuredAnswers: Record<string, string>;
  userId: string;
  listingId: string;
  recaptchaToken: string;
  /** Best-effort IP from request headers */
  ip: string;
}

export interface ModerationResult {
  status: ModerationStatus;
  /** Internal flags — never returned to client */
  flagReasons: string[];
}

// ── Profanity / slur list ────────────────────────────────────────────────────
// English + common Nigerian Pidgin terms.
// Intentionally conservative — exact / whole-word matching only.

const PROFANITY_PATTERNS = [
  // English
  /\bfuck(ing|er|s|ed)?\b/i,
  /\bshit(ty|head|s)?\b/i,
  /\bcunt(s)?\b/i,
  /\bbitch(es|ing)?\b/i,
  /\bass(hole|wipe|holes)?\b/i,
  /\bdick(head|s)?\b/i,
  /\bpussy(cat)?s?\b/i,
  /\bwhor(e|es|ing)\b/i,
  /\bslut(ty|s)?\b/i,
  /\bbastard(s|ly)?\b/i,
  /\bdamn\b/i, // keep low-signal, only fires in conjunction with others
  /\bcock(sucker|s)?\b/i,
  // Racial / ethnic slurs (auto-flag, no threshold)
  /\bn+i+g+[ae]+r/i,
  /\bk+a+f+i+r/i,
  // Nigerian Pidgin slurs & abuse terms
  /\bmumu\b/i,
  /\bolodo\b/i,
  /\bwerey\b/i,
  /\bode\b/i,        // context-sensitive but flag for review
  /\bagbaya\b/i,
  /\byeye\b/i,
  /\bkm+t\b/i,       // "kiss my teeth" abbreviation used as slur
  /\bstupid\s+cow\b/i,
  /\bfucking?\s+(nigerian|igbo|yoruba|hausa|igala|efik)\b/i, // ethnic attacks
];

/** Returns true if any profanity pattern matches. */
function hasProfanity(text: string): boolean {
  // Count matches: only flag if 2+ matches, or any racial/slur hit
  const racialOrSlur = [/\bn+i+g+[ae]+r/i, /\bk+a+f+i+r/i].some((p) =>
    p.test(text),
  );
  if (racialOrSlur) return true;

  const matches = PROFANITY_PATTERNS.filter((p) => p.test(text)).length;
  return matches >= 2; // two distinct hits before flagging for profanity alone
}

// ── Defamation patterns ──────────────────────────────────────────────────────

const DEFAMATION_PATTERNS = [
  // Naming individuals with accusations
  /\b(mr|mrs|dr|prof|alhaji|alhaja|chief|pastor|rev)\.?\s+[A-Z][a-z]+\s+(stole|defrauded|scammed|lied|cheated|abused|assaulted|raped|arrested|jailed)\b/i,
  // Accusations of illegal conduct
  /\b(stole|steal|stealing)\s+money\b/i,
  /\b(report(ed)?|repor?t)\s+to\s+(efcc|police|acpc|ndlea|interpol)\b/i,
  /\bunder\s+(investigation|arrest)\b/i,
  /\bfraud(ster|ulent)?\b/i,
  /\bblack\s*market\b/i,
];

function hasDefamationRisk(text: string): boolean {
  return DEFAMATION_PATTERNS.some((p) => p.test(text));
}

// ── reCAPTCHA v3 ─────────────────────────────────────────────────────────────

async function verifyRecaptcha(token: string): Promise<number> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    // Dev mode: skip check
    console.warn("[moderation] RECAPTCHA_SECRET_KEY not set — skipping check");
    return 1.0;
  }
  if (!token) return 0;

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${secret}&response=${token}`,
  });
  const data = (await res.json()) as { success: boolean; score?: number };
  return data.success ? (data.score ?? 0) : 0;
}

// ── OpenAI medical claims check ───────────────────────────────────────────────

async function hasMedicalClaim(text: string): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[moderation] OPENAI_API_KEY not set — skipping medical claims check");
    return false;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a content moderation assistant for MumRated!, a Nigerian parenting review platform.

Your task: Determine if the review text contains medical claims — specifically, claims that a product or service CURED, TREATED, HEALED, or PREVENTED a medical condition in a child.

Examples that ARE medical claims:
- "this cream cured my baby's eczema"
- "after using this, my baby's reflux disappeared completely and permanently"
- "it treated the infection"
- "it prevented malaria"
- "the rash was cured"

Examples that are NOT medical claims:
- "the cream helped with my baby's dry skin"
- "my baby seemed more comfortable"
- "I noticed improvement in his sleep"
- "the doctor recommended it"
- "great for sensitive skin"
- "my baby's tummy seemed to settle"

Respond ONLY with valid JSON: {"hasMedicalClaim": boolean, "confidence": number}`,
        },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      max_tokens: 60,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { hasMedicalClaim?: boolean; confidence?: number };
    const confidence = parsed.confidence ?? 0;
    return parsed.hasMedicalClaim === true && confidence >= 0.7;
  } catch (err) {
    console.error("[moderation] OpenAI medical claims check failed:", err);
    // Fail open — do not block reviews if OpenAI is unavailable
    return false;
  }
}

// ── Duplicate detection ───────────────────────────────────────────────────────

/** Simple word-overlap ratio between two strings. */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  return intersection / Math.min(wordsA.size, wordsB.size);
}

async function isDuplicate(userId: string, listingId: string, text: string): Promise<boolean> {
  // Look at this user's existing reviews for the same listing in the last 90 days
  const recentReviews = await db.review.findMany({
    where: {
      userId,
      listingId,
      createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) },
    },
    select: { text: true },
    take: 5,
  });

  // If the user already has a review for this listing, block outright
  if (recentReviews.length > 0) return true;

  // Also check for near-identical text across ALL of this user's recent reviews (copy-paste spam)
  const allRecent = await db.review.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
    },
    select: { text: true },
    take: 10,
  });

  return allRecent.some((r) => wordOverlap(r.text, text) > 0.8);
}

// ── Velocity check ────────────────────────────────────────────────────────────

async function isHighVelocity(userId: string): Promise<boolean> {
  const count = await db.review.count({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
    },
  });
  return count >= 3;
}

// ── Vendor brigade check ──────────────────────────────────────────────────────

async function isVendorBrigade(listingId: string): Promise<boolean> {
  // Count reviews on this listing in the last 48h from accounts <30 days old
  const cutoff48h = new Date(Date.now() - 48 * 3_600_000);
  const cutoff30d = new Date(Date.now() - 30 * 86_400_000);

  const count = await db.review.count({
    where: {
      listingId,
      createdAt: { gte: cutoff48h },
      user: { createdAt: { gte: cutoff30d } },
    },
  });
  return count >= 5;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runModerationPipeline(
  input: ModerationInput,
): Promise<ModerationResult> {
  const { text, structuredAnswers, userId, listingId, recaptchaToken } = input;
  const flagReasons: string[] = [];
  let status: ModerationStatus = "PUBLISHED";

  const flag = (reason: string) => {
    flagReasons.push(reason);
    status = "FLAGGED";
  };

  // ── 1. reCAPTCHA score ─────────────────────────────────────────────────
  const captchaScore = await verifyRecaptcha(recaptchaToken);
  if (captchaScore < 0.5) {
    flag(`recaptcha_low_score:${captchaScore}`);
    // Hard fail — return early, don't waste API calls
    return { status: "FLAGGED", flagReasons };
  }

  // ── 2. Completeness check ──────────────────────────────────────────────
  const nonEmpty = Object.values(structuredAnswers).filter((v) => v?.trim().length > 0);
  if (nonEmpty.length === 0) {
    flag("completeness:no_answers");
    return { status: "FLAGGED", flagReasons };
  }
  if (text.trim().length < 10) {
    flag("completeness:text_too_short");
    return { status: "FLAGGED", flagReasons };
  }

  // ── 3. Duplicate / one-per-listing ────────────────────────────────────
  const dup = await isDuplicate(userId, listingId, text);
  if (dup) {
    flag("duplicate:already_reviewed_or_copy_paste");
    return { status: "FLAGGED", flagReasons };
  }

  // ── 4. Profanity / slurs ────────────────────────────────────────────────
  const fullText = [text, ...Object.values(structuredAnswers)].join(" ");
  if (hasProfanity(fullText)) {
    flag("profanity:pattern_match");
  }

  // ── 5. Defamation patterns ─────────────────────────────────────────────
  if (hasDefamationRisk(fullText)) {
    flag("defamation:pattern_match");
  }

  // ── 6. Medical claims (OpenAI) — highest-risk category ────────────────
  const medicalClaim = await hasMedicalClaim(fullText);
  if (medicalClaim) {
    flag("medical_claim:openai_detected");
  }

  // ── 7. Velocity check ──────────────────────────────────────────────────
  const velocity = await isHighVelocity(userId);
  if (velocity) {
    flag("velocity:3_plus_reviews_in_24h");
  }

  // ── 8. Vendor brigade ──────────────────────────────────────────────────
  const brigade = await isVendorBrigade(listingId);
  if (brigade) {
    flag("brigade:5_plus_new_accounts_in_48h");
  }

  return { status, flagReasons };
}
