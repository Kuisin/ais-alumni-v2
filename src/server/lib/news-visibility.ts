import { cache } from "react";
import { RoleKey } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { publishedWhere } from "@/server/lib/news";
import {
  type AudienceViewer,
  adminOnlyView,
  matchesAudience,
  specFromPost,
} from "@/server/lib/news-audience";
import type { CurrentUser } from "@/server/lib/session";

/** The member as the ニュース audience rules see them (incl. children's 学年). */
export const newsViewer = cache(
  async (user: CurrentUser): Promise<AudienceViewer> => {
    const links = await db.familyLink.findMany({
      where: { parentId: user.id },
      select: {
        childCohortId: true,
        child: {
          select: {
            roles: {
              where: {
                role: { in: [RoleKey.CURRENT_STUDENT, RoleKey.FORMER_STUDENT] },
              },
              select: { cohortId: true },
            },
          },
        },
      },
    });
    const childCohortIds = new Set<string>();
    for (const l of links) {
      if (l.childCohortId) childCohortIds.add(l.childCohortId);
      for (const r of l.child?.roles ?? [])
        if (r.cohortId) childCohortIds.add(r.cohortId);
    }
    return {
      id: user.id,
      isAdmin: user.isAdmin,
      roles: user.roles,
      childCohortIds: [...childCohortIds],
    };
  },
);

/**
 * Published ニュース the member may see, newest first (pinned on top). The
 * audience can include 学年 and individual members, so it's matched here
 * rather than in SQL; the number of posts is small.
 */
export const visibleNews = cache(
  async (user: CurrentUser, now: Date = new Date()) => {
    const viewer = await newsViewer(user);
    const posts = await db.newsPost.findMany({
      where: publishedWhere(now),
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 1000,
      select: {
        id: true,
        publishedAt: true,
        audience: true,
        targetAudiences: true,
        targetRoles: true,
      },
    });
    return posts
      .filter((p) => matchesAudience(specFromPost(p), viewer))
      .map((p) => ({
        ...p,
        adminView: adminOnlyView(specFromPost(p), viewer),
      }));
  },
);

type Targeted = {
  audience: unknown;
  targetAudiences: Parameters<typeof specFromPost>[0]["targetAudiences"];
  targetRoles: Parameters<typeof specFromPost>[0]["targetRoles"];
};

/** Keep the rows (news or events) the member is in the audience for. */
export async function filterByAudience<T extends Targeted>(
  user: CurrentUser,
  rows: readonly T[],
): Promise<T[]> {
  const viewer = await newsViewer(user);
  return rows.filter((r) => matchesAudience(specFromPost(r), viewer));
}

/** Whether the member is in the audience of one post or event. */
export async function inAudience(
  user: CurrentUser,
  row: Targeted,
): Promise<boolean> {
  return matchesAudience(specFromPost(row), await newsViewer(user));
}
