import type { OnboardingLine } from "@contract/onboarding";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ONBOARDING_KEY } from "@/features/onboarding/api";
import { LinePanel } from "@/features/onboarding/line-panel";
import { OnboardingShell } from "@/features/onboarding/shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, colors, QueryState, space, Text } from "@/ui";

const KEY = [...ONBOARDING_KEY, "line"];

/**
 * The optional 「LINE で最新情報を受け取る」 step after the email check
 * (the website's /app/onboarding/line): link LINE and follow the Official
 * Account, or skip — the application comes next either way.
 */
export default function OnboardingLineScreen() {
  const t = useTranslations("onboarding.line");
  const { refreshMe } = useAuth();
  const queryClient = useQueryClient();
  const [skipping, setSkipping] = useState(false);
  const q = useQuery({
    queryKey: KEY,
    queryFn: () => api<{ line: OnboardingLine | null }>("/onboarding/line"),
  });
  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: KEY });
  }, [queryClient]);

  // Back from LINE (add friend opens the LINE app): check again.
  useFocusEffect(reload);
  // Linked and following, or already seen: the server moved the step on.
  const done = q.data && q.data.line === null;
  useEffect(() => {
    if (done) void refreshMe();
  }, [done, refreshMe]);

  const skip = async () => {
    setSkipping(true);
    try {
      await api("/onboarding/line/skip", { method: "POST" });
      await refreshMe();
    } finally {
      setSkipping(false);
    }
  };

  return (
    <OnboardingShell
      title={t("title")}
      description={t("description")}
      onRefresh={reload}
    >
      <QueryState query={q}>
        {({ line }) =>
          line ? (
            <>
              <Card style={styles.card}>
                <View style={styles.list}>
                  {(["news", "mentions"] as const).map((key) => (
                    <View key={key} style={styles.item}>
                      <View style={styles.dot} />
                      <Text variant="small" style={styles.flex}>
                        {t(`benefits.${key}`)}
                      </Text>
                    </View>
                  ))}
                </View>
                <LinePanel
                  line={line}
                  returnTo="/onboarding/line"
                  onChanged={reload}
                />
                <Text variant="caption" tone="subtle">
                  {t("emailFallback")}
                </Text>
              </Card>
              <Button
                variant={line.linked ? "primary" : "secondary"}
                label={line.linked ? t("continue") : t("skip")}
                loading={skipping}
                onPress={skip}
              />
            </>
          ) : null
        }
      </QueryState>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space.lg },
  list: { gap: space.sm },
  item: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
  },
});
