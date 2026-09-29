import { z } from "zod";
import { adminOnly } from "@/server/lib/mobile/admin";
import { mergeMembers } from "@/server/lib/mobile/admin-members";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("preview"),
    other: z.string().max(254),
    keep: z.enum(["this", "other"]),
  }),
  z.object({
    intent: z.literal("confirm"),
    keepId: IdParam,
    duplicateId: IdParam,
    force: z.boolean().optional(),
  }),
]);

/** 重複アカウントの統合: preview, then confirm (AdminMergeResult). */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    adminOnly(user);
    return mergeMembers(
      IdParam.parse(params.id),
      await readJson(request, Body),
    );
  },
);
