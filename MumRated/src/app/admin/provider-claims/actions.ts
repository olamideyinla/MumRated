"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, createAdminAction } from "@/lib/admin";
import { sendEmail } from "@/lib/email";

export async function approveClaim(listingId: string) {
  const admin = await requireAdmin();

  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      name: true,
      claimStatus: true,
      claimedByProvider: {
        select: { id: true, contactEmail: true, businessName: true, userId: true },
      },
    },
  });

  if (!listing || listing.claimStatus !== "PENDING") return;

  await db.$transaction(async (tx) => {
    // Set listing to CLAIMED
    await tx.listing.update({
      where: { id: listingId },
      data: { claimStatus: "CLAIMED" },
    });

    // Mark provider identity verified
    if (listing.claimedByProvider?.id) {
      await tx.provider.update({
        where: { id: listing.claimedByProvider.id },
        data: { verifiedIdentity: true, subscriptionTier: "CLAIM" },
      });

      // Set user role to PROVIDER if needed
      if (listing.claimedByProvider.userId) {
        await tx.user.update({
          where: { id: listing.claimedByProvider.userId },
          data: { role: "PROVIDER" },
        });
      }
    }

    await createAdminAction(tx, {
      adminUserId: admin.id,
      actionType: "APPROVE_CLAIM",
      targetType: "Listing",
      targetId: listingId,
    });
  });

  // Best-effort notification email
  if (listing.claimedByProvider?.contactEmail) {
    await sendEmail({
      to: listing.claimedByProvider.contactEmail,
      subject: `Your claim for "${listing.name}" has been approved — MumRated!`,
      html: `
        <p>Hi ${listing.claimedByProvider.businessName},</p>
        <p>Great news — your identity has been verified and your claim for <strong>${listing.name}</strong> is now approved.</p>
        <p>You can sign in to your provider dashboard to respond to reviews and update your listing profile.</p>
        <p>— The MumRated team</p>
      `,
    });
  }

  revalidatePath("/admin/provider-claims");
}

export async function rejectClaim(listingId: string, reason: string) {
  const admin = await requireAdmin();

  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      name: true,
      claimStatus: true,
      claimedByProvider: {
        select: { id: true, contactEmail: true, businessName: true },
      },
    },
  });

  if (!listing || listing.claimStatus !== "PENDING") return;

  await db.$transaction(async (tx) => {
    // Reset listing to UNCLAIMED
    await tx.listing.update({
      where: { id: listingId },
      data: {
        claimStatus: "UNCLAIMED",
        claimedByProviderId: null,
      },
    });

    await createAdminAction(tx, {
      adminUserId: admin.id,
      actionType: "REJECT_CLAIM",
      targetType: "Listing",
      targetId: listingId,
      reason,
    });
  });

  // Best-effort rejection email
  if (listing.claimedByProvider?.contactEmail) {
    await sendEmail({
      to: listing.claimedByProvider.contactEmail,
      subject: `Update on your claim for "${listing.name}" — MumRated!`,
      html: `
        <p>Hi ${listing.claimedByProvider.businessName},</p>
        <p>We were unable to approve your claim for <strong>${listing.name}</strong> at this time.</p>
        ${reason ? `<p>Reason: ${reason}</p>` : ""}
        <p>If you believe this is an error, please reply to this email.</p>
        <p>— The MumRated team</p>
      `,
    });
  }

  revalidatePath("/admin/provider-claims");
}
