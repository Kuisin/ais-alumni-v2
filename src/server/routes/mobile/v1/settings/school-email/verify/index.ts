import { z } from "zod";
import { verifyMySchoolEmailCodeAction } from "@/server/app/actions/school-email";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({
  email: z.string().max(254),
  code: z.string().max(20),
});

/** 設定 → 学校のメールアドレス: confirm the code and save → SchoolEmailResult. */
export const POST = mobileRoute(async ({ request }) => {
  const { email, code } = await readJson(request, Body);
  return verifyMySchoolEmailCodeAction(email, code);
});
