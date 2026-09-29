import {
  chatMessages,
  MessagesQuery,
  SendBody,
  sendMessage,
} from "@/server/lib/mobile/chat";
import {
  IdParam,
  mobileRoute,
  query,
  readJson,
} from "@/server/lib/mobile/http";

/** ?before=<ISO> older messages, ?after=<ISO> new ones. */
export const GET = mobileRoute<{ id: string }>(({ request, params }) =>
  chatMessages(IdParam.parse(params.id), MessagesQuery.parse(query(request))),
);

/** Post a message: { body } → { message }. */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) =>
    sendMessage(
      user,
      IdParam.parse(params.id),
      await readJson(request, SendBody),
    ),
);
