import {
  ChatGroupKind,
  PositionKey,
  RoleKey,
} from "@/server/generated/prisma/enums";
import { AVATAR_SELECT } from "@/server/lib/avatar";
import { GROUP_SELECT } from "@/server/lib/chat-db";
import { db } from "@/server/lib/db";

/** The talk visible to the viewer: a member, or an admin (groups only). */
export async function loadChatGroup(
  id: string,
  viewer: { id: string; isAdmin: boolean },
) {
  if (id.length > 64) return null;
  const [group, me] = await Promise.all([
    db.chatGroup.findUnique({
      where: { id },
      select: {
        ...GROUP_SELECT,
        members: {
          orderBy: { user: { nameRomaji: "asc" } },
          // Everyone in the group, for the member list and @mentions (a
          // whole year group of graduates can pass 500).
          take: 2000,
          select: {
            user: {
              select: {
                nameRomaji: true,
                nameKanji: true,
                nameKana: true,
                ...AVATAR_SELECT,
                roles: {
                  where: {
                    role: {
                      in: [RoleKey.CURRENT_STUDENT, RoleKey.FORMER_STUDENT],
                    },
                    cohortId: { not: null },
                  },
                  select: { cohort: { select: { number: true } } },
                  take: 1,
                },
                positions: {
                  where: { position: PositionKey.STUDENT_LEADER },
                  select: { id: true },
                },
              },
            },
          },
        },
        _count: { select: { members: true } },
      },
    }),
    db.chatMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: viewer.id } },
      select: { lastReadAt: true, muted: true, pushAll: true },
    }),
  ]);
  if (!group) return null;
  const direct = group.kind === ChatGroupKind.DIRECT;
  // Nobody but the two people may open a 1:1 talk.
  if (!me && (direct || !viewer.isAdmin)) return null;
  return { group, me, direct };
}
