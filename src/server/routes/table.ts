/**
 * Every /api/mobile/v1 endpoint (generated from src/server/routes/mobile/v1;
 * add a handler there and a line here). One API bundle for all of them —
 * see src/app/api/mobile/v1/[...path]+api.ts.
 */
import * as adminHome from "./mobile/v1/admin";
import * as adminAudit from "./mobile/v1/admin/audit";
import * as adminChat from "./mobile/v1/admin/chat";
import * as adminChatReport from "./mobile/v1/admin/chat/reports/[id]";
import * as adminChatRules from "./mobile/v1/admin/chat/rules";
import * as adminCohorts from "./mobile/v1/admin/cohorts";
import * as adminCohort from "./mobile/v1/admin/cohorts/[id]";
import * as adminCohortReps from "./mobile/v1/admin/cohorts/[id]/reps";
import * as adminCohortStudents from "./mobile/v1/admin/cohorts/[id]/students";
import * as adminDestinations from "./mobile/v1/admin/destinations";
import * as ae0 from "./mobile/v1/admin/events";
import * as ae1 from "./mobile/v1/admin/events/[id]";
import * as ae2 from "./mobile/v1/admin/events/[id]/approve";
import * as ae3 from "./mobile/v1/admin/events/[id]/csv";
import * as ae4 from "./mobile/v1/admin/events/[id]/rsvp-closed";
import * as ae5 from "./mobile/v1/admin/events/[id]/staff";
import * as ae6 from "./mobile/v1/admin/events/[id]/xlsx";
import * as adminLine from "./mobile/v1/admin/line";
import * as adminLinePreview from "./mobile/v1/admin/line/preview";
import * as adminLineRichMenu from "./mobile/v1/admin/line/richmenu";
import * as adminMembers from "./mobile/v1/admin/members";
import * as adminMember from "./mobile/v1/admin/members/[id]";
import * as adminMemberAdmin from "./mobile/v1/admin/members/[id]/admin";
import * as adminMemberFamily from "./mobile/v1/admin/members/[id]/family";
import * as adminMemberFamilyLink from "./mobile/v1/admin/members/[id]/family/[linkId]";
import * as adminMemberFamilyConfirm from "./mobile/v1/admin/members/[id]/family/[linkId]/confirm";
import * as adminMemberFamilyCandidates from "./mobile/v1/admin/members/[id]/family/candidates";
import * as adminMemberHistory from "./mobile/v1/admin/members/[id]/history";
import * as adminMemberHistoryItem from "./mobile/v1/admin/members/[id]/history/[kind]/[itemId]";
import * as adminMemberMerge from "./mobile/v1/admin/members/[id]/merge";
import * as adminMemberPositions from "./mobile/v1/admin/members/[id]/positions";
import * as adminMemberProfile from "./mobile/v1/admin/members/[id]/profile";
import * as adminMemberRoles from "./mobile/v1/admin/members/[id]/roles";
import * as adminMemberRole from "./mobile/v1/admin/members/[id]/roles/[role]";
import * as adminMemberState from "./mobile/v1/admin/members/[id]/state";
import * as adminNameRequests from "./mobile/v1/admin/name-requests";
import * as adminNameRequestDecide from "./mobile/v1/admin/name-requests/[id]/decide";
import * as adminNews from "./mobile/v1/admin/news";
import * as adminNewsId from "./mobile/v1/admin/news/[id]";
import * as adminNewsIdApprove from "./mobile/v1/admin/news/[id]/approve";
import * as adminNewsIdArchive from "./mobile/v1/admin/news/[id]/archive";
import * as adminNewsIdClose from "./mobile/v1/admin/news/[id]/close";
import * as adminNewsIdNotify from "./mobile/v1/admin/news/[id]/notify";
import * as adminNotify from "./mobile/v1/admin/notify";
import * as adminNotifyId from "./mobile/v1/admin/notify/[id]";
import * as adminNotifyIdArchive from "./mobile/v1/admin/notify/[id]/archive";
import * as adminOrgs from "./mobile/v1/admin/organizations";
import * as adminOrgDelete from "./mobile/v1/admin/organizations/delete";
import * as adminOrgMerge from "./mobile/v1/admin/organizations/merge";
import * as adminOrgRename from "./mobile/v1/admin/organizations/rename";
import * as adminRecordRequests from "./mobile/v1/admin/record-requests";
import * as adminRecordRequestDecide from "./mobile/v1/admin/record-requests/[id]/decide";
import * as adminRoster from "./mobile/v1/admin/roster";
import * as adminRosterImport from "./mobile/v1/admin/roster/import";
import * as adminStats from "./mobile/v1/admin/stats";
import * as adminSupport from "./mobile/v1/admin/support";
import * as adminSupportRequest from "./mobile/v1/admin/support/[id]";
import * as adminTeachers from "./mobile/v1/admin/teachers";
import * as adminTeacher from "./mobile/v1/admin/teachers/[id]";
import * as adminVerification from "./mobile/v1/admin/verification";
import * as adminVerificationDetail from "./mobile/v1/admin/verification/[id]";
import * as adminVerificationDecision from "./mobile/v1/admin/verification/[id]/decision";
import * as adminVerificationMerge from "./mobile/v1/admin/verification/[id]/merge";
import * as adminVerificationVouchers from "./mobile/v1/admin/verification/[id]/vouchers";
import * as r0 from "./mobile/v1/auth/email/request";
import * as r1 from "./mobile/v1/auth/email/verify";
import * as authLineNative from "./mobile/v1/auth/line/native";
import * as r2 from "./mobile/v1/auth/oauth/callback/line";
import * as r3 from "./mobile/v1/auth/oauth/exchange";
import * as r4 from "./mobile/v1/auth/oauth/start";
import * as r5 from "./mobile/v1/auth/signout";
import * as r6 from "./mobile/v1/chat";
import * as r8 from "./mobile/v1/chat/[id]";
import * as r9 from "./mobile/v1/chat/[id]/info";
import * as r10 from "./mobile/v1/chat/[id]/messages";
import * as r11 from "./mobile/v1/chat/[id]/messages/[messageId]";
import * as chatReactions from "./mobile/v1/chat/[id]/messages/[messageId]/reactions";
import * as r12 from "./mobile/v1/chat/[id]/mute";
import * as r13 from "./mobile/v1/chat/[id]/notifications";
import * as r14 from "./mobile/v1/chat/[id]/read";
import * as r15 from "./mobile/v1/chat/[id]/report";
import * as r7 from "./mobile/v1/chat/direct";
import * as compose0 from "./mobile/v1/compose";
import * as compose1 from "./mobile/v1/compose/audience";
import * as compose2 from "./mobile/v1/compose/events";
import * as compose3 from "./mobile/v1/compose/files";
import * as compose4 from "./mobile/v1/compose/members";
import * as compose5 from "./mobile/v1/compose/news";
import * as r16 from "./mobile/v1/config";
import * as r17 from "./mobile/v1/directory";
import * as r18 from "./mobile/v1/directory/options";
import * as donateCheckout from "./mobile/v1/donate/checkout";
import * as r19 from "./mobile/v1/events";
import * as r20 from "./mobile/v1/events/[id]";
import * as checkIn0 from "./mobile/v1/events/[id]/check-in";
import * as checkIn1 from "./mobile/v1/events/[id]/check-in/search";
import * as checkIn2 from "./mobile/v1/events/[id]/check-in/undo";
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
import * as obHandover from "./mobile/v1/handover/[token]";
import * as obHandoverClaim from "./mobile/v1/handover/[token]/claim";
import * as r26 from "./mobile/v1/home";
import * as r27 from "./mobile/v1/home/line-banner/dismiss";
import * as r28 from "./mobile/v1/home/line-link";
import * as inv0 from "./mobile/v1/invite/[token]";
import * as inv1 from "./mobile/v1/invites";
import * as inv2 from "./mobile/v1/invites/[id]/revoke";
import * as lineLink from "./mobile/v1/line/link";
import * as lineLinkStart from "./mobile/v1/line/link/start";
import * as r29 from "./mobile/v1/me";
import * as meExport from "./mobile/v1/me/export";
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
import * as messages0 from "./mobile/v1/news/messages";
import * as messages1 from "./mobile/v1/news/messages/[id]";
import * as r41 from "./mobile/v1/notifications";
import * as r42 from "./mobile/v1/notifications/open";
import * as r43 from "./mobile/v1/notifications/read";
import * as obEmailRequest from "./mobile/v1/onboarding/email/request";
import * as obEmailVerify from "./mobile/v1/onboarding/email/verify";
import * as obLine from "./mobile/v1/onboarding/line";
import * as obLineSkip from "./mobile/v1/onboarding/line/skip";
import * as obStatus from "./mobile/v1/onboarding/status";
import * as obVerify from "./mobile/v1/onboarding/verify";
import * as obChildSearch from "./mobile/v1/onboarding/verify/children/search";
import * as obEvidence from "./mobile/v1/onboarding/verify/evidence";
import * as obEvidenceDiscard from "./mobile/v1/onboarding/verify/evidence/discard";
import * as obManagedDuplicate from "./mobile/v1/onboarding/verify/managed-duplicate";
import * as obSchoolEmailConfirm from "./mobile/v1/onboarding/verify/school-email/confirm";
import * as obSchoolEmailSend from "./mobile/v1/onboarding/verify/school-email/send";
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
import * as settingsDeactivate from "./mobile/v1/settings/deactivate";
import * as settingsDelete from "./mobile/v1/settings/delete";
import * as r48 from "./mobile/v1/settings/devices";
import * as r49 from "./mobile/v1/settings/devices/[id]";
import * as settingsEmail from "./mobile/v1/settings/email";
import * as r50 from "./mobile/v1/settings/language";
import * as r51 from "./mobile/v1/settings/notifications";
import * as settingsSchoolEmail from "./mobile/v1/settings/school-email";
import * as settingsSchoolEmailVerify from "./mobile/v1/settings/school-email/verify";
import * as settingsSignIn from "./mobile/v1/settings/sign-in/[provider]";
import * as obSupport from "./mobile/v1/support";
import * as vch0 from "./mobile/v1/vouch/[id]";

