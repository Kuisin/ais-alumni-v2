import { searchCohortStudentsAction } from "@/server/app/actions/admin-positions";
import { IdParam, mobileRoute, query } from "@/server/lib/mobile/http";

/** Students / graduates of the 学年 matching ?q= (for 学年代表). */
export const GET = mobileRoute<{ id: string }>(async ({ request, params }) =>
  searchCohortStudentsAction(IdParam.parse(params.id), query(request).q ?? ""),
);
