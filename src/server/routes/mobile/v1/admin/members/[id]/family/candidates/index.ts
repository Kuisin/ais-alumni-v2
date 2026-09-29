import { searchFamilyCandidatesAction } from "@/server/app/actions/admin-family";
import { adminOnly } from "@/server/lib/mobile/admin";
import { IdParam, mobileRoute, query } from "@/server/lib/mobile/http";

/** 家族: members who could be the parent / child (?as=&q=): AdminFamilyCandidate[]. */
export const GET = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    adminOnly(user);
    const { as, q } = query(request);
    return searchFamilyCandidatesAction(
      IdParam.parse(params.id),
      as === "parent" ? "parent" : "child",
      q ?? "",
    );
  },
);
