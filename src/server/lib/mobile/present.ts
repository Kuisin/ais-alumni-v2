import { AVATAR_SELECT, type Connections, photoFor } from "@/server/lib/avatar";
import { displayName, otherNames } from "@/server/lib/format";
import type { MemberRef } from "@/server/lib/mobile/contract/core";

/**
 * Shapes shared by the mobile API's responses. Photos go through
 * photoFor() — the same visibility rule as the website (src/lib/avatar.ts).
 */

/** Columns memberRef() needs (add to member selects). */
export const MEMBER_REF_SELECT = {
  ...AVATAR_SELECT,
  nameRomaji: true,
  nameKanji: true,
  nameKana: true,
} as const;

export type MemberRefRow = {
  id: string;
  avatarUrl: string | null;
  avatarPublic?: boolean;
  familyId?: string | null;
  gender?: string | null;
  nameRomaji: string | null;
  nameKanji: string | null;
  nameKana?: string | null;
};

export function memberRef(c: Connections, u: MemberRefRow): MemberRef {
  return {
    id: u.id,
    name: displayName(u),
    otherName: otherNames(u),
    avatar: photoFor(c, u),
  };
}

/** Date → ISO string, keeping null. */
export function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}
