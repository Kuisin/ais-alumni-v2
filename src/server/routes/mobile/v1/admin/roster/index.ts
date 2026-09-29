import { z } from "zod";
import { adminRoster, deleteRoster } from "@/server/lib/mobile/admin-roster";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

/** 名簿: rows by kind (contract: AdminRoster). Committee admins. */
export const GET = mobileRoute(({ user }) => adminRoster(user));

const Delete = z.object({ confirm: z.boolean() });

/** Delete every roster row (contract: RosterDeleteResult). */
export const DELETE = mobileRoute(async ({ user, request }) => {
  const { confirm } = await readJson(request, Delete);
  return deleteRoster(user, confirm);
});
