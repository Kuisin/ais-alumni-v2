/**
 * Every /api/mobile/v1 endpoint (generated from src/server/routes/mobile/v1;
 * add a handler there and a line here). One API bundle for all of them —
 * see src/app/api/mobile/v1/[...path]+api.ts.
 */
import * as adminHome from "./mobile/v1/admin";
import * as r0 from "./mobile/v1/auth/email/request";
import * as r1 from "./mobile/v1/auth/email/verify";
import * as r2 from "./mobile/v1/auth/oauth/callback/line";
import * as r3 from "./mobile/v1/auth/oauth/exchange";
import * as r4 from "./mobile/v1/auth/oauth/start";
import * as r5 from "./mobile/v1/auth/signout";
import * as r6 from "./mobile/v1/chat";
import * as r8 from "./mobile/v1/chat/[id]";
import * as r9 from "./mobile/v1/chat/[id]/info";
import * as r10 from "./mobile/v1/chat/[id]/messages";
import * as r11 from "./mobile/v1/chat/[id]/messages/[messageId]";
import * as r12 from "./mobile/v1/chat/[id]/mute";
import * as r13 from "./mobile/v1/chat/[id]/notifications";
import * as r14 from "./mobile/v1/chat/[id]/read";
import * as r15 from "./mobile/v1/chat/[id]/report";
import * as r7 from "./mobile/v1/chat/direct";
import * as r16 from "./mobile/v1/config";
import * as r17 from "./mobile/v1/directory";
import * as r18 from "./mobile/v1/directory/options";
import * as r19 from "./mobile/v1/events";
import * as r20 from "./mobile/v1/events/[id]";
import * as r21 from "./mobile/v1/events/[id]/rsvp";
import * as fam0 from "./mobile/v1/family";
import * as fam1 from "./mobile/v1/family/children";
import * as fam2 from "./mobile/v1/family/links";
import * as fam3 from "./mobile/v1/family/links/[id]";
import * as fam4 from "./mobile/v1/family/links/[id]/confirm";
import * as fam5 from "./mobile/v1/family/managed/[childId]/handover";
import * as fam6 from "./mobile/v1/family/search";
import * as r22 from "./mobile/v1/follows";
import * as r23 from "./mobile/v1/follows/followers/[userId]";
import * as r24 from "./mobile/v1/follows/requests/[followId]/accept";
import * as r25 from "./mobile/v1/follows/requests/[followId]/decline";
import * as r26 from "./mobile/v1/home";
import * as r27 from "./mobile/v1/home/line-banner/dismiss";
import * as r28 from "./mobile/v1/home/line-link";
import * as inv0 from "./mobile/v1/invite/[token]";
import * as inv1 from "./mobile/v1/invites";
import * as inv2 from "./mobile/v1/invites/[id]/revoke";
import * as lineLink from "./mobile/v1/line/link";
import * as lineLinkStart from "./mobile/v1/line/link/start";
import * as r29 from "./mobile/v1/me";
import * as r30 from "./mobile/v1/members/[id]";
import * as r31 from "./mobile/v1/members/[id]/block";
import * as r32 from "./mobile/v1/members/[id]/follow";
import * as r33 from "./mobile/v1/news";
import * as r34 from "./mobile/v1/news/[id]";
import * as r35 from "./mobile/v1/news/[id]/comments";
import * as r36 from "./mobile/v1/news/[id]/comments/[commentId]";
import * as r37 from "./mobile/v1/news/[id]/comments/[commentId]/hide";
import * as r38 from "./mobile/v1/news/[id]/confirm";
import * as r39 from "./mobile/v1/news/[id]/reactions";
import * as r40 from "./mobile/v1/news/[id]/vote";
import * as r41 from "./mobile/v1/notifications";
import * as r42 from "./mobile/v1/notifications/open";
import * as r43 from "./mobile/v1/notifications/read";
import * as r44 from "./mobile/v1/profile";
import * as profileAbout from "./mobile/v1/profile/about";
import * as profileBirthDateRequest from "./mobile/v1/profile/birth-date-request";
import * as profileBirthDateRequestId from "./mobile/v1/profile/birth-date-request/[id]";
import * as profileDirectory from "./mobile/v1/profile/directory";
import * as profileFollowerFields from "./mobile/v1/profile/follower-fields";
import * as profileGender from "./mobile/v1/profile/gender";
import * as profileGenderRequest from "./mobile/v1/profile/gender-request";
import * as profileGenderRequestId from "./mobile/v1/profile/gender-request/[id]";
import * as profileHistory from "./mobile/v1/profile/history";
import * as profileHistoryKindId from "./mobile/v1/profile/history/[kind]/[id]";
import * as profileNameRequest from "./mobile/v1/profile/name-request";
import * as profileNameRequestId from "./mobile/v1/profile/name-request/[id]";
import * as profileOrgs from "./mobile/v1/profile/orgs";
import * as profilePhoto from "./mobile/v1/profile/photo";
import * as profilePhotoVisibility from "./mobile/v1/profile/photo/visibility";
import * as profileRecord from "./mobile/v1/profile/record";
import * as profileRecordId from "./mobile/v1/profile/record/[id]";
import * as r45 from "./mobile/v1/push";
import * as r46 from "./mobile/v1/push/test";
import * as r47 from "./mobile/v1/settings";
import * as r48 from "./mobile/v1/settings/devices";
import * as r49 from "./mobile/v1/settings/devices/[id]";
import * as r50 from "./mobile/v1/settings/language";
import * as r51 from "./mobile/v1/settings/notifications";
import * as vch0 from "./mobile/v1/vouch/[id]";

export type Handler = (
  request: Request,
  params: Record<string, string>,
) => Response | Promise<Response>;
export type RouteModule = Partial<Record<string, Handler>>;

