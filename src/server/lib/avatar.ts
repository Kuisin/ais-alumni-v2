import { cache } from "react";
import { FollowStatus } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { signedFileUrl } from "@/server/lib/storage";

/**
 * Profile photos. A member's photo is shown to themselves, admins, their
 * family and people they're connected with (an accepted follow either
 * way), and to someone they asked to follow while the request is open —
 * they reached out, so the person deciding sees who's asking; to every
 * member only if they turn on 「写真を全員に公開」 (User.avatarPublic). Everyone else — and members without a photo — get
 * the default icon for their gender.
 */

export { defaultAvatar, GENDERS, type Gender, isGender } from "./gender";

import { defaultAvatar } from "./gender";

/** Columns needed to decide what photo to show (add to member selects). */
export const AVATAR_SELECT = {
  id: true,
  avatarUrl: true,
  avatarPublic: true,
  familyId: true,
  gender: true,
} as const;

export type AvatarTarget = {
  id: string;
  avatarUrl: string | null;
  avatarPublic?: boolean;
  familyId?: string | null;
  gender?: string | null;
};

export type Connections = {
  viewerId: string;
  admin: boolean;
  familyId: string | null;
  /** accepted follows in either direction */
  connected: ReadonlySet<string>;
  /** members with an open follow request to the viewer */
  requesters: ReadonlySet<string>;
};

/** The viewer's family and follow connections (once per request). */
export const loadConnections = cache(
  async (viewerId: string): Promise<Connections> => {
    const [me, follows] = await Promise.all([
      db.user.findUnique({
        where: { id: viewerId },
        select: { isAdmin: true, familyId: true },
      }),
      db.follow.findMany({
        where: {
          OR: [
            {
              status: FollowStatus.ACCEPTED,
              OR: [{ followerId: viewerId }, { followeeId: viewerId }],
            },
            { status: FollowStatus.REQUESTED, followeeId: viewerId },
          ],
        },
        select: { followerId: true, followeeId: true, status: true },
      }),
    ]);
    return {
      viewerId,
      admin: me?.isAdmin ?? false,
      familyId: me?.familyId ?? null,
      connected: new Set(
        follows
          .filter((f) => f.status === FollowStatus.ACCEPTED)
          .map((f) =>
            f.followerId === viewerId ? f.followeeId : f.followerId,
          ),
      ),
      requesters: new Set(
        follows
          .filter((f) => f.status === FollowStatus.REQUESTED)
          .map((f) => f.followerId),
      ),
    };
  },
);

/** May the viewer see this member's own photo? */
export function photoVisible(c: Connections, t: AvatarTarget): boolean {
  if (t.id === c.viewerId || c.admin || t.avatarPublic) return true;
  if (c.familyId !== null && t.familyId === c.familyId) return true;
  return c.connected.has(t.id) || c.requesters.has(t.id);
}

/** Stored avatar value → URL (private storage key or absolute URL). */
export function storedAvatarUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return signedFileUrl(v);
}

/** The picture to show: their photo if allowed, else the default icon. */
export function photoFor(c: Connections, t: AvatarTarget): string {
  const own = photoVisible(c, t) ? storedAvatarUrl(t.avatarUrl) : null;
  return own ?? defaultAvatar(t.gender);
}
