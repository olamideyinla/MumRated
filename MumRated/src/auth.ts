import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

// ── Auth debug prefix (visible in Vercel Function logs) ──────────────────
const TAG = "[auth]";

// ── Helper: derive isVerified from profile completeness ──────────────────
function computeIsVerified(user: {
  displayName?: string | null;
  photo?: string | null;
  childAgeBand?: string | null;
}): boolean {
  return !!(user.displayName && user.photo && user.childAgeBand);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY!,
      from: process.env.EMAIL_FROM ?? "noreply@mumrated.com",
    }),
  ],

  // Database sessions — session token stored in Session table, not JWT
  session: { strategy: "database" },

  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/check-email",
    error: "/sign-in",
  },

  // ── Auth.js internal error / warning logger ────────────────────────────
  // Surfaces token verification failures, adapter errors, and config issues
  // in Vercel Function logs. Remove or gate behind NODE_ENV in production
  // once the magic-link flow is confirmed stable.
  logger: {
    error(error) {
      console.error(`${TAG} error`, error);
    },
    warn(code) {
      console.warn(`${TAG} warn`, code);
    },
    debug(message, metadata) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`${TAG} debug`, message, metadata);
      }
    },
  },

  callbacks: {
    // ── signIn ─────────────────────────────────────────────────────────────
    async signIn({ user, account, profile }) {
      console.log(
        `${TAG} signIn provider=${account?.provider ?? "unknown"} userId=${user?.id ?? "none"}`
      );

      if (account?.provider === "google" && profile && user.id) {
        const existing = await db.user.findUnique({
          where: { id: user.id },
          select: { displayName: true, photo: true, childAgeBand: true },
        });

        // Only back-fill display name / photo if the mum hasn't set her own yet
        const updates: Record<string, unknown> = {};
        if (!existing?.displayName && profile.name) {
          updates.displayName = profile.name as string;
        }
        if (!existing?.photo && (profile as { picture?: string }).picture) {
          updates.photo = (profile as { picture?: string }).picture as string;
        }

        if (Object.keys(updates).length > 0) {
          // Recompute isVerified after potential updates
          const merged = { ...existing, ...updates };
          updates.isVerified = computeIsVerified({
            displayName: merged.displayName as string | null,
            photo: merged.photo as string | null,
            childAgeBand: existing?.childAgeBand ?? null,
          });
          await db.user.update({ where: { id: user.id }, data: updates });
        }
      }

      console.log(`${TAG} signIn → allowed`);
      return true;
    },

    // ── session ────────────────────────────────────────────────────────────
    async session({ session, user }) {
      if (session.user && user?.id) {
        // Always set id — this is the critical guard for protected pages
        session.user.id = user.id;

        try {
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              role: true,
              isVerified: true,
              displayName: true,
              photo: true,
            },
          });
          if (dbUser) {
            session.user.role = dbUser.role;
            session.user.isVerified = dbUser.isVerified;
            // Prefer our custom displayName/photo over Auth.js defaults
            if (dbUser.displayName) session.user.name = dbUser.displayName;
            if (dbUser.photo) session.user.image = dbUser.photo;
          } else {
            console.warn(`${TAG} session: no DB row for userId=${user.id}`);
          }
        } catch (err) {
          // DB enrichment failed — session still works with basic id
          console.error(`${TAG} session enrichment failed for userId=${user.id}`, err);
        }
      }
      return session;
    },
  },
});
