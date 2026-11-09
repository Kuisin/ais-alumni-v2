import type { PublicAccess } from "@contract/core";
import { loadDirectRules } from "@/server/lib/chat-db";
import { publicRoute } from "@/server/lib/mobile/http";

/**
 * 利用できる機能 without signing in (the website's public page): the
 * committee's current 1:1 talk settings, which the page's tables show.
 */
export const GET = publicRoute(async (): Promise<PublicAccess> => {
  const rules = await loadDirectRules();
  return {
    directRules: {
      CURRENT_STUDENT: rules.CURRENT_STUDENT,
      FORMER_STUDENT: rules.FORMER_STUDENT,
      CURRENT_PARENT: rules.CURRENT_PARENT,
      FORMER_PARENT: rules.FORMER_PARENT,
    },
  };
});
