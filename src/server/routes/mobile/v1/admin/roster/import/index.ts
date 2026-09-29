import { importRoster } from "@/server/lib/mobile/admin-roster";
import { mobileRoute } from "@/server/lib/mobile/http";

/** Preview or import the roster CSV (contract: RosterImportResult). */
export const POST = mobileRoute(({ user, request }) =>
  importRoster(user, request),
);
