import { IdParam, mobileRoute } from "@/server/lib/mobile/http";
import { markThreadRead } from "@/server/lib/mobile/verification-messages";

/** The thread was shown: the committee's messages so far are read (Ok). */
export const POST = mobileRoute<{ id: string }>(
  ({ user, params }) => markThreadRead(user, IdParam.parse(params.id)),
  "user",
);
