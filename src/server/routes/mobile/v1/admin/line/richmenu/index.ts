import { installRichMenuAction } from "@/server/app/actions/line-richmenu";
import { mobileRoute } from "@/server/lib/mobile/http";

/** Build the menu images and install them (contract: RichMenuResult). */
export const POST = mobileRoute(async () =>
  installRichMenuAction({}, new FormData()),
);
