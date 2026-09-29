import { mobileRoute, query } from "@/server/lib/mobile/http";
import { OrgQuery, searchOrgs } from "@/server/lib/mobile/profile";

/** School / company suggestions for the history form → OrgSearch. */
export const GET = mobileRoute(({ request }) =>
  searchOrgs(OrgQuery.parse(query(request))),
);
