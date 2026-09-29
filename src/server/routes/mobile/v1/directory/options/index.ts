import { mobileRoute } from "@/server/lib/mobile/http";
import { directoryOptions } from "@/server/lib/mobile/people";

/** The directory filter choices (contract: DirectoryOptions). */
export const GET = mobileRoute(({ locale }) => directoryOptions(locale));
