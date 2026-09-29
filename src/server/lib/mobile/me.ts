import { AccountState, FollowStatus } from "@/server/generated/prisma/enums";
import { unreadCounts } from "@/server/lib/announcements";
import { defaultAvatar, storedAvatarUrl } from "@/server/lib/avatar";
import { getStaffAccess } from "@/server/lib/broadcasts";
import { chatUnreadTotal } from "@/server/lib/chat-db";
import { db } from "@/server/lib/db";
import { MESSAGES_ENABLED } from "@/server/lib/features";
import { displayName, otherNames } from "@/server/lib/format";
import type { Me, StaffAccess } from "@/server/lib/mobile/contract/core";
import { inboxUnread } from "@/server/lib/mobile/notifications";
import { channelTopic, realtimePublic } from "@/server/lib/realtime";
import type { CurrentUser } from "@/server/lib/session";
import { homePathFor } from "@/server/lib/state-machine";

const NO_ACCESS: StaffAccess = {
  admin: false,
  broadcast: false,
  teachers: false,
  news: false,
};

/**
 * Who is signed in, what they may open, and the tab-bar badges — the same
 * counts and realtime channels as the website's app shell
 * (src/components/layout/app-shell.tsx).
 */
export async function meFor(user: CurrentUser): Promise<Me> {
  const active = user.state === AccountState.ACTIVE;
  const [access, unread, chat, follows, groups, inbox] = active
    ? await Promise.all([
        getStaffAccess(user),
        unreadCounts(user),
        chatUnreadTotal(user.id),
        db.follow.count({
          where: { followeeId: user.id, status: FollowStatus.REQUESTED },
        }),
        db.chatMember.findMany({
          where: { userId: user.id },
          select: { groupId: true },
        }),
        inboxUnread(user.id),
      ])
    : [NO_ACCESS, { news: 0, messages: 0 }, 0, 0, [], 0];
  const pub = active ? realtimePublic() : null;
  return {
    user: {
      id: user.id,
      state: user.state,
      locale: user.locale === "en" ? "en" : "ja",
      isAdmin: user.isAdmin,
      name: displayName(user),
      otherName: otherNames(user),
      email: user.primaryEmail,
      // Their own photo: always visible to themselves.
      avatar: storedAvatarUrl(user.avatarUrl) ?? defaultAvatar(user.gender),
      lineLinked: Boolean(user.lineUserId),
    },
    onboardingPath: active ? null : homePathFor(user),
    access,
    badges: { ...unread, chat, follows, inbox },
    realtime: pub
      ? {
          ...pub,
          topics: [
            channelTopic("user", user.id),
            ...groups.map((g) => channelTopic("chat", g.groupId)),
          ],
        }
      : null,
    features: { messages: MESSAGES_ENABLED },
  };
}
