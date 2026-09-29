import type { BroadcastAudienceText } from "@contract/admin-notify";
import { useTranslations } from "use-intl";

/** Who a message went to, as one line (the website's broadcastAudienceText). */
export function useAudienceText(): (a: BroadcastAudienceText) => string {
  const t = useTranslations("broadcast");
  const tr = useTranslations("roles");
  return (a) =>
    a.kind === "cohort"
      ? (a.label ?? "—")
      : a.kind === "audiences"
        ? a.keys.map((k) => tr(`audience.${k}`)).join(", ")
        : t("audience.ALL");
}
