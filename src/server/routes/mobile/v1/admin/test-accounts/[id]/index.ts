import { adminOnly } from "@/server/lib/mobile/admin";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { deleteTestAccount } from "@/server/lib/test-accounts";

/** Delete a test account (only test accounts; as account deletion). */
export const DELETE = mobileRoute<{ id: string }>(async ({ user, params }) => {
  adminOnly(user);
  await deleteTestAccount(user, IdParam.parse(params.id));
  return { ok: true };
});
