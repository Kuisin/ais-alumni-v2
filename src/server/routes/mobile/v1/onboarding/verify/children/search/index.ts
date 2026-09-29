import type { RegisteredChild } from "@contract/onboarding";
import { z } from "zod";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";
import { APPLICANT_STATES, inState } from "@/server/lib/mobile/onboarding";
import { findRegisteredChildren } from "@/server/lib/parent-onboarding";

const Body = z.object({
  name: z.string().max(1000),
  dateOfBirth: z.string().max(100),
});

/** Parents: a child who is already registered (exact name + birth date). */
export const POST = mobileRoute(async ({ request }) => {
  const user = await inState(...APPLICANT_STATES);
  const body = await readJson(request, Body);
  return {
    children: await findRegisteredChildren(
      {
        name: body.name.slice(0, 100),
        dateOfBirth: body.dateOfBirth.slice(0, 10),
      },
      user.id,
      user.locale === "en" ? "en" : "ja",
    ),
  } satisfies { children: RegisteredChild[] };
}, "user");