/** [path pattern, module]; static segments before [params]. */
export const ROUTES: [string, RouteModule][] = [
  ["admin", adminHome as unknown as RouteModule],
  ["auth/email/request", r0 as unknown as RouteModule],
  ["auth/email/verify", r1 as unknown as RouteModule],
  ["auth/oauth/callback/line", r2 as unknown as RouteModule],
  ["auth/oauth/exchange", r3 as unknown as RouteModule],
  ["auth/oauth/start", r4 as unknown as RouteModule],
  ["auth/signout", r5 as unknown as RouteModule],
  ["chat", r6 as unknown as RouteModule],
  ["chat/direct", r7 as unknown as RouteModule],
  ["chat/[id]", r8 as unknown as RouteModule],
  ["chat/[id]/info", r9 as unknown as RouteModule],
  ["chat/[id]/messages", r10 as unknown as RouteModule],
  ["chat/[id]/messages/[messageId]", r11 as unknown as RouteModule],
  ["chat/[id]/mute", r12 as unknown as RouteModule],
  ["chat/[id]/notifications", r13 as unknown as RouteModule],
  ["chat/[id]/read", r14 as unknown as RouteModule],
  ["chat/[id]/report", r15 as unknown as RouteModule],
  ["config", r16 as unknown as RouteModule],
  ["directory", r17 as unknown as RouteModule],
  ["directory/options", r18 as unknown as RouteModule],
  ["events", r19 as unknown as RouteModule],
  ["events/[id]", r20 as unknown as RouteModule],
  ["events/[id]/rsvp", r21 as unknown as RouteModule],
  ["follows", r22 as unknown as RouteModule],
  ["follows/followers/[userId]", r23 as unknown as RouteModule],
  ["follows/requests/[followId]/accept", r24 as unknown as RouteModule],
  ["follows/requests/[followId]/decline", r25 as unknown as RouteModule],
  ["home", r26 as unknown as RouteModule],
  ["home/line-banner/dismiss", r27 as unknown as RouteModule],
  ["home/line-link", r28 as unknown as RouteModule],
  ["line/link", lineLink as unknown as RouteModule],
  ["line/link/start", lineLinkStart as unknown as RouteModule],
  ["me", r29 as unknown as RouteModule],
  ["members/[id]", r30 as unknown as RouteModule],
  ["members/[id]/block", r31 as unknown as RouteModule],
  ["members/[id]/follow", r32 as unknown as RouteModule],
  ["news", r33 as unknown as RouteModule],
  ["news/[id]", r34 as unknown as RouteModule],
  ["news/[id]/comments", r35 as unknown as RouteModule],
  ["news/[id]/comments/[commentId]", r36 as unknown as RouteModule],
  ["news/[id]/comments/[commentId]/hide", r37 as unknown as RouteModule],
  ["news/[id]/confirm", r38 as unknown as RouteModule],
  ["news/[id]/reactions", r39 as unknown as RouteModule],
  ["news/[id]/vote", r40 as unknown as RouteModule],
  ["notifications", r41 as unknown as RouteModule],
  ["notifications/open", r42 as unknown as RouteModule],
  ["notifications/read", r43 as unknown as RouteModule],
  ["profile", r44 as unknown as RouteModule],
  ["profile/about", profileAbout as unknown as RouteModule],
  [
    "profile/birth-date-request",
    profileBirthDateRequest as unknown as RouteModule,
  ],
  [
    "profile/birth-date-request/[id]",
    profileBirthDateRequestId as unknown as RouteModule,
  ],
  ["profile/directory", profileDirectory as unknown as RouteModule],
  ["profile/follower-fields", profileFollowerFields as unknown as RouteModule],
  ["profile/gender", profileGender as unknown as RouteModule],
  ["profile/gender-request", profileGenderRequest as unknown as RouteModule],
  [
    "profile/gender-request/[id]",
    profileGenderRequestId as unknown as RouteModule,
  ],
  ["profile/history", profileHistory as unknown as RouteModule],
  [
    "profile/history/[kind]/[id]",
    profileHistoryKindId as unknown as RouteModule,
  ],
  ["profile/name-request", profileNameRequest as unknown as RouteModule],
  ["profile/name-request/[id]", profileNameRequestId as unknown as RouteModule],
  ["profile/orgs", profileOrgs as unknown as RouteModule],
  ["profile/photo", profilePhoto as unknown as RouteModule],
  [
    "profile/photo/visibility",
    profilePhotoVisibility as unknown as RouteModule,
  ],
  ["profile/record", profileRecord as unknown as RouteModule],
  ["profile/record/[id]", profileRecordId as unknown as RouteModule],
  ["push", r45 as unknown as RouteModule],
  ["push/test", r46 as unknown as RouteModule],
  ["settings", r47 as unknown as RouteModule],
  ["settings/devices", r48 as unknown as RouteModule],
  ["settings/devices/[id]", r49 as unknown as RouteModule],
  ["settings/language", r50 as unknown as RouteModule],
  ["settings/notifications", r51 as unknown as RouteModule],
  ["family", fam0 as unknown as RouteModule],
  ["family/children", fam1 as unknown as RouteModule],
  ["family/links", fam2 as unknown as RouteModule],
  ["family/links/[id]", fam3 as unknown as RouteModule],
  ["family/links/[id]/confirm", fam4 as unknown as RouteModule],
  ["family/managed/[childId]/handover", fam5 as unknown as RouteModule],
  ["family/search", fam6 as unknown as RouteModule],
  ["invite/[token]", inv0 as unknown as RouteModule],
  ["invites", inv1 as unknown as RouteModule],
  ["invites/[id]/revoke", inv2 as unknown as RouteModule],
  ["vouch/[id]", vch0 as unknown as RouteModule],
];
