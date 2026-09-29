import { z } from "zod";
import { NotifyChannel } from "@/server/generated/prisma/enums";
import { saveNotify } from "@/server/lib/mobile/account";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

// As the settings actions validate them (src/app/actions/settings.ts):
// the channel is one of the two choices; unknown categories are ignored.
const Body = z
  .object({
    via: z.enum([NotifyChannel.AUTO, NotifyChannel.EMAIL_ONLY]).optional(),
    on: z.array(z.string().max(40)).max(40).optional(),
  })
  .refine((b) => b.via !== undefined || b.on !== undefined, {
    message: "nothing to change",
  });

/** 設定 → 通知: NotifyUpdate → MySettings. */
export const PATCH = mobileRoute(async ({ request, user }) =>
  saveNotify(user, await readJson(request, Body)),
);
