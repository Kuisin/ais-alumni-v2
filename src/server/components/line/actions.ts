// From the website's server actions; here plain functions the API calls.

import { revalidatePath } from "next/cache";
import { db } from "@/server/lib/db";
import { actionActive } from "@/server/lib/session";

/** Hide the dashboard "Get updates on LINE" banner for 30 days (§5.2). */
export async function dismissLineBannerAction(): Promise<void> {
  const user = await actionActive();
  await db.user.update({
    where: { id: user.id },
    data: { lineBannerDismissedAt: new Date() },
  });
  revalidatePath("/[locale]/app/dashboard", "page");
}
