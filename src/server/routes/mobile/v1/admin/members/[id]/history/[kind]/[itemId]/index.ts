import { adminOnly } from "@/server/lib/mobile/admin";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { deleteHistory, HistoryKind } from "@/server/lib/mobile/profile";

/** Remove one of the member's entries (deleteHistoryAction checks actionAdmin). */
export const DELETE = mobileRoute<{ id: string; kind: string; itemId: string }>(
  ({ user, params }) => {
    adminOnly(user);
    return deleteHistory(
      HistoryKind.parse(params.kind),
      IdParam.parse(params.itemId),
      IdParam.parse(params.id),
    );
  },
);
