import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, radius, Text } from "@/ui";

/** 「第5期」「学年代表」 next to a name (the website's MemberTags). */
export function MemberTags({
  cohort,
  rep,
}: {
  cohort?: number | null;
  rep?: boolean;
}) {
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  if (!cohort && !rep) return null;
  return (
    <View style={styles.row}>
      {cohort ? (
        <View style={[styles.tag, styles.cohort]}>
          <Text style={[styles.text, styles.cohortText]}>
            {tc("cohortNumber", { number: cohort })}
          </Text>
        </View>
      ) : null}
      {rep ? (
        <View style={[styles.tag, styles.rep]}>
          <Text style={[styles.text, styles.repText]}>{t("rep")}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tag: { borderRadius: radius.sm - 2, paddingHorizontal: 6 },
  text: { fontSize: 10, lineHeight: 16, fontWeight: "500" },
  cohort: { backgroundColor: colors.slate200 },
  cohortText: { color: colors.slate700 },
  rep: { backgroundColor: colors.brand100 },
  repText: { color: colors.brand800, fontWeight: "600" },
});
