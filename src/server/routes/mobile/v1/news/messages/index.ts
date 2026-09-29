import { z } from "zod";
import { mobileRoute, query } from "@/server/lib/mobile/http";
import { messageList } from "@/server/lib/mobile/messages";

const Page = z.coerce.number().int().min(1).max(1000).catch(1);

/** あなた宛ての連絡, one page (contract: MessageList). */
export const GET = mobileRoute(({ request, user, locale }) =>
  messageList(user, Page.parse(query(request).page), locale),
);
