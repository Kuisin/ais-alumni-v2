import { AccountState } from "@/server/generated/prisma/enums";

/**
 * Account lifecycle (§3.3).
 *
 *   UNVERIFIED_EMAIL → EMAIL_VERIFIED → PENDING_REVIEW → ACTIVE
 *                                                      ↘ REJECTED
 *                                                      ↘ NEEDS_INFO → PENDING_REVIEW
 *   ACTIVE → DEACTIVATED
 *
 * Assumption (not in spec): an admin may reactivate a DEACTIVATED account.
 */
const TRANSITIONS: Record<AccountState, readonly AccountState[]> = {
  UNVERIFIED_EMAIL: [AccountState.EMAIL_VERIFIED],
  EMAIL_VERIFIED: [AccountState.PENDING_REVIEW],
  PENDING_REVIEW: [
    AccountState.ACTIVE,
    AccountState.REJECTED,
    AccountState.NEEDS_INFO,
  ],
  NEEDS_INFO: [AccountState.PENDING_REVIEW],
  ACTIVE: [AccountState.DEACTIVATED],
  REJECTED: [],
  DEACTIVATED: [AccountState.ACTIVE],
};

export function canTransition(from: AccountState, to: AccountState): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: AccountState,
    readonly to: AccountState,
  ) {
    super(`Invalid account state transition ${from} → ${to}`);
  }
}

export function assertTransition(from: AccountState, to: AccountState): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isActive(state: AccountState): boolean {
  return state === AccountState.ACTIVE;
}

/**
 * Where a signed-in user belongs given their state. Non-ACTIVE users only see
 * their own onboarding screens (§3.3). Paths are locale-relative.
 */
export function homePathFor(user: {
  state: AccountState;
  lineOnboardingSeenAt: Date | null;
}): string {
  switch (user.state) {
    case AccountState.UNVERIFIED_EMAIL:
      return "/app/onboarding/email";
    case AccountState.EMAIL_VERIFIED:
      return user.lineOnboardingSeenAt
        ? "/app/onboarding/verify"
        : "/app/onboarding/line";
    case AccountState.NEEDS_INFO:
      return "/app/onboarding/verify";
    case AccountState.PENDING_REVIEW:
    case AccountState.REJECTED:
    case AccountState.DEACTIVATED:
      return "/app/onboarding/status";
    case AccountState.ACTIVE:
      return "/app/dashboard";
  }
}
