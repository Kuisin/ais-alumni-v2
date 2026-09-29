import { z } from "zod";
import { updateMemberProfileAction } from "@/server/app/actions/admin-members";
import { adminOnly } from "@/server/lib/mobile/admin";
import { formData, result } from "@/server/lib/mobile/admin-members";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const text = z.string().max(4000).default("");
const Body = z.object({
  lastNameRomaji: text,
  firstNameRomaji: text,
  middleNameRomaji: text,
  lastNameKanji: text,
  firstNameKanji: text,
  lastNameKana: text,
  firstNameKana: text,
  nameAtAis: text,
  dateOfBirth: text,
  bio: text,
  phone: text,
  gender: text,
});

/** プロフィール (admin edit): updateMemberProfileAction (AdminResult). */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) => {
    adminOnly(user);
    const userId = IdParam.parse(params.id);
    const body = await readJson(request, Body);
    return result(
      await updateMemberProfileAction({}, formData({ userId, ...body })),
    );
  },
);
