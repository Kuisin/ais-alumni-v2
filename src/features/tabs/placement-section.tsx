import { Platform, StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import { Chips } from "@/features/people/choices";
import { useMe } from "@/lib/auth";
import { Card, Section, space, Text } from "@/ui";
import {
  setTabPlacement,
  TAB_PLACEMENTS,
  type TabPlacement,
  useTabPlacement,
} from "./placement";

/** TEMPORARY: 設定 → タブの表示（テスト用）, admins on iOS (placement.ts). */
export function TabPlacementSection() {
  const t = useTranslations("mobile.tabPlacement");
  const me = useMe();
  const placement = useTabPlacement();
  if (Platform.OS !== "ios" || !me.user.isAdmin) return null;
  return (
    <Section title={t("title")}>
      <Card style={styles.card}>
        <Text variant="small" tone="muted">
          {t("description")}
        </Text>
        <Chips
          label={t("title")}
          choices={TAB_PLACEMENTS.map((p) => ({
            value: p,
            label: t(`options.${p}`),
          }))}
          value={placement}
          onChange={(v) => setTabPlacement(v as TabPlacement)}
        />
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({ card: { gap: space.md } });
