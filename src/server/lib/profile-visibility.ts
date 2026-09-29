import { HistoryVisibility } from "@/server/generated/prisma/enums";
import type { PrivateAccess } from "@/server/lib/authz/core";
import {
  PERSONAL_FIELDS,
  type PersonalField,
} from "@/server/lib/personal-fields";

/**
 * Who sees each part of a profile, for the member's own view (「公開範囲」
 * tags) and the 「〇〇として見る」 preview. The audiences are nested: family
 * see everything followers see, followers everything members see. Admins
 * see everything. Mirrors privateAccess / projectPrivate (src/lib/authz),
 * photoVisible (src/lib/avatar) and visibleHistory (src/lib/history).
 */
export const AUDIENCES = ["members", "followers", "family"] as const;

export type Audience = (typeof AUDIENCES)[number];

/** The smallest audience that sees a field; "self" = only you (and admins). */
export type Reach = Audience | "self";

export function isAudience(v: unknown): v is Audience {
  return (AUDIENCES as readonly unknown[]).includes(v);
}

const RANK: Record<Reach, number> = {
  members: 0,
  followers: 1,
  family: 2,
  self: 3,
};

/** Does this audience see a field with this reach? */
export function seenBy(reach: Reach, audience: Audience): boolean {
  return RANK[audience] >= RANK[reach];
}

/** Personal fields: family always; followers only if shared. */
export function personalReach(
  field: PersonalField,
  shared: ReadonlySet<PersonalField>,
): Reach {
  return shared.has(field) ? "followers" : "family";
}

/** Photo: everyone if public, otherwise family and follow connections. */
export function photoReach(avatarPublic: boolean): Reach {
  return avatarPublic ? "members" : "followers";
}

export function historyReach(v: HistoryVisibility): Reach {
  return v === HistoryVisibility.MEMBERS ? "members" : "followers";
}

/** The personal-field access a preview audience gets. */
export function previewAccess(audience: Audience): PrivateAccess {
  if (audience === "family") return "all";
  return audience === "followers" ? "followers" : "none";
}

/** Personal fields this access level does not show (in display order). */
export function hiddenPersonalFields(
  access: PrivateAccess,
  shared: ReadonlySet<PersonalField>,
): PersonalField[] {
  if (access === "all") return [];
  if (access === "none") return [...PERSONAL_FIELDS];
  return PERSONAL_FIELDS.filter((f) => !shared.has(f));
}
