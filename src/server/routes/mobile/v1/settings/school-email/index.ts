import { z } from "zod";
import { sendMySchoolEmailCodeAction } from "@/server/app/actions/school-email";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({ email: z.string().max(254) });

/** 設定 → 学校のメールアドレス: send a code → SchoolEmailResult (teachers). */
export const POST = mobileRoute(async ({ request }) => {
  const { email } = await readJson(request, Body);
  return sendMySchoolEmailCodeAction(email);
});
