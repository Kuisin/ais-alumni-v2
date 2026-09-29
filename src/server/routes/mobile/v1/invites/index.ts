import { createInvite, invitesPage } from "@/server/lib/mobile/family";
import { mobileRoute } from "@/server/lib/mobile/http";

/** 同窓生を招待: my invitations (contract: InvitesPage). */
export const GET = mobileRoute(({ user, locale }) => invitesPage(user, locale));

/**
 * {kind, type, cohortNumber, inviteeName}: create a link (contract:
 * InviteCreated; errors invites.errors.<code>).
 */
export const POST = mobileRoute(async ({ request, user }) =>
  createInvite(user, await request.json().catch(() => null)),
);
