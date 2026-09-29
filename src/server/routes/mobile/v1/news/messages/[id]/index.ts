import { mobileRoute } from "@/server/lib/mobile/http";
import { messageDetail } from "@/server/lib/mobile/messages";

/** One message (contract: MessageDetail); opening it records the read. */
export const GET = mobileRoute<{ id: string }>(({ user, params, locale }) =>
  messageDetail(user, params.id, locale),
);
