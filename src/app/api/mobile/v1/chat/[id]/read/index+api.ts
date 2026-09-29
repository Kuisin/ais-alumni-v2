import { chatReads, markRead } from "@/server/lib/mobile/chat";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** When the other members last read the talk (既読 marks). */
export const GET = mobileRoute<{ id: string }>(({ params }) =>
  chatReads(IdParam.parse(params.id)),
);

/** The member has read everything up to now. */
export const POST = mobileRoute<{ id: string }>(({ params }) =>
  markRead(IdParam.parse(params.id)),
);
