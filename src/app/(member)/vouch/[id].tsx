import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { useVouch } from "@/features/family/api";
import { VouchCard } from "@/features/family/vouch";
import { QueryState, Screen, Text } from "@/ui";

/**
 * 「この方をご存じですか？」 (the website's /app/vouch/[id], §6.4.2): only
 * the asked voucher sees it; the applicant is shown with minimal
 * information (name, years at AIS).
 */
export default function VouchScreen() {
  const t = useTranslations("vouch");
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useVouch(id);
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {(vouch) => (
          <Screen>
            <Text variant="small" tone="muted">
              {t("intro")}
            </Text>
            <VouchCard id={id} vouch={vouch} />
          </Screen>
        )}
      </QueryState>
    </>
  );
}
