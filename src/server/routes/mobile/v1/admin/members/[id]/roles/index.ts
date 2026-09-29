import { z } from "zod";
import { saveMemberRoleAction } from "@/server/app/actions/admin-members";
import { adminOnly } from "@/server/lib/mobile/admin";
import { result, roleForm } from "@/server/lib/mobile/admin-members";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const text = z.string().max(400).default("");
const Body = z.object({
  role: z.string().max(40),
  cohortNumber: text,
  yearsFrom: text,
  yearsTo: text,
  subjects: text,
  schoolEmail: text,
  studentIdNo: text,
});

/** Add or save a role: saveMemberRoleAction (AdminResult). */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    adminOnly(user);
    const body = await readJson(request, Body);
    return result(
      await saveMemberRoleAction(
        {},
        roleForm(
          IdParam.parse(params.id),
          body as Parameters<typeof roleForm>[1],
        ),
      ),
    );
  },
);
