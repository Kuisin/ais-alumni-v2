import type { AdminCounts, AdminHome } from "@contract/admin";
import {
  ChangeRequestStatus,
  VerificationStatus,
} from "@/server/generated/prisma/enums";
import { getStaffAccess } from "@/server/lib/broadcasts";
import { db } from "@/server/lib/db";
import { forbidden } from "@/server/lib/mobile/http";
import { hasStaffAccess, type StaffAccess } from "@/server/lib/permissions";
import type { CurrentUser } from "@/server/lib/session";

/**
 * 管理モード's guards for the API, the same checks as the website's admin
 * layout (requireStaff) and (committee) layout (requireAdmin); mobileRoute
 * has already required an ACTIVE account.
 */
export async function staffOnly(user: CurrentUser): Promise<StaffAccess> {
  const access = await getStaffAccess(user);
  if (!hasStaffAccess(access)) throw forbidden();
  return access;
}

/** Committee admins (requireAdmin / actionAdmin). */
export function adminOnly(user: CurrentUser): void {
  if (!user.isAdmin) throw forbidden();
}

const NONE: AdminCounts = {
  verification: 0,
  recordRequests: 0,
  nameRequests: 0,
  support: 0,
  chat: 0,
};

/**
 * Parent-only applications (followsChildren) are approved with a child, so
 * they don't count — unless nothing will settle them: none of the linked
 * children has an open application of its own, or they've waited a week.
 */
function stuckParentWhere(now: Date) {
  return {
    followsChildren: true,
    OR: [
      { submittedAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } },
      {
        user: {
          parentLinks: {
            none: {
              child: {
                is: {
                  verification: {
                    is: {
                      status: {
                        in: [
                          VerificationStatus.PENDING,
                          VerificationStatus.NEEDS_INFO,
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  };
}

/** The admin sidebar's badges (src/components/layout/app-shell.tsx). */
export async function adminHome(user: CurrentUser): Promise<AdminHome> {
  const access = await staffOnly(user);
  if (!access.admin) return { counts: NONE };
  const pending = { status: ChangeRequestStatus.PENDING };
  const [verification, records, names, births, genders, support, chat] =
    await Promise.all([
      db.verificationRequest.count({
        where: {
          status: VerificationStatus.PENDING,
          OR: [{ followsChildren: false }, stuckParentWhere(new Date())],
        },
      }),
      db.recordChangeRequest.count({ where: pending }),
      db.nameChangeRequest.count({ where: pending }),
      db.birthDateRequest.count({ where: pending }),
      db.genderRequest.count({ where: pending }),
      db.supportRequest.count({ where: { closedAt: null } }),
      db.chatReport.count({ where: { closedAt: null } }),
    ]);
  return {
    counts: {
      verification,
      recordRequests: records,
      nameRequests: names + births + genders,
      support,
      chat,
    },
  };
}
