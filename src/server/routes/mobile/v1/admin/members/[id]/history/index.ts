import { db } from "@/server/lib/db";
import { adminOnly } from "@/server/lib/mobile/admin";
import {
  IdParam,
  mobileRoute,
  notFound,
  readJson,
} from "@/server/lib/mobile/http";
import {
  HistoryBody,
  loadHistoryEditor,
  saveHistory,
} from "@/server/lib/mobile/profile";

/** 学歴・職歴 of a member (管理 → 会員 → 学歴・職歴) → HistoryEditor. */
export const GET = mobileRoute<{ id: string }>(
  async ({ user, params, locale }) => {
    adminOnly(user);
    const member = await db.user.findUnique({
      where: { id: IdParam.parse(params.id) },
      select: { id: true },
    });
    if (!member) throw notFound();
    return loadHistoryEditor(member, locale);
  },
);

/** Add or edit one of their entries (saveHistoryAction checks actionAdmin). */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    adminOnly(user);
    return saveHistory(
      await readJson(request, HistoryBody),
      IdParam.parse(params.id),
    );
  },
);
