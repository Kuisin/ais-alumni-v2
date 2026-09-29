import { deleteMessage } from "@/server/lib/mobile/chat";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** Delete a message (the author's own; admins any). */
export const DELETE = mobileRoute<{ id: string; messageId: string }>(
  ({ params }) =>
    deleteMessage(IdParam.parse(params.id), IdParam.parse(params.messageId)),
);
