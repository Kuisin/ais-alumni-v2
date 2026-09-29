import {
  directCandidates,
  StartDirectBody,
  startDirect,
} from "@/server/lib/mobile/chat";
import { mobileRoute, readJson } from "@/server/lib/mobile/http";

/** Who the member can start a 1:1 talk with (/app/chat/new). */
export const GET = mobileRoute(({ user }) => directCandidates(user));

/** Open (or create) the 1:1 talk: { userId } → { groupId }. */
export const POST = mobileRoute(async ({ request }) =>
  startDirect(await readJson(request, StartDirectBody)),
);
