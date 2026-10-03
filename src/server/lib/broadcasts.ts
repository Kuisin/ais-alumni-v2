import { cache } from "react";
import type { Prisma } from "@/server/generated/prisma/client";
import { AccountState, RoleKey } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { membersInAudiences, rolesForAudiences } from "@/server/lib/audience";
import { audit } from "@/server/lib/audit";
import { blockedUserIds, isCurrentTeacher } from "@/server/lib/authz";
import { db } from "@/server/lib/db";
import { MESSAGES_ENABLED } from "@/server/lib/features";
import { displayName } from "@/server/lib/format";
import { markdownToLines } from "@/server/lib/markdown";
import {
  estimateLinePushes,
  NOTIFY_USER_SELECT,
  notifyMany,
} from "@/server/lib/notify";
import {
  type Audience,
  type BroadcastRight,
  broadcastRights,
  canApproveNews,
  type Holder,
  type NewsScope,
  newsScope,
  type StaffAccess,
  staffAccess,
} from "@/server/lib/permissions";
import type { CurrentUser } from "@/server/lib/session";

/** The member's roles and positions, loaded once per request. */
const loadHolder = cache(async (user: CurrentUser): Promise<Holder> => {
  const positions = await db.userPosition.findMany({
    where: { userId: user.id },
    select: { position: true, cohortId: true },
  });
  return {
    state: user.state,
    isAdmin: user.isAdmin,
    roles: user.roles.map((r) => r.role),
    currentTeacher: isCurrentTeacher(user.roles),
    positions,
  };
});

/** The signed-in member's notification rights (loads their positions). */
export async function getBroadcastRights(
  user: CurrentUser,
): Promise<BroadcastRight[]> {
  return broadcastRights(await loadHolder(user));
}

/** Who the member may send ニュース posts to (null = may not post). */
export async function getNewsScope(
  user: CurrentUser,
): Promise<NewsScope | null> {
  return newsScope(await loadHolder(user));
}

/** Whether the member may approve 同窓会委員 ニュース posts (not their own). */
export async function getNewsApprover(user: CurrentUser): Promise<boolean> {
  return canApproveNews(await loadHolder(user));
}

/** Which admin-mode pages the member may open. */
export async function getStaffAccess(user: CurrentUser): Promise<StaffAccess> {
  const access = staffAccess(await loadHolder(user));
  // The send page is hidden while messages are switched off.
  return MESSAGES_ENABLED ? access : { ...access, broadcast: false };
}

/**
 * ACTIVE members in the audience, excluding anyone who has blocked (or been
 * blocked by) the sender. The sender is included when they match the
 * audience, like everyone else. A 学年 (COHORT) audience is the current and
 * former students who selected that class.
 */
export async function recipientsWhere(
  senderId: string,
  audience: Audience,
): Promise<Prisma.UserWhereInput> {
  const blocked = await blockedUserIds(senderId);
  const base: Prisma.UserWhereInput = {
    state: AccountState.ACTIVE,
    ...(blocked.length ? { id: { notIn: blocked } } : {}),
  };
  if (audience.scope === "ALL") {
    return { ...base, ...membersInAudiences(audience.audiences) };
  }
  return {
    ...base,
    roles: {
      some: {
        role: { in: [RoleKey.FORMER_STUDENT, RoleKey.CURRENT_STUDENT] },
        cohortId: audience.cohortId,
      },
    },
  };
}

export type BroadcastPreview = {
  recipients: number;
  line: number;
  email: number;
};

export async function previewBroadcast(
  senderId: string,
  audience: Audience,
): Promise<BroadcastPreview> {
  const users = await db.user.findMany({
    where: await recipientsWhere(senderId, audience),
    select: NOTIFY_USER_SELECT,
  });
  return {
    recipients: users.length,
    ...estimateLinePushes(users, "BROADCAST"),
  };
}

/** Record the broadcast and deliver it (LINE multicast or email per member). */
export async function sendBroadcast(params: {
  sender: CurrentUser;
  right: BroadcastRight;
  audience: Audience;
  title: string;
  body: string;
}): Promise<BroadcastPreview & { id: string }> {
  const { sender, right, audience, title, body } = params;
  const users = await db.user.findMany({
    where: await recipientsWhere(sender.id, audience),
    select: NOTIFY_USER_SELECT,
  });
  const counts = estimateLinePushes(users, "BROADCAST");
  const broadcast = await db.broadcast.create({
    data: {
      senderId: sender.id,
      position: right.position,
      scope: audience.scope,
      targetAudiences: audience.scope === "ALL" ? audience.audiences : [],
      // Legacy column for older code.
      targetRoles:
        audience.scope === "ALL" ? rolesForAudiences(audience.audiences) : [],
      cohortId: audience.scope === "COHORT" ? audience.cohortId : null,
      title,
      body,
      recipientCount: users.length,
      lineCount: counts.line,
      emailCount: counts.email,
    },
  });
  // Inbox rows: the message is read in the app (read receipts).
  await db.broadcastRecipient.createMany({
    data: users.map((u) => ({ broadcastId: broadcast.id, userId: u.id })),
    skipDuplicates: true,
  });
  await audit(
    sender.id,
    "broadcast.sent",
    { type: "Broadcast", id: broadcast.id },
    {
      position: right.position,
      audience: audience as unknown as Prisma.InputJsonValue,
      recipients: users.length,
    },
  );
  await notifyMany(users, {
    kind: "BROADCAST",
    refId: broadcast.id,
    dedupe: true,
    // Its subject and text go with it; opening it in the app records that
    // they read it.
    path: `/app/news/messages/${broadcast.id}`,
    content: markdownToLines(body),
    params: async (locale) => {
      const t = await getTranslatorFor(locale, "broadcast");
      return {
        subject: title,
        from: right.position
          ? t("fromPosition", {
              name: displayName(sender, locale),
              position: t(`positions.${right.position}`),
            })
          : t("fromCommittee"),
      };
    },
  });
  return { id: broadcast.id, recipients: users.length, ...counts };
}
