import {
  assignTeacher,
  unassignTeacher,
} from "@/server/lib/mobile/admin-teachers";
import { mobileRoute } from "@/server/lib/mobile/http";

/** Make the member a current teacher (現職). */
export const PUT = mobileRoute<{ id: string }>(({ user, params }) =>
  assignTeacher(user, params.id),
);

/** Move a current teacher to former (元教職員). */
export const DELETE = mobileRoute<{ id: string }>(({ user, params }) =>
  unassignTeacher(user, params.id),
);
