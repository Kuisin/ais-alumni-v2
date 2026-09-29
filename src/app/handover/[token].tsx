import type { HandoverClaimed, HandoverInfo } from "@contract/onboarding";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Notice } from "@/features/onboarding/controls";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, colors, QueryState, Screen, space, Text } from "@/ui";

/**
 * The emailed link for a child taking over the account a parent created
 * (the website's /app/handover/[token]). Public; confirming is a button,
 * so link previews can't use the link up.
 */
export default function HandoverScreen() {
  const t = useTranslations("family.handover.claim");
  const { token = "" } = useLocalSearchParams<{ token: string }>();
  const { status, signOut } = useAuth();
  const router = useRouter();
  const signedIn = status === "signedIn";
  const info = useQuery({
    queryKey: ["handover", token],
    queryFn: () => api<HandoverInfo>(`/handover/${encodeURIComponent(token)}`),
  });
  const claim = useMutation({
    mutationFn: () =>
      api<HandoverClaimed>(`/handover/${encodeURIComponent(token)}/claim`, {
        method: "POST",
      }),
  });

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <Screen contentStyle={styles.content}>
        <QueryState query={info}>
          {(h) => (
            <Card style={styles.card}>
              {!h.valid ? (
                <Notice tone="error">{t("invalid")}</Notice>
              ) : claim.data ? (
                <View style={styles.gap} accessibilityLiveRegion="polite">
                  <View style={styles.row}>
                    <CircleCheck
                      size={20}
                      color={colors.green700}
                      aria-hidden
                    />
                    <Text weight="semibold" tone="success">
                      {t("done")}
                    </Text>
                  </View>
                  <Text variant="small">
                    {t("signInWith", { email: claim.data.email })}
                  </Text>
                  {signedIn ? (
                    <Button
                      label={t("signOutAndIn")}
                      onPress={async () => {
                        await signOut();
                        router.replace("/sign-in");
                      }}
                    />
                  ) : (
                    <Button
                      label={t("goSignIn")}
                      onPress={() => router.replace("/sign-in")}
                    />
                  )}
                </View>
              ) : (
                <View style={styles.gap}>
                  <Text>
                    {t("body", {
                      parent: h.parent,
                      child: h.child,
                      email: h.email,
                    })}
                  </Text>
                  <View style={styles.gapSm}>
                    {(["point1", "point2", "point3"] as const).map((k) => (
                      <View key={k} style={styles.row}>
                        <Text variant="small" tone="muted" aria-hidden>
                          •
                        </Text>
                        <Text variant="small" tone="muted" style={styles.flex}>
                          {t(k)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {signedIn ? (
                    <Notice tone="info">{t("signedIn")}</Notice>
                  ) : null}
                  {claim.isError ? (
                    <Notice tone="error">{t("invalid")}</Notice>
                  ) : null}
                  <Button
                    label={claim.isPending ? t("working") : t("confirm")}
                    loading={claim.isPending}
                    onPress={() => claim.mutate()}
                  />
                </View>
              )}
            </Card>
          )}
        </QueryState>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: "100%", maxWidth: 560, alignSelf: "center" },
  card: { gap: space.lg },
  gap: { gap: space.md },
  gapSm: { gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
