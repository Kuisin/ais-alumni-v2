import type {
  ChangeRequest,
  DeviceList,
  MyProfile,
  MySettings,
  NotifyUpdate,
  PersonalField,
  ProfileRole,
  SignedInDevice,
  StaffArea,
} from "@contract/account";
import type { StaffAccess } from "@contract/core";
import { updateLanguageAction } from "@/server/app/actions/settings";
import { sortRoles } from "@/server/components/profile/role-details";
import {
  parseSocialLinks,
  SOCIAL_KEYS,
} from "@/server/components/profile/social-links";
import type { UserRole } from "@/server/generated/prisma/client";
import {
  ChangeRequestStatus,
  FollowStatus,
  NotifyChannel,
  RoleKey,
} from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { roleLabelKey } from "@/server/lib/audience";
import { defaultAvatar, storedAvatarUrl } from "@/server/lib/avatar";
import { getStaffAccess } from "@/server/lib/broadcasts";
import { gradeLabel } from "@/server/lib/cohorts";
import { cohortShortLabels } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import { PARENT_ROLES } from "@/server/lib/directory";
import { loadFollowCounts } from "@/server/lib/follows";
import { displayName, otherNames } from "@/server/lib/format";
import { isGender } from "@/server/lib/gender";
import { isOngoing, sortHistory } from "@/server/lib/history";
import { industryLabel } from "@/server/lib/industries";
import { jobTypeLabel } from "@/server/lib/job-types";
import { lineAddFriendUrl } from "@/server/lib/line-link";
import { ApiError, type Locale, notFound } from "@/server/lib/mobile/http";
import { bearerToken, hashMobileToken } from "@/server/lib/mobile/tokens";
import { chooseChannel } from "@/server/lib/notify";
import {
  NOTIFY_CATEGORIES,
  OPTIONAL_CATEGORIES,
} from "@/server/lib/notify/catalog";
import {
  followerFieldSet,
  PERSONAL_FIELDS,
} from "@/server/lib/personal-fields";
import {
  historyReach,
  personalReach,
  photoReach,
} from "@/server/lib/profile-visibility";
import { pushTargetsFor } from "@/server/lib/push/devices";
import type { CurrentUser } from "@/server/lib/session";
import { ssoReady } from "@/server/lib/sso";

/**
 * マイページ and 設定 for the native app: the website's /app/profile and
 * /app/settings pages as data. Each value comes from the same lib code the
 * pages use (visibility, notification routing, staff access…); editing the
 * profile stays on the website.
 */

// ---------------------------------------------------------------------------
// Profile (src/app/[locale]/app/(member)/profile/page.tsx)
// ---------------------------------------------------------------------------

type Translate = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

/**
 * 在籍情報 facts for one role, as the website's AisRecord shows them
 * (roleFacts in src/components/profile/role-details.tsx, not exported;
 * the 現在の状況 fact is left out there too).
 */
export function roleFacts(
  r: Pick<
    UserRole,
    | "role"
    | "cohortId"
    | "teacherStatus"
    | "yearsFrom"
    | "yearsTo"
    | "currentGrade"
    | "graduationOrLeaveYear"
    | "didGraduate"
    | "lastDivision"
  >,
  locale: Locale,
  cohortLabels: Record<string, string>,
  tr: Translate,
  tp: Translate,
): string[] {
  const facts: string[] = [];
  if (
    r.cohortId &&
    (r.role === RoleKey.CURRENT_STUDENT || r.role === RoleKey.FORMER_STUDENT) &&
    cohortLabels[r.cohortId]
  )
    facts.push(cohortLabels[r.cohortId]);
  switch (r.role) {
    case RoleKey.TEACHER:
      facts.push(
        tr(
          `teacherStatusShort.${r.teacherStatus === "FORMER" ? "FORMER" : "CURRENT"}`,
        ),
      );
      if (r.yearsFrom !== null)
        facts.push(
          r.yearsTo !== null
            ? tp("record.teacherYears", { from: r.yearsFrom, to: r.yearsTo })
            : tp("record.teacherYearsPresent", { from: r.yearsFrom }),
        );
      break;
    case RoleKey.CURRENT_STUDENT:
      if (r.currentGrade !== null)
        facts.push(gradeLabel(r.currentGrade, locale));
      break;
    case RoleKey.FORMER_STUDENT:
      if (r.graduationOrLeaveYear !== null)
        facts.push(
          r.didGraduate === false
            ? tp("record.left", { year: r.graduationOrLeaveYear })
            : tp("record.graduated", { year: r.graduationOrLeaveYear }),
        );
      if (r.lastDivision) facts.push(tr(`division.${r.lastDivision}`));
      break;
    default:
      break;
  }
  return facts;
}

