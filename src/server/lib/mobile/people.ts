import { sortRoles } from "@/server/components/profile/role-details";
import {
  parseSocialLinks,
  SOCIAL_KEYS,
} from "@/server/components/profile/social-links";
import {
  FollowStatus,
  LifeStage,
  RoleKey,
} from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { MEMBER_FILTER_OPTIONS, roleLabelKey } from "@/server/lib/audience";
import {
  blockedUserIds,
  canRequestFollow,
  getProfileForViewer,
  type ProfileView,
  projectPrivate,
  projectPublic,
  sameFamily,
  toViewer,
} from "@/server/lib/authz";
import {
  type Connections,
  defaultAvatar,
  loadConnections,
  photoVisible,
  storedAvatarUrl,
} from "@/server/lib/avatar";
import { directChatDenial } from "@/server/lib/chat-db";
import { gradeLabel } from "@/server/lib/cohorts";
import { cohortShortLabels, loadCohortOptions } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import {
  ALL_ROLES,
  buildDirectoryWhere,
  DEFAULT_DIRECTORY_ROLE,
  hasActiveFilters,
  MAX_YEAR,
  MIN_YEAR,
  type PublicCard,
  parseDirectoryFilters,
  searchDirectory,
} from "@/server/lib/directory";
import {
  acceptFollow,
  blockUser,
  declineFollow,
  type FollowUiState,
  followButtonState,
  followsMe,
  loadAcceptedFollower,
  loadFollowButtonStates,
  loadFollowCounts,
  loadFollowLists,
  loadFollowStatus,
  removeFollower,
  requestFollow,
  unblockUser,
  unfollow,
} from "@/server/lib/follows";
import { displayName, otherNames } from "@/server/lib/format";
import { isOngoing, sortHistory, visibleHistory } from "@/server/lib/history";
import { industryLabel } from "@/server/lib/industries";
import { jobTypeLabel } from "@/server/lib/job-types";
import type {
  AcceptResult,
  DirectoryOptions,
  DirectoryPage,
  FollowLists,
  FollowResult,
  MemberCard,
  MemberProfile,
  Ok,
  RoleLine,
} from "@/server/lib/mobile/contract/people";
import {
  ApiError,
  invalid,
  type Locale,
  notFound,
} from "@/server/lib/mobile/http";
import { memberRef } from "@/server/lib/mobile/present";
import { followerFieldSet } from "@/server/lib/personal-fields";
import {
  type Audience,
  hiddenPersonalFields,
  isAudience,
  photoReach,
  previewAccess,
  seenBy,
} from "@/server/lib/profile-visibility";
import { AIS_DIVISIONS } from "@/server/lib/school";
import type { CurrentUser } from "@/server/lib/session";

/**
 * People for the native app: the directory (/app/directory), member
 * profiles (/app/members/[id]) and follows (/app/follows). Every rule comes
 * from the code the website pages use — searchDirectory / buildDirectoryWhere
 * for who is listed, getProfileForViewer for what of a member is shown,
 * photoFor for photos, src/lib/follows for follow buttons and changes — and
 * the presentation mirrors the pages and their components.
 */

// ---- Presentation (role facts, member cards) ----

type Translate = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

/** Translators and 学年 labels for server-composed text. */
export type Labels = {
  locale: Locale;
  /** "roles" namespace */
  tr: Translate;
  /** "profile" namespace */
  tp: Translate;
  /** cohort id → 第N期 */
  cohorts: Record<string, string>;
};

async function labelsFor(locale: Locale): Promise<Labels> {
  const [tr, tp, cohorts] = await Promise.all([
    getTranslatorFor(locale, "roles"),
    getTranslatorFor(locale, "profile"),
    cohortShortLabels(locale),
  ]);
  return { locale, tr, tp, cohorts };
}

type RoleRow = PublicCard["roles"][number];

/**
 * Public-tier facts for one role: 学年, years, grade, division, current
 * stage. Mirrors roleFacts() in src/components/profile/role-details.tsx
 * (not exported, and it reads the request's locale).
 */
