import { invitePreview } from "@/server/lib/mobile/family";
import { publicRoute } from "@/server/lib/mobile/http";

/**
 * An invitation link being opened, before sign-in (contract:
 * InvitePreview; 404 not_found when invalid, used or expired).
 */
export const GET = (request: Request, params: { token: string }) =>
  publicRoute(async (req) => {
    const locale = req.headers.get("x-next-intl-locale") === "en" ? "en" : "ja";
    return invitePreview(params.token, locale);
  })(request);
