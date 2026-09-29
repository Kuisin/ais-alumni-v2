import type { AdminStats } from "@contract/admin-manage";
import { getTranslations } from "next-intl/server";
import {
  AccountState,
  LifeStage,
  RoleKey,
} from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";

/** 統計 (the website's /app/admin/stats; the caller checks admin). */
export async function loadAdminStats(): Promise<AdminStats> {
  const t = await getTranslations("adminStats");
  const tr = await getTranslations("roles");
  const active = { user: { state: AccountState.ACTIVE } } as const;
  const former = { role: RoleKey.FORMER_STUDENT, ...active } as const;

  const [
    byState,
    byRole,
    byYear,
    byStage,
    activeCount,
    lineLinked,
    lineFollowing,
    byGraduated,
  ] = await Promise.all([
    db.user.groupBy({ by: ["state"], _count: { _all: true } }),
    db.userRole.groupBy({
      by: ["role"],
      where: active,
      _count: { _all: true },
    }),
    db.userRole.groupBy({
      by: ["graduationOrLeaveYear"],
      where: former,
      _count: { _all: true },
      orderBy: { graduationOrLeaveYear: "asc" },
    }),
    db.userRole.groupBy({
      by: ["currentStage"],
      where: former,
      _count: { _all: true },
    }),
    db.user.count({ where: { state: AccountState.ACTIVE } }),
    db.user.count({
      where: { state: AccountState.ACTIVE, lineUserId: { not: null } },
    }),
    db.user.count({
      where: {
        state: AccountState.ACTIVE,
        lineUserId: { not: null },
        lineFollowing: true,
      },
    }),
    // 卒業生 / 元在校生 split of former students.
    db.userRole.groupBy({
      by: ["didGraduate"],
      where: former,
      _count: { _all: true },
    }),
  ]);
  const totalUsers = byState.reduce((a, r) => a + r._count._all, 0);

  const stateRows = Object.values(AccountState).map((s) => ({
    key: s,
    label: tr(`state.${s}`) as string,
    value: byState.find((r) => r.state === s)?._count._all ?? 0,
  }));
  const gradCount = (v: boolean | null) =>
    byGraduated.find((x) => x.didGraduate === v)?._count._all ?? 0;
  const roleRows = Object.values(RoleKey).flatMap((r) =>
    r === RoleKey.FORMER_STUDENT
      ? [
          {
            key: "GRADUATE",
            label: tr("audience.GRADUATE") as string,
            value: gradCount(true),
          },
          {
            key: "LEFT_STUDENT",
            label: tr("audience.LEFT_STUDENT") as string,
            value: gradCount(false),
          },
          ...(gradCount(null)
            ? [
                {
                  key: "FORMER_UNKNOWN",
                  label: `${tr("role.FORMER_STUDENT")}（${t("notSet")}）`,
                  value: gradCount(null),
                },
              ]
            : []),
        ]
      : [
          {
            key: r as string,
            label: tr(`role.${r}`) as string,
            value: byRole.find((x) => x.role === r)?._count._all ?? 0,
          },
        ],
  );
  const yearRows = byYear.map((r) => ({
    key: String(r.graduationOrLeaveYear ?? "none"),
    label:
      r.graduationOrLeaveYear === null
        ? (t("notSet") as string)
        : String(r.graduationOrLeaveYear),
    value: r._count._all,
  }));
  // Put "not set" last.
  yearRows.sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : 0));
  const stageNone =
    byStage.find((r) => r.currentStage === null)?._count._all ?? 0;
  const stageRows = [
    ...Object.values(LifeStage).map((s) => ({
      key: s as string,
      label: tr(`stage.${s}`) as string,
      value: byStage.find((r) => r.currentStage === s)?._count._all ?? 0,
    })),
    ...(stageNone
      ? [{ key: "none", label: t("notSet") as string, value: stageNone }]
      : []),
  ];

  return {
    activeMembers: activeCount,
    totalAccounts: totalUsers,
    lineLinked,
    lineFollowing,
    charts: [
      {
        id: "by-role",
        title: t("byRole"),
        note: t("activeOnlyMultiRole"),
        rows: roleRows,
        total: activeCount,
      },
      {
        id: "by-state",
        title: t("byState"),
        note: t("allAccountsNote"),
        rows: stateRows,
      },
      {
        id: "by-stage",
        title: t("byStage"),
        note: t("formerActiveOnly"),
        rows: stageRows,
      },
      {
        id: "by-year",
        title: t("byYear"),
        note: t("formerActiveOnly"),
        rows: yearRows,
      },
    ],
  };
}