export function roleFacts(r: RoleRow, withStage: boolean, l: Labels): string[] {
  const { tr, tp } = l;
  const facts: string[] = [];
  if (
    r.cohortId &&
    (r.role === RoleKey.CURRENT_STUDENT || r.role === RoleKey.FORMER_STUDENT)
  ) {
    const label = l.cohorts[r.cohortId];
    if (label) facts.push(label);
  }
  switch (r.role) {
    case RoleKey.TEACHER:
      facts.push(
        tr(
          `teacherStatusShort.${r.teacherStatus === "FORMER" ? "FORMER" : "CURRENT"}`,
        ),
      );
      if (r.yearsFrom !== null) {
        facts.push(
          r.yearsTo !== null
            ? tp("record.teacherYears", { from: r.yearsFrom, to: r.yearsTo })
            : tp("record.teacherYearsPresent", { from: r.yearsFrom }),
        );
      }
      break;
    case RoleKey.CURRENT_STUDENT:
      if (r.currentGrade !== null)
        facts.push(gradeLabel(r.currentGrade, l.locale));
      break;
    case RoleKey.FORMER_STUDENT:
      if (r.graduationOrLeaveYear !== null) {
        facts.push(
          r.didGraduate === false
            ? tp("record.left", { year: r.graduationOrLeaveYear })
            : tp("record.graduated", { year: r.graduationOrLeaveYear }),
        );
      }
      if (r.lastDivision) facts.push(tr(`division.${r.lastDivision}`));
      if (withStage && r.currentStage)
        facts.push(
          tp("record.nowStage", { stage: tr(`stage.${r.currentStage}`) }),
        );
      break;
    default:
      break;
  }
  return facts;
}

/** Role badges + facts for member cards (RoleSummary). */
export function roleLines(roles: readonly RoleRow[], l: Labels): RoleLine[] {
  return sortRoles(roles).map((r) => ({
    label: l.tr(roleLabelKey(r)),
    facts: roleFacts(r, true, l),
  }));
}

/**
 * A member card (src/components/directory/member-card.tsx). Callers pass
 * only members the viewer may see; showPhoto=false for blocked members.
 */
function memberCard(
  c: Connections,
  l: Labels,
  m: PublicCard,
  showPhoto = true,
): MemberCard {
  const ref = memberRef(c, m);
  return {
    ...ref,
    avatar: showPhoto ? ref.avatar : defaultAvatar(m.gender),
    nameAtAis: m.nameAtAis,
    roles: roleLines(m.roles, l),
  };
}

// ---- Directory (src/app/[locale]/app/(member)/directory/page.tsx) ----

/** One page of the directory for the website's ?q=&role=… parameters. */
export async function directoryPage(
  user: CurrentUser,
  params: Record<string, string>,
  locale: Locale,
): Promise<DirectoryPage> {
  const filters = parseDirectoryFilters(params);
  const viewer = toViewer(user);
  const [{ items, nextCursor }, total, c, l] = await Promise.all([
    searchDirectory(viewer, filters),
    // Total for 「32名」; same where-clause as the page query.
    blockedUserIds(viewer.id).then((blockedIds) =>
      db.user.count({
        where: buildDirectoryWhere(filters, {
          viewer,
          blockedIds,
          now: new Date(),
        }),
      }),
    ),
    loadConnections(user.id),
    labelsFor(locale),
  ]);
  return {
    items: items.map((m) => memberCard(c, l, m)),
    nextCursor,
    total,
    filters: {
      q: filters.q,
      role: filters.role ?? ALL_ROLES,
      from: filters.yearFrom,
      to: filters.yearTo,
      division: filters.division,
      stage: filters.stage,
      cohort: filters.cohort,
    },
    filtered: hasActiveFilters(filters),
  };
}

/** The filter form's choices (src/components/directory/filter-form.tsx). */
export async function directoryOptions(
  locale: Locale,
): Promise<DirectoryOptions> {
  const cohorts = await loadCohortOptions(locale);
  return {
    roles: [...MEMBER_FILTER_OPTIONS],
    defaultRole: DEFAULT_DIRECTORY_ROLE,
    allRoles: ALL_ROLES,
    divisions: [...AIS_DIVISIONS],
    stages: Object.values(LifeStage),
    cohorts: cohorts.map((o) => ({ id: o.id, label: o.label })),
    minYear: MIN_YEAR,
    maxYear: MAX_YEAR,
  };
}

