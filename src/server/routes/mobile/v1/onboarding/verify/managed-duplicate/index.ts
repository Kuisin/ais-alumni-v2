import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { APPLICANT_STATES, inState } from "@/server/lib/mobile/onboarding";
import { findManagedMatches } from "@/server/lib/parent-onboarding";

const s = z
  .string()
  .max(1000)
  .catch("")
  .transform((v) => v.slice(0, 60));
const Body = z.object({
  lastNameRomaji: s,
  firstNameRomaji: s,
  lastNameKanji: s,
  firstNameKanji: s,
  dateOfBirth: s,
});

/** Students: was I already registered by a parent? (exact name + birth date) */
export const POST = mobileRoute(async ({ request }) => {
  const user = await inState(...APPLICANT_STATES);
  const b = await readJson(request, Body);
  const matches = await findManagedMatches(
    {
      names: [
        `${b.firstNameRomaji} ${b.lastNameRomaji}`,
        `${b.lastNameKanji}${b.firstNameKanji}`,
      ],
      dateOfBirth: b.dateOfBirth,
    },
    user.id,
  );
  return { found: matches.length > 0 };
}, "user");
