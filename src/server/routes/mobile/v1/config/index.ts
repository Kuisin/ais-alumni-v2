import type { AppConfig } from "@/server/lib/mobile/contract/core";
import { publicRoute } from "@/server/lib/mobile/http";
import { ssoReady } from "@/server/lib/sso";

/** What the app needs before sign-in (which sign-in buttons to show). */
export const GET = publicRoute(
  async (): Promise<AppConfig> => ({
    sso: { google: ssoReady("google"), line: ssoReady("line") },
    lineOaId: process.env.NEXT_PUBLIC_LINE_OA_ID?.trim() || null,
    minAppVersion: null,
  }),
);
