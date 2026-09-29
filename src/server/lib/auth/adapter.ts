import { Locale } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";

/**
 * From the website's Auth.js adapter (src/lib/auth/adapter.ts in
 * Kuisin/ais-alumni-app): only what the API uses. Browser sign-in and the
 * adapter itself stay on the website.
 */

/** Follow UserMerge redirects so sessions of merged accounts keep working. */
export async function resolveUserId(id: string): Promise<string> {
  let current = id;
  for (let i = 0; i < 5; i++) {
    const merge = await db.userMerge.findUnique({
      where: { fromUserId: current },
    });
    if (!merge) return current;
    current = merge.toUserId;
  }
  return current;
}

export function pickLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const lang = value.toLowerCase().slice(0, 2);
  return lang === "ja" ? Locale.ja : lang === "en" ? Locale.en : null;
}
