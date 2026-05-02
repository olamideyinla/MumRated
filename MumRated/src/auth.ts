import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import type { UserRole } from "@prisma/client";

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

  // JWT strategy keeps sessions lightweight
  session: { strategy: "database" },

  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/check-email",
    error: "/sign-in",
  },

  callbacks: {
    // Sync Google profile data into our custom fields on every sign-in
    async signIn({ user, account, profile }) {
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
      return true;
    },

    // Expose role and isVerified in the session
    async session({ session, user }) {
      if (session.user) {
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
          session.user.id = dbUser.id;
          (session.user as typeof session.user & { role: UserRole }).role =
            dbUser.role;
          (
            session.user as typeof session.user & { isVerified: boolean }
          ).isVerified = dbUser.isVerified;
          // Prefer our custom displayName/photo over Auth.js defaults
          if (dbUser.displayName) session.user.name = dbUser.displayName;
          if (dbUser.photo) session.user.image = dbUser.photo;
        }
      }
      return session;
    },
  },
});
