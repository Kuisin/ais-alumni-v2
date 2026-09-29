import type { AdminDestinations } from "@contract/admin-manage";
import { getTranslations } from "next-intl/server";
import { AccountState, RoleKey } from "@/server/generated/prisma/enums";
import { cohortShort } from "@/server/lib/cohorts";
import { loadCohortOptions } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import { PATH_LEVELS, pathOf, topNames } from "@/server/lib/destinations";
import { displayName } from "@/server/lib/format";

const ENTRY = { startYear: true, endYear: true } as const;
/** rows shown before "show all" */
const ROW_LIMIT = 30;

/**
 * 進路: where former students went after AIS, from their 学歴・職歴 (the
 * website's /app/admin/destinations; the caller checks admin). Query as the
 * page's form: cohort, f=1 + hist=1 (only with history), all=1.
 */
export async function loadAdminDestinations(
  locale: "ja" | "en",
  sp: Record<string, string>,
): Promise<AdminDestinations> {
  const t = await getTranslations("destinations");
  const th = await getTranslations("history");
  const cohorts = await loadCohortOptions(locale);
  const cohortId = cohorts.some((c) => c.id === sp.cohort)
    ? String(sp.cohort)
    : "";
  // The form sends f=1; without it (first visit) the toggle uses its default.
  const toggled = sp.f === "1";
  const showAll = sp.all === "1";

  const rows = await db.userRole.findMany({
    where: {
      role: RoleKey.FORMER_STUDENT,
      user: { state: AccountState.ACTIVE },
      ...(cohortId ? { cohortId } : {}),
    },
    select: {
      didGraduate: true,
      graduationOrLeaveYear: true,
      cohort: { select: { number: true } },
      user: {
        select: {
          id: true,
          nameRomaji: true,
          nameKanji: true,
          education: {
            select: {
              ...ENTRY,
              level: true,
              school: { select: { name: true } },
            },
          },
          work: { select: { ...ENTRY, company: { select: { name: true } } } },
        },
      },
    },
  });
  const people = rows
    .map((r) => ({
      id: r.user.id,
      name: displayName(r.user, locale),
      cohort: r.cohort?.number ?? null,
      didGraduate: r.didGraduate,
      year: r.graduationOrLeaveYear,
      path: pathOf(
        r.user.education.map((e) => ({ ...e, school: e.school.name })),
        r.user.work.map((w) => ({ ...w, company: w.company.name })),
      ),
    }))
    .sort(
      (a, b) =>
        // members with history first, then by 学年 and name
        Number(b.path.hasHistory) - Number(a.path.hasHistory) ||
        (a.cohort ?? 999) - (b.cohort ?? 999) ||
        a.name.localeCompare(b.name),
    );
  const withHistory = people.filter((p) => p.path.hasHistory).length;
  const onlyHistory = toggled ? sp.hist === "1" : withHistory > 0;
  const listed = onlyHistory ? people.filter((p) => p.path.hasHistory) : people;
  const shown = showAll ? listed : listed.slice(0, ROW_LIMIT);
  const levels = PATH_LEVELS.slice(0, 3);

  const top = (names: (string | null | undefined)[]) =>
    topNames(names).map((n) => ({
      key: n.name,
      label: n.name,
      value: n.count,
    }));
  const charts = [
    ...levels.map((level) => ({
      id: `top-${level}`,
      title: t("topSchools", { level: th(`levels.${level}`) }),
      rows: top(people.map((p) => p.path.schools[level])),
      total: withHistory,
    })),
    {
      id: "top-work",
      title: t("topWork"),
      rows: top(
        people.map((p) =>
          p.path.now?.kind === "work" ? p.path.now.name : null,
        ),
      ),
      total: withHistory,
    },
  ];

  return {
    cohorts: cohorts.map((c) => ({ id: c.id, label: c.label })),
    cohortId,
    onlyHistory,
    formerStudents: people.length,
    withHistory,
    charts,
    listed: listed.length,
    people: shown.map((p) => ({
      id: p.id,
      name: p.name,
      cohort: p.cohort ? cohortShort({ number: p.cohort }, locale) : "—",
      left: p.year
        ? t(p.didGraduate ? "graduated" : "left", { year: p.year })
        : null,
      schools: levels.map((l) => ({
        level: l,
        label: th(`levels.${l}`),
        name: p.path.schools[l] ?? null,
      })),
      now: p.path.now,
      hasHistory: p.path.hasHistory,
    })),
  };
}
