import { DirectChatRule, RoleKey } from "@/server/generated/prisma/enums";

/**
 * Who each member type may have 1:1 talks with (pure rules, unit-tested).
 * Admins change the rule per type (admin → チャット); a type without a saved
 * row uses DEFAULT_DIRECT_RULES:
 *  - 在校生: no 1:1 talks
 *  - 在校生保護者: no 1:1 talks
 *  - 卒業生保護者: only with other 卒業生保護者
 * 教職員 are fixed here, not by admins: a current teacher (現職) talks 1:1
 * with other current teachers and with former teachers (元教職員); a former
 * teacher only with current ones — never with students, parents,
 * graduates, or between two former teachers.
 * The usual rules (mutual followers, no block) apply on top.
 */

export type DirectRules = Record<RoleKey, DirectChatRule>;

export const DEFAULT_DIRECT_RULES: DirectRules = {
  [RoleKey.TEACHER]: DirectChatRule.ANYONE,
  [RoleKey.CURRENT_STUDENT]: DirectChatRule.NOBODY,
  [RoleKey.CURRENT_PARENT]: DirectChatRule.NOBODY,
  [RoleKey.FORMER_STUDENT]: DirectChatRule.ANYONE,
  [RoleKey.FORMER_PARENT]: DirectChatRule.SAME_ROLE,
};

/** Display / form order (教職員 are fixed: TEACHER_PAIRING). */
export const DIRECT_RULE_ROLES: RoleKey[] = [
  RoleKey.CURRENT_STUDENT,
  RoleKey.FORMER_STUDENT,
  RoleKey.CURRENT_PARENT,
  RoleKey.FORMER_PARENT,
];

export const DIRECT_RULE_VALUES: DirectChatRule[] = [
  DirectChatRule.ANYONE,
  DirectChatRule.SAME_ROLE,
  DirectChatRule.NOBODY,
];

/** Saved rows over the defaults. */
export function mergeDirectRules(
  rows: readonly { role: RoleKey; rule: DirectChatRule }[],
): DirectRules {
  const out = { ...DEFAULT_DIRECT_RULES };
  for (const r of rows) out[r.role] = r.rule;
  return out;
}

/** One side of a talk: their member types, and whether a teacher is 現職. */
export type DirectParty = {
  roles: readonly RoleKey[];
  /** has the TEACHER type with status 現職 (unset counts as current) */
  currentTeacher: boolean;
};

const isTeacher = (p: DirectParty) => p.roles.includes(RoleKey.TEACHER);

/** Every one of `a`'s other types allows a talk with `b` (TEACHER aside). */
function sideAllows(
  a: readonly RoleKey[],
  b: readonly RoleKey[],
  rules: DirectRules,
): boolean {
  return a.every((role) => {
    if (role === RoleKey.TEACHER) return true;
    const rule = rules[role];
    if (rule === DirectChatRule.NOBODY) return false;
    if (rule === DirectChatRule.SAME_ROLE) return b.includes(role);
    return true;
  });
}

/**
 * May these two members have a 1:1 talk? Both sides' types must allow it;
 * a member with several types gets the strictest combination (e.g. a
 * graduate who is also a current parent has no 1:1 talks). If either is a
 * teacher, both must be teachers, at least one of them current.
 */
export function directAllowed(
  a: DirectParty,
  b: DirectParty,
  rules: DirectRules,
): boolean {
  if (isTeacher(a) || isTeacher(b)) {
    if (!isTeacher(a) || !isTeacher(b)) return false;
    // Two former teachers: no. Current with current or former: yes.
    if (!a.currentTeacher && !b.currentTeacher) return false;
  }
  return (
    sideAllows(a.roles, b.roles, rules) && sideAllows(b.roles, a.roles, rules)
  );
}

/** May the member have 1:1 talks with anyone at all? */
export function canHaveDirect(party: DirectParty, rules: DirectRules): boolean {
  return !party.roles.some(
    (r) => r !== RoleKey.TEACHER && rules[r] === DirectChatRule.NOBODY,
  );
}
