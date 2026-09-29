import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { changeEmail } from "@/server/lib/mobile/settings";

const Body = z.object({
  intent: z.enum(["send", "resend", "verify"]),
  email: z.string().max(254),
  code: z.string().max(20).optional(),
});

/** 設定 → メールアドレス: EmailChangeRequest → EmailChangeState. */
export const POST = mobileRoute(async ({ request }) =>
  changeEmail(await readJson(request, Body)),
);
