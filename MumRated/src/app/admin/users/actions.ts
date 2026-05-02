"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, createAdminAction } from "@/lib/admin";

export async function suspendUser(userId: string, reason: string) {
  const admin = await requireAdmin();

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isSuspended: true },
    });

    await createAdminAction(tx, {
      adminUserId: admin.id,
      actionType: "SUSPEND_USER",
      targetType: "User",
      targetId: userId,
      reason,
    });
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function unsuspendUser(userId: string) {
  const admin = await requireAdmin();

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isSuspended: false },
    });

    await createAdminAction(tx, {
      adminUserId: admin.id,
      actionType: "UNSUSPEND_USER",
      targetType: "User",
      targetId: userId,
    });
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}