export type Handler = (
  request: Request,
  params: Record<string, string>,
) => Response | Promise<Response>;
export type RouteModule = Partial<Record<string, Handler>>;

/** [path pattern, module]; static segments before [params]. */
export const ROUTES: [string, RouteModule][] = [
  ["admin", adminHome as unknown as RouteModule],
  ["admin/name-requests", adminNameRequests as unknown as RouteModule],
  [
    "admin/name-requests/[id]/decide",
    adminNameRequestDecide as unknown as RouteModule,
  ],
  ["admin/record-requests", adminRecordRequests as unknown as RouteModule],
  [
    "admin/record-requests/[id]/decide",
    adminRecordRequestDecide as unknown as RouteModule,
  ],
  ["admin/roster", adminRoster as unknown as RouteModule],
  ["admin/roster/import", adminRosterImport as unknown as RouteModule],
  ["admin/teachers", adminTeachers as unknown as RouteModule],
  ["admin/teachers/[id]", adminTeacher as unknown as RouteModule],
  ["admin/verification", adminVerification as unknown as RouteModule],
  [
    "admin/verification/[id]",
    adminVerificationDetail as unknown as RouteModule,
  ],
  [
    "admin/verification/[id]/decision",
    adminVerificationDecision as unknown as RouteModule,
  ],
  [
    "admin/verification/[id]/merge",
    adminVerificationMerge as unknown as RouteModule,
  ],
  [
    "admin/verification/[id]/vouchers",
    adminVerificationVouchers as unknown as RouteModule,
  ],
  ["admin/members", adminMembers as unknown as RouteModule],
  ["admin/members/[id]", adminMember as unknown as RouteModule],
  ["admin/members/[id]/admin", adminMemberAdmin as unknown as RouteModule],
  ["admin/members/[id]/family", adminMemberFamily as unknown as RouteModule],
  [
    "admin/members/[id]/family/candidates",
    adminMemberFamilyCandidates as unknown as RouteModule,
  ],
  [
    "admin/members/[id]/family/[linkId]",
    adminMemberFamilyLink as unknown as RouteModule,
  ],
  [
    "admin/members/[id]/family/[linkId]/confirm",
    adminMemberFamilyConfirm as unknown as RouteModule,
  ],
  ["admin/members/[id]/history", adminMemberHistory as unknown as RouteModule],
  [
    "admin/members/[id]/history/[kind]/[itemId]",
    adminMemberHistoryItem as unknown as RouteModule,
  ],
  ["admin/members/[id]/merge", adminMemberMerge as unknown as RouteModule],
  [
    "admin/members/[id]/positions",
    adminMemberPositions as unknown as RouteModule,
  ],
  ["admin/members/[id]/profile", adminMemberProfile as unknown as RouteModule],
  ["admin/members/[id]/roles", adminMemberRoles as unknown as RouteModule],
  [
    "admin/members/[id]/roles/[role]",
    adminMemberRole as unknown as RouteModule,
  ],
  ["admin/members/[id]/state", adminMemberState as unknown as RouteModule],
  ["admin/events", ae0 as unknown as RouteModule],
  ["admin/events/[id]", ae1 as unknown as RouteModule],
  ["admin/events/[id]/approve", ae2 as unknown as RouteModule],
  ["admin/events/[id]/csv", ae3 as unknown as RouteModule],
  ["admin/events/[id]/rsvp-closed", ae4 as unknown as RouteModule],
  ["admin/events/[id]/staff", ae5 as unknown as RouteModule],
  ["admin/events/[id]/xlsx", ae6 as unknown as RouteModule],
  ["admin/news", adminNews as unknown as RouteModule],
  ["admin/news/[id]", adminNewsId as unknown as RouteModule],
  ["admin/news/[id]/approve", adminNewsIdApprove as unknown as RouteModule],
  ["admin/news/[id]/archive", adminNewsIdArchive as unknown as RouteModule],
  ["admin/news/[id]/close", adminNewsIdClose as unknown as RouteModule],
  ["admin/news/[id]/notify", adminNewsIdNotify as unknown as RouteModule],
  ["admin/notify", adminNotify as unknown as RouteModule],
  ["admin/notify/[id]", adminNotifyId as unknown as RouteModule],
  ["admin/notify/[id]/archive", adminNotifyIdArchive as unknown as RouteModule],
  ["admin/audit", adminAudit as unknown as RouteModule],
  ["admin/chat", adminChat as unknown as RouteModule],
  ["admin/chat/reports/[id]", adminChatReport as unknown as RouteModule],
  ["admin/chat/rules", adminChatRules as unknown as RouteModule],
  ["admin/cohorts", adminCohorts as unknown as RouteModule],
  ["admin/cohorts/[id]", adminCohort as unknown as RouteModule],
  ["admin/cohorts/[id]/reps", adminCohortReps as unknown as RouteModule],
  [
    "admin/cohorts/[id]/students",
    adminCohortStudents as unknown as RouteModule,
  ],
  ["admin/destinations", adminDestinations as unknown as RouteModule],
  ["admin/line", adminLine as unknown as RouteModule],
  ["admin/line/preview", adminLinePreview as unknown as RouteModule],
  ["admin/line/richmenu", adminLineRichMenu as unknown as RouteModule],
  ["admin/organizations", adminOrgs as unknown as RouteModule],
  ["admin/organizations/delete", adminOrgDelete as unknown as RouteModule],
  ["admin/organizations/merge", adminOrgMerge as unknown as RouteModule],
  ["admin/organizations/rename", adminOrgRename as unknown as RouteModule],
  ["admin/stats", adminStats as unknown as RouteModule],
  ["admin/support", adminSupport as unknown as RouteModule],
  ["admin/support/[id]", adminSupportRequest as unknown as RouteModule],
  ["auth/email/request", r0 as unknown as RouteModule],
  ["auth/email/verify", r1 as unknown as RouteModule],
  ["auth/line/native", authLineNative as unknown as RouteModule],
  ["auth/oauth/callback/line", r2 as unknown as RouteModule],
  ["auth/oauth/exchange", r3 as unknown as RouteModule],
  ["auth/oauth/start", r4 as unknown as RouteModule],
  ["auth/signout", r5 as unknown as RouteModule],
  ["donate/checkout", donateCheckout as unknown as RouteModule],
  ["chat", r6 as unknown as RouteModule],
  ["chat/direct", r7 as unknown as RouteModule],
  ["chat/[id]", r8 as unknown as RouteModule],
  ["chat/[id]/info", r9 as unknown as RouteModule],
  ["chat/[id]/messages", r10 as unknown as RouteModule],
  ["chat/[id]/messages/[messageId]", r11 as unknown as RouteModule],
  [
    "chat/[id]/messages/[messageId]/reactions",
    chatReactions as unknown as RouteModule,
  ],
  ["chat/[id]/mute", r12 as unknown as RouteModule],
  ["chat/[id]/notifications", r13 as unknown as RouteModule],
  ["chat/[id]/read", r14 as unknown as RouteModule],
  ["chat/[id]/report", r15 as unknown as RouteModule],
  ["compose", compose0 as unknown as RouteModule],
  ["compose/audience", compose1 as unknown as RouteModule],
  ["compose/events", compose2 as unknown as RouteModule],
  ["compose/files", compose3 as unknown as RouteModule],
  ["compose/members", compose4 as unknown as RouteModule],
  ["compose/news", compose5 as unknown as RouteModule],
  ["config", r16 as unknown as RouteModule],
  ["directory", r17 as unknown as RouteModule],
  ["directory/options", r18 as unknown as RouteModule],
  ["events", r19 as unknown as RouteModule],
  ["events/[id]", r20 as unknown as RouteModule],
  ["events/[id]/check-in", checkIn0 as unknown as RouteModule],
  ["events/[id]/check-in/search", checkIn1 as unknown as RouteModule],
  ["events/[id]/check-in/undo", checkIn2 as unknown as RouteModule],
  ["events/[id]/rsvp", r21 as unknown as RouteModule],
  ["follows", r22 as unknown as RouteModule],
  ["follows/followers/[userId]", r23 as unknown as RouteModule],
  ["follows/requests/[followId]/accept", r24 as unknown as RouteModule],
  ["follows/requests/[followId]/decline", r25 as unknown as RouteModule],
  ["handover/[token]", obHandover as unknown as RouteModule],
  ["handover/[token]/claim", obHandoverClaim as unknown as RouteModule],
  ["home", r26 as unknown as RouteModule],
  ["home/line-banner/dismiss", r27 as unknown as RouteModule],
  ["home/line-link", r28 as unknown as RouteModule],
  ["line/link", lineLink as unknown as RouteModule],
  ["line/link/start", lineLinkStart as unknown as RouteModule],
  ["me", r29 as unknown as RouteModule],
  ["me/export", meExport as unknown as RouteModule],
  ["members/[id]", r30 as unknown as RouteModule],
  ["members/[id]/block", r31 as unknown as RouteModule],
  ["members/[id]/follow", r32 as unknown as RouteModule],
  ["news", r33 as unknown as RouteModule],
  ["news/messages", messages0 as unknown as RouteModule],
  ["news/messages/[id]", messages1 as unknown as RouteModule],
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
  ["onboarding/email/request", obEmailRequest as unknown as RouteModule],
  ["onboarding/email/verify", obEmailVerify as unknown as RouteModule],
  ["onboarding/line", obLine as unknown as RouteModule],
  ["onboarding/line/skip", obLineSkip as unknown as RouteModule],
  ["onboarding/status", obStatus as unknown as RouteModule],
  ["onboarding/verify", obVerify as unknown as RouteModule],
  [
    "onboarding/verify/children/search",
    obChildSearch as unknown as RouteModule,
  ],
  ["onboarding/verify/evidence", obEvidence as unknown as RouteModule],
  [
    "onboarding/verify/evidence/discard",
    obEvidenceDiscard as unknown as RouteModule,
  ],
  [
    "onboarding/verify/managed-duplicate",
    obManagedDuplicate as unknown as RouteModule,
  ],
  [
    "onboarding/verify/school-email/confirm",
    obSchoolEmailConfirm as unknown as RouteModule,
  ],
  [
    "onboarding/verify/school-email/send",
    obSchoolEmailSend as unknown as RouteModule,
  ],
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
  ["settings/deactivate", settingsDeactivate as unknown as RouteModule],
  ["settings/delete", settingsDelete as unknown as RouteModule],
  ["settings/devices", r48 as unknown as RouteModule],
  ["settings/devices/[id]", r49 as unknown as RouteModule],
  ["settings/email", settingsEmail as unknown as RouteModule],
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
  ["settings/school-email", settingsSchoolEmail as unknown as RouteModule],
  [
    "settings/school-email/verify",
    settingsSchoolEmailVerify as unknown as RouteModule,
  ],
  ["settings/sign-in/[provider]", settingsSignIn as unknown as RouteModule],
  ["support", obSupport as unknown as RouteModule],
];