/**
 * The latest change request as the website's RequestStatus shows it
 * (src/components/profile/request-status.tsx): nothing once withdrawn.
 */
function requestView(
  row: {
    id: string;
    status: ChangeRequestStatus;
    createdAt: Date;
    reviewNote: string | null;
  } | null,
): ChangeRequest | null {
  if (!row || row.status === ChangeRequestStatus.CANCELLED) return null;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    reviewNote: row.reviewNote,
  };
}

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function loadMyProfile(
  me: CurrentUser,
  locale: Locale,
): Promise<MyProfile> {
  const [tr, tp, cohortLabels] = await Promise.all([
    getTranslatorFor(locale, "roles"),
    getTranslatorFor(locale, "profile"),
    cohortShortLabels(locale),
  ]);
  const [counts, requests, education, work, name, birth, gender] =
    await Promise.all([
      loadFollowCounts(me.id),
      db.follow.count({
        where: { followeeId: me.id, status: FollowStatus.REQUESTED },
      }),
      db.educationEntry.findMany({
        where: { userId: me.id },
        include: { school: true },
      }),
      db.workEntry.findMany({
        where: { userId: me.id },
        include: { company: true },
      }),
      db.nameChangeRequest.findFirst({
        where: { userId: me.id },
        orderBy: { createdAt: "desc" },
      }),
      db.birthDateRequest.findFirst({
        where: { userId: me.id },
        orderBy: { createdAt: "desc" },
      }),
      db.genderRequest.findFirst({
        where: { userId: me.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const former = me.roles.find((r) => r.role === RoleKey.FORMER_STUDENT);
  const parent = me.roles.some((r) => PARENT_ROLES.includes(r.role));
  const social = parseSocialLinks(me.socialLinks);
  const shared = followerFieldSet(me.followerFields);
  const reachOf = (f: PersonalField) => personalReach(f, shared);

  const roles: ProfileRole[] = sortRoles(me.roles).map((r) => ({
    role: r.role,
    label: tr(roleLabelKey(r)),
    facts: roleFacts(r, locale, cohortLabels, tr, tp),
    subjects: r.role === RoleKey.TEACHER ? (r.subjects ?? null) : null,
  }));

  const birthReq = requestView(birth);
  const genderReq = requestView(gender);

  return {
    id: me.id,
    name: displayName(me, locale),
    otherName: otherNames(me),
    nameAtAis: me.nameAtAis,
    avatar: storedAvatarUrl(me.avatarUrl) ?? defaultAvatar(me.gender),
    roles,
    follows: { ...counts, requests },
    about: {
      bio: me.bio,
      phone: me.phone,
      phoneReach: reachOf("phone"),
      social: SOCIAL_KEYS.flatMap((key) => {
        const url = social[key];
        return url ? [{ key, url, reach: reachOf(key) }] : [];
      }),
      autoAcceptSameYear: former ? me.autoAcceptSameYear : null,
    },
    directoryListed: parent ? !me.hideFromDirectory : null,
    photo: { public: me.avatarPublic, reach: photoReach(me.avatarPublic) },
    sharedWithFollowers: PERSONAL_FIELDS.filter((f) => shared.has(f)),
    history: {
      education: sortHistory(education).map((e) => ({
        id: e.id,
        school: e.school.name,
        level: e.level,
        field: e.field,
        startYear: e.startYear,
        endYear: e.endYear,
        ongoing: isOngoing(e),
        reach: historyReach(e.visibility),
      })),
      work: sortHistory(work).map((e) => ({
        id: e.id,
        company: e.company.name,
        title: e.title,
        industry: industryLabel(e.industry, locale),
        jobType: jobTypeLabel(e.jobType, locale),
        startYear: e.startYear,
        endYear: e.endYear,
        ongoing: isOngoing(e),
        reach: historyReach(e.visibility),
      })),
    },
    currentStage: former
      ? {
          stage: former.currentStage,
          detail: former.currentStageDetail,
          detailReach: reachOf("currentStageDetail"),
        }
      : null,
    names: {
      romaji: me.nameRomaji,
      kanji: me.nameKanji,
      kana: me.nameKana,
      nameAtAis: me.nameAtAis,
      request: requestView(name),
    },
    birthDate: {
      value: me.dateOfBirth ? day(me.dateOfBirth) : null,
      request:
        birth && birthReq
          ? { ...birthReq, proposed: day(birth.proposed) }
          : null,
    },
    gender: {
      value: isGender(me.gender) ? me.gender : null,
      request:
        gender && genderReq
          ? { ...genderReq, proposed: gender.proposed }
          : null,
    },
    account: {
      email: me.primaryEmail,
      emailReach: reachOf("email"),
      lineDisplayName: me.lineDisplayName,
      lineReach: reachOf("lineDisplayName"),
    },
  };
}

// ---------------------------------------------------------------------------
// Settings (src/app/[locale]/app/(member)/settings/page.tsx)
// ---------------------------------------------------------------------------

/** 管理モード's 「できること」: committee admins' access already covers news. */
export function adminModeAreas(access: StaffAccess): StaffArea[] {
  return (["admin", "broadcast", "teachers", "news"] as const).filter(
    (k) => access[k] && !(k === "news" && access.admin),
  );
}

/** Every category, on/off as the settings page shows it. */
export function notifyCategories(
  notifyOff: readonly string[],
): MySettings["notify"]["categories"] {
  return NOTIFY_CATEGORIES.map((key) => {
    const locked = !OPTIONAL_CATEGORIES.includes(key);
    return { key, on: locked || !notifyOff.includes(key), locked };
  });
}

/**
 * The categories turned off when `on` are the ones to receive — as
 * updateNotifyCategoriesAction (src/app/actions/settings.ts) saves them.
 */
export function notifyOffFor(on: readonly string[]): string[] {
  const set = new Set(on);
  return OPTIONAL_CATEGORIES.filter((c) => !set.has(c));
}

export async function loadMySettings(user: CurrentUser): Promise<MySettings> {
  const [access, push] = await Promise.all([
    getStaffAccess(user),
    pushTargetsFor([user.id]),
  ]);
  const teacher = user.roles.find((r) => r.role === RoleKey.TEACHER) ?? null;
  return {
    locale: user.locale === "en" ? "en" : "ja",
    email: user.primaryEmail,
    notify: {
      via: user.notifyVia === NotifyChannel.EMAIL_ONLY ? "EMAIL_ONLY" : "AUTO",
      // A phone with app notifications on gets them instead (notifyBatch).
      route: push.get(user.id)?.length
        ? "PUSH"
        : (chooseChannel(user) ?? "NONE"),
      categories: notifyCategories(user.notifyOff),
    },
    line: {
      linked: Boolean(user.lineUserId),
      following: user.lineFollowing,
      displayName: user.lineDisplayName,
      addFriendUrl: lineAddFriendUrl(),
      linkReady: ssoReady("line"),
    },
    adminMode: adminModeAreas(access),
    schoolEmail: teacher
      ? { email: teacher.schoolEmail, verified: teacher.schoolEmailVerified }
      : null,
  };
}

/** The member, re-read after a change. */
async function reload(user: CurrentUser): Promise<CurrentUser> {
  return db.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { roles: true },
  });
}

/** Next's redirect() signal (thrown, like notFound()). */
function isRedirect(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/**
 * 設定 → 言語, through the website's own action (saves the language and
 * switches the member's LINE menu to it). On success the action redirects
 * the settings page to the new language — here that just means "saved".
 */
export async function saveLanguage(
  user: CurrentUser,
  locale: Locale,
): Promise<MySettings> {
  const form = new FormData();
  form.set("locale", locale);
  let failed = false;
  try {
    failed = Boolean((await updateLanguageAction({}, form)).error);
  } catch (e) {
    if (!isRedirect(e)) throw e;
  }
  if (failed) throw new ApiError(500, "server_error");
  return loadMySettings(await reload(user));
}

/**
 * 設定 → 通知. The website's updateNotifyViaAction /
 * updateNotifyCategoriesAction can't run here (they call refresh(), which
 * throws outside a server action), so this saves exactly what they save.
 */
export async function saveNotify(
  user: CurrentUser,
  patch: NotifyUpdate,
): Promise<MySettings> {
  const data: { notifyVia?: NotifyChannel; notifyOff?: string[] } = {};
  if (patch.via) data.notifyVia = patch.via;
  if (patch.on) data.notifyOff = notifyOffFor(patch.on);
  if (data.notifyVia !== undefined || data.notifyOff !== undefined)
    await db.user.update({ where: { id: user.id }, data });
  return loadMySettings(await reload(user));
}

// ---------------------------------------------------------------------------
// Signed-in devices (MobileSession, src/lib/mobile/tokens.ts)
// ---------------------------------------------------------------------------

/** Hash of the bearer token this request was made with (null: none). */
function currentTokenHash(request: Request): string | null {
  const token = bearerToken(request.headers.get("authorization"));
  return token ? hashMobileToken(token) : null;
}

/** This device first, then the most recently used. */
export function orderDevices(devices: SignedInDevice[]): SignedInDevice[] {
  return [...devices].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      b.lastUsedAt.localeCompare(a.lastUsedAt),
  );
}

export async function listDevices(
  user: CurrentUser,
  request: Request,
  now: Date = new Date(),
): Promise<DeviceList> {
  const mine = currentTokenHash(request);
  const rows = await db.mobileSession.findMany({
    where: { userId: user.id, expiresAt: { gt: now } },
    select: {
      id: true,
      tokenHash: true,
      platform: true,
      deviceName: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });
  return {
    devices: orderDevices(
      rows.map((r) => ({
        id: r.id,
        platform: r.platform,
        deviceName: r.deviceName,
        createdAt: r.createdAt.toISOString(),
        lastUsedAt: r.lastUsedAt.toISOString(),
        current: mine !== null && r.tokenHash === mine,
      })),
    ),
  };
}

/** Sign out one of the member's other devices. */
export async function signOutDevice(
  user: CurrentUser,
  request: Request,
  id: string,
): Promise<void> {
  const row = await db.mobileSession.findFirst({
    where: { id, userId: user.id },
    select: { tokenHash: true },
  });
  if (!row) throw notFound();
  if (row.tokenHash === currentTokenHash(request))
    throw new ApiError(400, "current_device");
  await db.mobileSession.deleteMany({ where: { id, userId: user.id } });
}

/** Sign out every device of the member's except this one. */
export async function signOutOtherDevices(
  user: CurrentUser,
  request: Request,
): Promise<number> {
  const mine = currentTokenHash(request);
  const { count } = await db.mobileSession.deleteMany({
    where: {
      userId: user.id,
      ...(mine ? { tokenHash: { not: mine } } : {}),
    },
  });
  return count;
}
