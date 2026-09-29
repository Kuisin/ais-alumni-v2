import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { deleteHistory, HistoryKind } from "@/server/lib/mobile/profile";

/** Remove one of my entries (others' are left alone, as on the website). */
export const DELETE = mobileRoute<{ kind: string; id: string }>(({ params }) =>
  deleteHistory(HistoryKind.parse(params.kind), IdParam.parse(params.id)),
);
