import type { LineLinkOutcome } from "@contract/line";
import { useTranslations } from "use-intl";
import { Text } from "@/ui";

/** The website's line.outcome.<outcome> message after linking LINE. */
export function LineOutcomeNotice({
  outcome,
}: {
  outcome: LineLinkOutcome | null | undefined;
}) {
  const t = useTranslations("line.outcome");
  if (!outcome) return null;
  return (
    <Text
      variant="small"
      tone={outcome === "linked" ? "success" : "danger"}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {t(outcome)}
    </Text>
  );
}
