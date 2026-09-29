import { z } from "zod";
import { mergeManagedIntoApplicant } from "@/server/lib/mobile/admin-verification";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

/**
 * Merge a child account a parent created into this applicant's own
 * (only an actual match; { ok: true }). Committee admins only.
 */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    const { managedId } = await readJson(
      request,
      z.object({ managedId: IdParam }),
    );
    return mergeManagedIntoApplicant(user, IdParam.parse(params.id), managedId);
  },
);
