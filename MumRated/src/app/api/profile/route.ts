import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { uploadProfilePhoto } from "@/lib/cloudinary";
import { z } from "zod";
import type { ChildAgeBand } from "@prisma/client";

const CHILD_AGE_BANDS: ChildAgeBand[] = [
  "NEWBORN",
  "INFANT",
  "TODDLER",
  "PRESCHOOL",
  "SCHOOL_AGE",
];

const profileSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  city: z.string().max(80).optional(),
  childAgeBand: z.enum(CHILD_AGE_BANDS as [ChildAgeBand, ...ChildAgeBand[]]).nullable().optional(),
  // photo is sent as a base64 data-URI when the mum picks a new image
  photoDataUri: z.string().startsWith("data:image/").optional(),
});

function computeIsVerified(user: {
  displayName?: string | null;
  photo?: string | null;
  childAgeBand?: ChildAgeBand | null;
}): boolean {
  return !!(user.displayName && user.photo && user.childAgeBand);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Something looks off — check your details and try again." },
      { status: 400 },
    );
  }

  const { displayName, city, childAgeBand, photoDataUri } = parsed.data;

  // Fetch current values so we can compute isVerified correctly
  const current = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { displayName: true, photo: true, childAgeBand: true },
  });

  let photoUrl: string | undefined;
  if (photoDataUri) {
    photoUrl = await uploadProfilePhoto(photoDataUri, session.user.id);
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(city !== undefined && { city }),
      ...(childAgeBand !== undefined && { childAgeBand }),
      ...(photoUrl !== undefined && { photo: photoUrl }),
      // Recompute badge: all three fields must be set
      isVerified: computeIsVerified({
        displayName: displayName ?? current.displayName,
        photo: photoUrl ?? current.photo,
        childAgeBand: childAgeBand !== undefined ? childAgeBand : current.childAgeBand,
      }),
    },
    select: {
      id: true,
      displayName: true,
      photo: true,
      childAgeBand: true,
      city: true,
      isVerified: true,
    },
  });

  return NextResponse.json(updated);
}
