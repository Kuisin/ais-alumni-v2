import {
  messageReactions,
  ReactionBody,
  toggleReaction,
} from "@/server/lib/mobile/chat-reactions";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

type Params = { id: string; messageId: string };

/** The message's reactions (after a "reaction" signal). */
export const GET = mobileRoute<Params>(({ user, locale, params }) =>
  messageReactions(
    user,
    locale,
    IdParam.parse(params.id),
    IdParam.parse(params.messageId),
  ),
);

/** Toggle the member's reaction: { emoji } → { reactions }. */
export const POST = mobileRoute<Params>(
  async ({ request, user, locale, params }) =>
    toggleReaction(
      user,
      locale,
      IdParam.parse(params.id),
      IdParam.parse(params.messageId),
      await readJson(request, ReactionBody),
    ),
);
