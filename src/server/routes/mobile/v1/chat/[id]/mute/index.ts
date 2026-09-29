import { MuteBody, setMuted } from "@/server/lib/mobile/chat";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

/** The daily digest for this talk: { muted } (true = off). */
export const PUT = mobileRoute<{ id: string }>(async ({ request, params }) =>
  setMuted(IdParam.parse(params.id), await readJson(request, MuteBody)),
);
