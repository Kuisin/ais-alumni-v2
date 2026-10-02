import type { AppConfig } from "@contract/core";
import { donationsReady, portalLoginUrl } from "@/server/lib/donations";
import { publicRoute } from "@/server/lib/mobile/http";
import { ssoReady } from "@/server/lib/sso";

/** TESTFLIGHT_URL: the external testing group's public link. */
function testflightUrl(): string | null {
  const url = process.env.TESTFLIGHT_URL?.trim();
  return url && /^https:\/\/testflight\.apple\.com\/join\/\w+$/.test(url)
    ? url
    : null;
}

/** What the app needs before sign-in (which sign-in buttons to show). */
export const GET = publicRoute(
  async (): Promise<AppConfig> => ({
    // Google sign-in isn't implemented in the app (only /auth/oauth/start
    // with provider=line is), so never offer it.
    sso: { google: false, line: ssoReady("line") },
    lineOaId: process.env.NEXT_PUBLIC_LINE_OA_ID?.trim() || null,
    // Public: LINE puts it in every authorization URL anyway.
    lineChannelId: ssoReady("line")
      ? process.env.AUTH_LINE_ID?.trim() || null
      : null,
    // e.g. "1.1.0": older installed apps show "update the app" (src/app/
    // _layout.tsx) and stop there, for when the API changes incompatibly.
    donations: donationsReady() ? { portalUrl: portalLoginUrl() } : null,
    install: { testflightUrl: testflightUrl() },
    minAppVersion: process.env.MIN_APP_VERSION?.trim() || null,
    storeUrl: {
      ios: process.env.APP_STORE_URL?.trim() || null,
      android:
        "https://play.google.com/store/apps/details?id=net.kailab.aisalumni",
    },
  }),
);
