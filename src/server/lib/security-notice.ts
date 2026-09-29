import { getTranslatorFor } from "@/server/i18n/translator";
import { db } from "@/server/lib/db";
import { NOTIFY_USER_SELECT, notify } from "@/server/lib/notify";

/**
 * Security notice when Google/LINE is linked to an existing account (§11:
 * account security changes always go by email too). Never throws.
 */
export async function notifySignInMethodAdded(
  userId: string,
  provider: "google" | "line",
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: NOTIFY_USER_SELECT,
    });
    if (!user) return;
    await notify(user, {
      kind: "SECURITY_METHOD_ADDED",
      path: "/app/settings",
      params: async (locale) => {
        const t = await getTranslatorFor(locale, "settings");
        return { method: t(`methods.${provider}`) };
      },
    });
  } catch (e) {
    console.error("[security-notice] failed", e);
  }
}
