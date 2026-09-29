import { deleteCommentAction } from "@/server/app/actions/news-hub";
import { IdParam, mobileRoute, notFound } from "@/server/lib/mobile/http";
import { hubResponse, requireCommentOnPost } from "@/server/lib/mobile/news";

/** Delete a comment: members their own, admins any (the action decides). */
export const DELETE = mobileRoute<{ id: string; commentId: string }>(
  async ({ params }) => {
    const commentId = IdParam.safeParse(params.commentId);
    if (!commentId.success) throw notFound();
    await requireCommentOnPost(params.id, commentId.data);
    return hubResponse(await deleteCommentAction(commentId.data));
  },
);