// ---- Member profile (src/app/[locale]/app/(member)/members/[id]/page.tsx) ----

/** My own profile as an audience would see it (the page's previewView). */
function previewView(me: CurrentUser, as: Audience): ProfileView {
  const shared = followerFieldSet(me.followerFields);
  return {
    public: projectPublic(me),
    private: projectPrivate(me, previewAccess(as)),
    access: previewAccess(as),
    hiddenFields: hiddenPersonalFields(previewAccess(as), shared),
    sharesWithFollowers: shared.size > 0,
    relationship: {
      follow: as === "followers" ? FollowStatus.ACCEPTED : null,
      blocked: false,
    },
    isSelf: false,
  };
}

/** As formatBirthDate() in src/components/profile/birth-date-card.tsx. */
function formatBirthDate(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

type Years = { startYear: number | null; endYear: number | null };

/** "2019–2022" / "2022–現在" (src/components/history/history-list.tsx). */
export function historyYears(e: Years, present: string): string {
  return `${e.startYear ?? ""}–${isOngoing(e) && e.endYear === null ? present : (e.endYear ?? "")}`;
}

/**
 * Why personal fields are hidden (the page's 「非公開の情報」 alert), or
 * null when the viewer sees them.
 */
export function lockedReason(
  hasPrivate: boolean,
  sharesWithFollowers: boolean,
  follow: FollowUiState | null,
  canRequest: boolean,
  preview: boolean,
): MemberProfile["contact"]["locked"] {
  if (hasPrivate) return null;
  if (!sharesWithFollowers) return "familyOnly";
  if (follow === "requested") return "requested";
  return canRequest || preview ? "body" : "unavailable";
}

/**
 * A member's profile as the viewer may see it — exactly what the page shows,
 * under the page's conditions. `as` previews my own profile.
 */
export async function memberProfile(
  me: CurrentUser,
  id: string,
  as: string | undefined,
  locale: Locale,
): Promise<MemberProfile> {
  // My own profile (with its edit buttons) is the profile tab; here only
  // as a preview of what members / followers / family see.
  const preview = id === me.id && isAudience(as) ? as : null;
  if (id === me.id && !preview) throw new ApiError(409, "self");
  const view = preview
    ? previewView(me, preview)
    : await getProfileForViewer(me, id);
  if (!view) throw notFound();

  // 学歴・職歴: "followers only" entries need follower or family access.
  const [education, work] = await Promise.all([
    db.educationEntry.findMany({
      where: { userId: id },
      include: { school: true },
    }),
    db.workEntry.findMany({
      where: { userId: id },
      include: { company: true },
    }),
  ]);
  const shownEducation = visibleHistory(education, view.access !== "none");
  const shownWork = visibleHistory(work, view.access !== "none");
  const hiddenHistory =
    education.length + work.length - shownEducation.length - shownWork.length;

  // Non-private columns needed to decide which relationship controls to show.
  const [counts, theirFollow] = await Promise.all([
    loadFollowCounts(id),
    view.isSelf || preview ? null : loadFollowStatus(id, me.id),
  ]);
  const [targetMeta, myBlock] =
    view.isSelf || preview
      ? [null, null]
      : await Promise.all([
          db.user.findUnique({
            where: { id },
            select: {
              id: true,
              state: true,
              familyId: true,
              dateOfBirth: true,
              managedById: true,
              roles: { select: { role: true } },
            },
          }),
          db.block.findUnique({
            where: { blockerId_blockedId: { blockerId: me.id, blockedId: id } },
            select: { id: true },
          }),
        ]);
  if (!view.isSelf && !preview && !targetMeta) throw notFound();
  const birthDate = view.isSelf ? me.dateOfBirth : targetMeta?.dateOfBirth;
  // 1:1 talk with mutual followers (like LINE friends).
  const canMessage =
    !view.isSelf && !preview && (await directChatDenial(me.id, id)) === null;

  const family = preview
    ? preview === "family"
    : targetMeta
      ? sameFamily(me, targetMeta)
      : false;
  let followState: FollowUiState | null = null;
  if (targetMeta && !family && !myBlock) {
    const rel = view.relationship;
    const { managedById, ...meta } = targetMeta;
    const check = canRequestFollow(
      toViewer(me),
      {
        ...meta,
        managed: managedById !== null,
        roles: targetMeta.roles.map((r) => r.role),
      },
      rel,
    );
    followState = followButtonState(rel.follow, theirFollow, check.ok);
  }
  const canRequest = followState === "none" || followState === "followBack";

  const p = view.public;
  const former = p.roles.find((r) => r.role === RoleKey.FORMER_STUDENT);
  const photoShown = preview
    ? seenBy(photoReach(p.avatarPublic), preview)
    : photoVisible(await loadConnections(me.id), {
        ...p,
        familyId: targetMeta?.familyId ?? null,
      });
  const priv = view.private;
  const social = priv ? parseSocialLinks(priv.socialLinks) : {};
  // Date of birth: only the member themselves and admins.
  const showBirthDate = view.isSelf || (me.isAdmin && !preview);

  const [l, th] = await Promise.all([
    labelsFor(locale),
    getTranslatorFor(locale, "history"),
  ]);
  const years = (e: Years) => historyYears(e, th("present"));

  return {
    id: p.id,
    name: displayName(p),
    otherName: otherNames(p),
    nameAtAis: p.nameAtAis,
    avatar:
      (photoShown ? storedAvatarUrl(p.avatarUrl) : null) ??
      defaultAvatar(p.gender),
    photoHidden: !photoShown && Boolean(p.avatarUrl),
    roles: p.roles.map((r) => l.tr(roleLabelKey(r))),
    bio: p.bio,
    record: sortRoles(p.roles).map((r) => {
      const facts = roleFacts(r, false, l);
      return {
        label: l.tr(roleLabelKey(r)),
        details: facts.length ? facts.join(" · ") : l.tp("record.noDetails"),
        subjects:
          r.role === RoleKey.TEACHER && r.subjects
            ? l.tp("record.subjects", { subjects: r.subjects })
            : null,
      };
    }),
    currentStage: former
      ? {
          label: former.currentStage
            ? l.tr(`stage.${former.currentStage}`)
            : null,
          detail: priv?.currentStageDetail ?? null,
        }
      : null,
    history:
      education.length || work.length
        ? {
            education: sortHistory(shownEducation).map((e) => ({
              id: e.id,
              school: e.school.name,
              level: th(`levels.${e.level}`),
              field: e.field,
              years: years(e),
            })),
            work: sortHistory(shownWork).map((e) => ({
              id: e.id,
              company: e.company.name,
              title: e.title,
              industry: industryLabel(e.industry, locale),
              jobType: jobTypeLabel(e.jobType, locale),
              years: years(e),
            })),
            hiddenCount: hiddenHistory,
          }
        : null,
    counts,
    relationship: {
      family,
      followsYou: !view.isSelf && followsMe(theirFollow),
      follow: followState,
      canRequest,
      blockedByMe: Boolean(myBlock),
      // The page renders it inside the follow / unblock row.
      canMessage: canMessage && Boolean(followState || myBlock),
      menu: !view.isSelf && !preview && !myBlock,
    },
    contact: {
      access: view.access,
      birthDate: showBirthDate
        ? { value: birthDate ? formatBirthDate(birthDate, locale) : null }
        : null,
      email: priv?.email ?? null,
      phone: priv?.phone ?? null,
      lineDisplayName: priv?.lineDisplayName ?? null,
      social: SOCIAL_KEYS.flatMap((key) => {
        const url = social[key];
        return url ? [{ key, url }] : [];
      }),
      locked: lockedReason(
        priv !== null,
        view.sharesWithFollowers,
        followState,
        canRequest,
        preview !== null,
      ),
      // Named rather than silently left out (no values: only which fields).
      hidden: [...(showBirthDate ? [] : ["birthDate"]), ...view.hiddenFields],
    },
    preview,
  };
}

// ---- Follow / block (the actions in src/app/actions/follows.ts) ----
// The actions end in refresh() / redirect(), which only work in server
// actions, so the routes call the same src/lib/follows functions they do.

const FOLLOW_ERROR_STATUS: Record<string, number> = {
  notFound: 404,
  already: 409,
  rateLimited: 429,
};

/** 「フォローする」 / 「フォローバック」 (requestFollowAction). */
export async function followMember(
  me: CurrentUser,
  targetId: string,
): Promise<FollowResult> {
  const res = await requestFollow(me, targetId);
  if (!res.ok)
    throw new ApiError(FOLLOW_ERROR_STATUS[res.reason] ?? 403, res.reason);
  return {
    status: res.status === FollowStatus.ACCEPTED ? "ACCEPTED" : "REQUESTED",
  };
}

/** Unfollow, or cancel my pending request (unfollowAction). */
export async function unfollowMember(
  me: CurrentUser,
  targetId: string,
): Promise<Ok> {
  await unfollow(me, targetId);
  return { ok: true };
}

/** Block (blockAction); drops follows both ways. */
export async function blockMember(
  me: CurrentUser,
  targetId: string,
): Promise<Ok> {
  if (targetId === me.id) throw invalid("self");
  if (!(await blockUser(me, targetId))) throw notFound();
  return { ok: true };
}

export async function unblockMember(
  me: CurrentUser,
  targetId: string,
): Promise<Ok> {
  await unblockUser(me, targetId);
  return { ok: true };
}

// ---- Follows (src/app/[locale]/app/(member)/follows/page.tsx) ----

/** Requests, followers, following and blocked members, as on the page. */
export async function followLists(
  me: CurrentUser,
  acceptedId: string | null,
  locale: Locale,
): Promise<FollowLists> {
  const lists = await loadFollowLists(me.id);
  const accepted = acceptedId
    ? await loadAcceptedFollower(me.id, acceptedId.slice(0, 64))
    : null;
  // Follow-back buttons: followers I don't follow (yet), and the request I
  // just accepted.
  const [states, c, l] = await Promise.all([
    loadFollowButtonStates(me, [
      ...lists.followers.map((f) => f.follower.id),
      ...(accepted ? [accepted.id] : []),
    ]),
    loadConnections(me.id),
    labelsFor(locale),
  ]);
  const card = (m: PublicCard) => memberCard(c, l, m);
  return {
    incoming: lists.incoming.map((f) => ({
      followId: f.id,
      requestedAt: f.createdAt.toISOString(),
      member: card(f.follower),
    })),
    outgoing: lists.outgoing.map((f) => ({
      followId: f.id,
      requestedAt: f.createdAt.toISOString(),
      member: card(f.followee),
    })),
    followers: lists.followers.map((f) => ({
      followId: f.id,
      member: card(f.follower),
      followState: states.get(f.follower.id) ?? null,
    })),
    following: lists.following.map((f) => ({
      followId: f.id,
      member: card(f.followee),
    })),
    // Blocked members' profiles are hidden, so no photo (and no link).
    blocked: lists.blocked.map((b) => ({
      blockId: b.id,
      member: memberCard(c, l, b.blocked, false),
    })),
    accepted: accepted
      ? { member: card(accepted), followState: states.get(accepted.id) ?? null }
      : null,
  };
}

/** 「承認」 (acceptFollowAction). */
export async function acceptRequest(
  me: CurrentUser,
  followId: string,
): Promise<AcceptResult> {
  return { accepted: await acceptFollow(me, followId) };
}

/** 「拒否」 (declineFollowAction). */
export async function declineRequest(
  me: CurrentUser,
  followId: string,
): Promise<Ok> {
  await declineFollow(me, followId);
  return { ok: true };
}

/** 「削除」 on a follower (removeFollowerAction). */
export async function removeMyFollower(
  me: CurrentUser,
  followerId: string,
): Promise<Ok> {
  await removeFollower(me, followerId);
  return { ok: true };
}
