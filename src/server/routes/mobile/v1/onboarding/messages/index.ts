import { mobileRoute } from "@/server/lib/mobile/http";
import { applicationThreads } from "@/server/lib/mobile/verification-messages";

/**
 * 「やりとり」 with the committee (contract: ApplicationThreads): my own
 * application's, and those of child accounts I manage. Any signed-in account.
 */
export const GET = mobileRoute(
  ({ user, locale }) => applicationThreads(user, locale),
  "user",
);
