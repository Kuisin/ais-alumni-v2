import type { ChatGroupKind } from "@/server/generated/prisma/enums";
import { cohortShort } from "@/server/lib/cohorts";

type T = (key: string, values?: Record<string, string | number>) => string;

/** "卒業生＋元在校生", "第5期", "第5期 保護者" … (t = chat namespace). */
export function chatGroupName(
  t: T,
  g: { kind: ChatGroupKind; cohort: { number: number } | null },
  locale: "ja" | "en",
): string {
  return t(`groups.${g.kind}`, {
    cohort: g.cohort ? cohortShort(g.cohort, locale) : "",
  });
}
