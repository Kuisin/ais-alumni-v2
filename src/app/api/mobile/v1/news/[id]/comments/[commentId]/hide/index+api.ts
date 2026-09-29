import { z } from "zod";
import { hideCommentAction } from "@/server/app/actions/news-hub";
import {
  IdParam,
  mobileRoute,
  notFound,
  readJson,
} from "@/server/lib/mobile/http";
import { hubResponse, requireCommentOnPost } from "@/server/lib/mobile/news";

const Body = z.object({ hide: z.boolean() });

/** Admin moderation: hide a comment, or show it again (the action checks). */
export const POST = mobileRoute<{ id: string; commentId: string }>(
  async ({ request, params }) => {
    const commentId = IdParam.safeParse(params.commentId);
    if (!commentId.success) throw notFound();
    const { hide } = await readJson(request, Body);
    await requireCommentOnPost(params.id, commentId.data);
    return hubResponse(await hideCommentAction(commentId.data, hide));
  },
);
