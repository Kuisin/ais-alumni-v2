import { z } from "zod";
import { addFamilyLinkAction } from "@/server/app/actions/admin-family";
import { adminOnly } from "@/server/lib/mobile/admin";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({ otherId: IdParam, as: z.enum(["parent", "child"]) });

/** 家族: link to a parent or child, confirmed (AdminFamilyResult). */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    adminOnly(user);
    const b = await readJson(request, Body);
    return addFamilyLinkAction(IdParam.parse(params.id), b.otherId, b.as);
  },
);
