import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";
import {
  NotifyLevelBody,
  setChatNotifyLevel,
} from "@/server/lib/mobile/notifications";

/** A group chat's notification level: all | mentions | off. */
export const PUT = mobileRoute<{ id: string }>(
  async ({ request, user, params }) =>
    setChatNotifyLevel(
      user,
      IdParam.parse(params.id),
      (await readJson(request, NotifyLevelBody)).level,
    ),
);
