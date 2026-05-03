import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { z } from "zod";
import { getAdminEmails } from "@/lib/admin";

const signUpSchema = z.object({
  businessName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(30).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  listingId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check your details and try again." },
      { status: 400 },
    );
  }

  const { businessName, contactEmail, contactPhone, websiteUrl, listingId } =
    parsed.data;

  // Ensure listing exists, is ACTIVE, and is UNCLAIMED
  const listing = await db.listing.findFirst({
    where: { id: listingId, status: "ACTIVE", claimStatus: "UNCLAIMED" },
    select: { id: true, name: true },
  });

  if (!listing) {
    return NextResponse.json(
      { error: "That listing is not available to claim or does not exist." },
      { status: 422 },
    );
  }

  // Check user doesn't already have a provider record
  const existingProvider = await db.provider.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (existingProvider) {
    return NextResponse.json(
      {
        error:
          "You already have a provider account. Sign in to your dashboard.",
      },
      { status: 409 },
    );
  }

  // Create Provider + set listing to PENDING in one transaction
  await db.$transaction(async (tx) => {
    const provider = await tx.provider.create({
      data: {
        userId: session.user!.id!,
        businessName,
        contactEmail,
        contactPhone: contactPhone ?? null,
        websiteUrl: websiteUrl ?? null,
      },
    });

    await tx.listing.update({
      where: { id: listingId },
      data: {
        claimStatus: "PENDING",
        claimedByProviderId: provider.id,
      },
    });
  });

  // Notify admin team (best-effort)
  const adminEmails = getAdminEmails();
  if (adminEmails.length > 0) {
    await sendEmail({
      to: adminEmails,
      subject: `New provider claim — ${businessName} for "${listing.name}"`,
      html: `
        <p><strong>${businessName}</strong> has applied to claim <strong>${listing.name}</strong>.</p>
        <p>Contact: <a href="mailto:${contactEmail}">${contactEmail}</a></p>
        ${contactPhone ? `<p>Phone: ${contactPhone}</p>` : ""}
        ${websiteUrl ? `<p>Website: <a href="${websiteUrl}">${websiteUrl}</a></p>` : ""}
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/provider-claims">Review in admin →</a></p>
      `,
    });
  }

  return NextResponse.json({ ok: true });
}
