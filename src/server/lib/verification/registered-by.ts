import type { ParentRegistration } from "@contract/admin";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";

/**
 * 「保護者が登録」 for the committee: a student account a parent created at
 * sign-up. While the parent manages it, User.managedBy says who; after the
 * handover (managedById cleared) the child's application still names the
 * parent (answers.registeredByParentId, parent-onboarding.ts).
 */

type Person = {
  id: string;
  nameRomaji: string | null;
  nameKanji: string | null;
};

export type RegisteredByInput = {
  userId: string;
  managedBy: Person | null;
  /** VerificationRequest.answers (null: no application) */
  answers: unknown;
};

export const MANAGED_BY_SELECT = {
  select: { id: true, nameRomaji: true, nameKanji: true },
} as const;

function registeredByParentId(answers: unknown): string | null {
  if (!answers || typeof answers !== "object" || Array.isArray(answers))
    return null;
  const id = (answers as Record<string, unknown>).registeredByParentId;
  return typeof id === "string" && id ? id : null;
}

/** userId → who registered them (only those a parent registered). */
export async function parentRegistrations(
  rows: readonly RegisteredByInput[],
  locale: "ja" | "en",
): Promise<Map<string, ParentRegistration>> {
  const out = new Map<string, ParentRegistration>();
  const handedOver = new Map<string, string>();
  for (const r of rows) {
    if (r.managedBy)
      out.set(r.userId, {
        parentId: r.managedBy.id,
        parentName: displayName(r.managedBy, locale),
        managed: true,
      });
    else {
      const parentId = registeredByParentId(r.answers);
      if (parentId) handedOver.set(r.userId, parentId);
    }
  }
  if (handedOver.size) {
    const parents = await db.user.findMany({
      where: { id: { in: [...new Set(handedOver.values())] } },
      select: { id: true, nameRomaji: true, nameKanji: true },
    });
    const byId = new Map(parents.map((p) => [p.id, p]));
    for (const [userId, parentId] of handedOver) {
      const p = byId.get(parentId);
      if (p)
        out.set(userId, {
          parentId,
          parentName: displayName(p, locale),
          managed: false,
        });
    }
  }
  return out;
}
