import type { AdminCohorts } from "@contract/admin-manage";
import { PositionKey } from "@/server/generated/prisma/enums";
import { cohortLabel } from "@/server/lib/cohorts";
import { db } from "@/server/lib/db";
import { isClassGraduated } from "@/server/lib/school";

/** "第9期（2020年 小学校卒業）" → "2020年 小学校卒業" (the title shows 第9期). */
function subtitle(label: string): string {
  return label.match(/[（(]([^（(]*)[）)]$/)?.[1] ?? label;
}

/** 学年 list (the website's /app/admin/cohorts; the caller checks admin). */
export async function loadAdminCohorts(
  locale: "ja" | "en",
): Promise<AdminCohorts> {
  const cohorts = await db.cohort.findMany({
    orderBy: { number: "desc" },
    include: {
      _count: { select: { roles: true, positions: true, broadcasts: true } },
      // 学年代表 of each 学年.
      positions: {
        where: { position: PositionKey.STUDENT_LEADER },
        orderBy: { createdAt: "asc" },
        select: {
          user: { select: { id: true, nameRomaji: true, nameKanji: true } },
        },
      },
    },
  });
  return {
    cohorts: cohorts.map((c) => ({
      id: c.id,
      number: c.number,
      graduated: isClassGraduated(c.elementaryEndYear),
      subtitle: subtitle(cohortLabel(c, locale)),
      members: c._count.roles,
      note: c.note,
      elementaryStartYear: c.elementaryStartYear,
      elementaryEndYear: c.elementaryEndYear,
      reps: c.positions.map(({ user: u }) => ({
        id: u.id,
        name: u.nameRomaji ?? u.nameKanji ?? "—",
        kanji: u.nameRomaji ? u.nameKanji : null,
      })),
      deletable:
        c._count.roles + c._count.positions + c._count.broadcasts === 0,
    })),
  };
}
