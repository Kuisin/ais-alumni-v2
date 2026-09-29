import { composeOptions } from "@/server/lib/mobile/compose";
import { mobileRoute } from "@/server/lib/mobile/http";

/** What the news / event forms need (contract: ComposeOptions); 403 for non-authors. */
export const GET = mobileRoute(({ locale }) => composeOptions(locale));
