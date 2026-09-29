import { cookies } from "next/headers";

/**
 * Pages opened inside the native app's web view (Kuisin/ais-alumni-v2, via
 * /api/mobile/v1/web) carry this cookie. The app draws its own tab bar and
 * header there, so the website leaves out its navigation, account menu and
 * footer (src/components/layout/app-shell.tsx).
 */
export const EMBED_COOKIE = "ais_app";

export async function isEmbedded(): Promise<boolean> {
  try {
    return (await cookies()).get(EMBED_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}
