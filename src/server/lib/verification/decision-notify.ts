import { db } from "@/server/lib/db";
import {
  NOTIFY_USER_SELECT,
  type NotifyUser,
  notify,
} from "@/server/lib/notify";
import type { ParentOutcome } from "@/server/lib/parent-onboarding";

export type Decision = "APPROVE" | "REJECT" | "NEEDS_INFO";

/** Tell an applicant the outcome of their application (always by email too). */
export async function notifyDecision(
  to: NotifyUser,
  requestId: string,
  decision: Decision,
  note: string | null,
): Promise<void> {
  try {
    await notify(to, {
      kind:
        decision === "APPROVE"
          ? "VERIFICATION_APPROVED"
          : decision === "REJECT"
            ? "VERIFICATION_REJECTED"
            : "VERIFICATION_NEEDS_INFO",
      refId: requestId,
      path:
        decision === "APPROVE"
          ? "/app/dashboard"
          : decision === "REJECT"
            ? "/app/onboarding/status"
            : "/app/onboarding/verify",
      // The committee's note goes by email only, never on LINE.
      note,
    });
  } catch (e) {
    console.error("[verification] notify failed", e);
  }
}

/** Parents whose application followed a child's decision. */
export async function notifyParentOutcomes(
  outcomes: readonly ParentOutcome[],
): Promise<void> {
  for (const o of outcomes) {
    const parent = await db.user.findUnique({
      where: { id: o.parentId },
      select: NOTIFY_USER_SELECT,
    });
    if (parent) await notifyDecision(parent, o.requestId, o.decision, o.note);
  }
}
