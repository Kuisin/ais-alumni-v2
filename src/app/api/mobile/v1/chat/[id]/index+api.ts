import { chatRoom } from "@/server/lib/mobile/chat";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** A talk: its members, the latest messages and 既読 (/app/chat/[id]). */
export const GET = mobileRoute<{ id: string }>(({ user, locale, params }) =>
  chatRoom(user, locale, IdParam.parse(params.id)),
);
