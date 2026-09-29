import { getTranslations } from "next-intl/server";
import type { SenderRole } from "@/server/generated/prisma/enums";
import { cohortShortLabels } from "@/server/lib/cohorts-db";
import { specFromPost } from "@/server/lib/news-audience";

/**
 * 「発信」: the role a ニュース post / event was sent as, shown to members
 * instead of the author's name. 学年代表 add their 学年 (the audience).
 */
type Sent = {
  id: string;
  senderRole: SenderRole | null;
  audience: unknown;
  targetAudiences: Parameters<typeof specFromPost>[0]["targetAudiences"];
  targetRoles: Parameters<typeof specFromPost>[0]["targetRoles"];
};

export async function senderLabels(
  rows: readonly Sent[],
  locale: "ja" | "en",
): Promise<Map<string, string>> {
  const t = await getTranslations({ locale, namespace: "news.sender" });
  const cohorts = rows.some((r) => r.senderRole === "STUDENT_LEADER")
    ? await cohortShortLabels(locale)
    : {};
  return new Map(
    rows.map((r) => [
      r.id,
      roleLabel(r.senderRole ?? "ADMIN", t, () =>
        specFromPost(r)
          .cohortIds.map((id) => cohorts[id])
          .filter(Boolean)
          .join(locale === "ja" ? "・" : ", "),
      ),
    ]),
  );
}

export async function senderLabel(
  row: Sent,
  locale: "ja" | "en",
): Promise<string> {
  return (await senderLabels([row], locale)).get(row.id) ?? "";
}

/** The label for a role (「教職員」, 「学年代表（第5期）」…). */
export function roleLabel(
  role: SenderRole,
  t: (key: string, values?: Record<string, string>) => string,
  cohort: () => string = () => "",
): string {
  if (role !== "STUDENT_LEADER") return t(role);
  const c = cohort();
  return c ? t("STUDENT_LEADER_COHORT", { cohort: c }) : t(role);
}
