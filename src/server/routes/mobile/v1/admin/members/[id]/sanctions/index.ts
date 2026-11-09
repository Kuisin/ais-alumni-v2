import type { AdminSanctions } from "@contract/admin-members";
import { z } from "zod";
import { SanctionLevel } from "@/server/generated/prisma/enums";
import { adminOnly } from "@/server/lib/mobile/admin";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";
import { applySanction, sanctionsFor } from "@/server/lib/sanctions";

const Body = z.object({
  level: z.enum(SanctionLevel),
  reason: z.string().trim().min(1).max(1000),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
});

/** 会員詳細 → 処分: the one in force and the history (admins). */
export const GET = mobileRoute<{ id: string }>(
  async ({ user, params }): Promise<AdminSanctions> => {
    adminOnly(user);
    return sanctionsFor(IdParam.parse(params.id));
  },
);

/** Apply a sanction (lifts the one in force) → AdminSanctions. */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }): Promise<AdminSanctions> => {
    adminOnly(user);
    const id = IdParam.parse(params.id);
    const body = await readJson(request, Body);
    await applySanction(user, id, {
      level: body.level,
      reason: body.reason,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
    return sanctionsFor(id);
  },
);
