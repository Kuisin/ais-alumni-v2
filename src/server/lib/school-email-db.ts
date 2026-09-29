import { db } from "@/server/lib/db";

/** Is this school address already another member's? (one per address) */
export async function schoolEmailTaken(
  email: string,
  userId: string,
): Promise<boolean> {
  const row = await db.userRole.findUnique({
    where: { schoolEmail: email.trim().toLowerCase() },
    select: { userId: true },
  });
  return row !== null && row.userId !== userId;
}
