import { DirectChatRule, RoleKey } from "@/server/generated/prisma/enums";

/**
 * Who each member type may have 1:1 talks with (pure rules, unit-tested).
 * Admins change the rule per type (admin → チャット); a type without a saved
 * row uses DEFAULT_DIRECT_RULES:
 *  - 在校生: no 1:1 talks
 *  - 在校生保護者: no 1:1 talks
 *  - 卒業生保護者: only with other 卒業生保護者
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

/** Display / form order. */
export const DIRECT_RULE_ROLES: RoleKey[] = [
  RoleKey.TEACHER,
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

/** Every one of `a`'s types allows a talk with `b`. */
function sideAllows(
  a: readonly RoleKey[],
  b: readonly RoleKey[],
  rules: DirectRules,
): boolean {
  return a.every((role) => {
    const rule = rules[role];
    if (rule === DirectChatRule.NOBODY) return false;
    if (rule === DirectChatRule.SAME_ROLE) return b.includes(role);
    return true;
  });
}

/**
 * May these two members have a 1:1 talk? Both sides' types must allow it;
 * a member with several types gets the strictest combination (e.g. a
 * graduate who is also a current parent has no 1:1 talks).
 */
export function directAllowed(
  a: readonly RoleKey[],
  b: readonly RoleKey[],
  rules: DirectRules,
): boolean {
  return sideAllows(a, b, rules) && sideAllows(b, a, rules);
}

/** May the member have 1:1 talks with anyone at all? */
export function canHaveDirect(
  roles: readonly RoleKey[],
  rules: DirectRules,
): boolean {
  return !roles.some((r) => rules[r] === DirectChatRule.NOBODY);
}
