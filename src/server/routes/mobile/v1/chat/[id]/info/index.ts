import { chatInfo } from "@/server/lib/mobile/chat";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** A talk's details and members (/app/chat/[id]/info). */
export const GET = mobileRoute<{ id: string }>(({ user, locale, params }) =>
  chatInfo(user, locale, IdParam.parse(params.id)),
);
