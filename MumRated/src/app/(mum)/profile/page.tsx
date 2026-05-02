import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import ProfileForm from "./ProfileForm";

export const metadata = { title: "My Profile — MumRated!" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/profile");

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      id: true,
      displayName: true,
      photo: true,
      childAgeBand: true,
      city: true,
      email: true,
      isVerified: true,
      createdAt: true,
    },
  });

  return (
    <div className="container py-10 max-w-lg">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-dark">
          Your profile
        </h1>
        <p className="mt-1 text-sm text-muted">
          Fill in your details to earn your Verified Mum badge.
        </p>
      </div>

      <ProfileForm user={user} />
    </div>
  );
}
