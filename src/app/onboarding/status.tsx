import type { HomeSetup } from "@contract/home";
import type { OnboardingStatus } from "@contract/onboarding";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { SetupChecklist } from "@/features/home/setup-checklist";
import { PushPrompt } from "@/features/notifications/push-prompt";
import { ONBOARDING_KEY } from "@/features/onboarding/api";
import { LinePanel } from "@/features/onboarding/line-panel";
import { OnboardingShell } from "@/features/onboarding/shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Badge, Card, colors, QueryState, radius, space, Text } from "@/ui";

const KEY = [...ONBOARDING_KEY, "status"];

const TONE = {
  PENDING_REVIEW: "amber",
  REJECTED: "red",
  DEACTIVATED: "slate",
} as const;

const CHILD_TONE = {
  approved: "green",
  rejected: "red",
  review: "amber",
  needsConfirm: "amber",
} as const;

/**
 * Where PENDING_REVIEW / REJECTED / DEACTIVATED accounts land (the
 * website's /app/onboarding/status): the state, dates, the committee's
 * note, a parent's children, 「はじめの設定」 and LINE while waiting. The
 * app switches to the member tabs by itself once approved (/me).
 */
export default function OnboardingStatusScreen() {
  const t = useTranslations("onboarding.status");
  const tr = useTranslations("roles.state");
  const { locale, refreshMe } = useAuth();
  const q = useQuery({
    queryKey: KEY,
    queryFn: () => api<OnboardingStatus>("/onboarding/status"),
  });
  const { refetch } = q;
  const reload = useCallback(() => {
    void refreshMe();
    void refetch();
  }, [refreshMe, refetch]);
  // Back in the app: the application may have been decided.
  useFocusEffect(reload);

  const s = q.data;
  const title = s
    ? s.parentWaiting
      ? t("parentWaiting.title")
      : t(`${s.state}.title`)
    : undefined;

  return (
    <OnboardingShell
      title={title}
      onRefresh={reload}
      refreshing={q.isRefetching}
    >
      <QueryState query={q}>
        {(s) => (
          <>
            {s.setup ? (
              <SetupChecklist
                setup={
                  {
                    ...s.setup,
                    // The tasks open on this screen (LINE below) or after
                    // approval: nothing to jump to from here.
                    items: s.setup.items.map((i) => ({ ...i, href: null })),
                  } as HomeSetup
                }
              />
            ) : null}
            <Card style={styles.card}>
              <View style={styles.badge}>
                <Badge tone={TONE[s.state]} label={tr(s.state)} />
              </View>
              <Text>
                {s.parentWaiting
                  ? t("parentWaiting.body")
                  : t(`${s.state}.body`)}
              </Text>

              {s.children.length ? (
                <View style={styles.gapSm}>
                  <Text
                    variant="small"
                    weight="semibold"
                    accessibilityRole="header"
                  >
                    {t("parentWaiting.children")}
                  </Text>
                  <View style={styles.children}>
                    {s.children.map((c, i) => (
                      <View
                        key={c.id}
                        style={[styles.child, i > 0 ? styles.divider : null]}
                      >
                        <Text
                          variant="small"
                          weight="medium"
                          style={styles.flex}
                        >
                          {c.name}
                        </Text>
                        <Badge
                          tone={CHILD_TONE[c.state]}
                          label={t(`parentWaiting.state.${c.state}`)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.gapSm}>
                {s.submittedAt ? (
                  <Fact
                    label={t("submittedAt")}
                    value={formatDate(s.submittedAt, locale)}
                  />
                ) : null}
                {s.decidedAt ? (
                  <Fact
                    label={t("decidedAt")}
                    value={formatDate(s.decidedAt, locale)}
                  />
                ) : null}
                {s.deactivatedAt ? (
                  <Fact
                    label={t("deactivatedAt")}
                    value={formatDate(s.deactivatedAt, locale)}
                  />
                ) : null}
              </View>

              {s.reviewNote ? (
                <View style={styles.note}>
                  <Text
                    variant="small"
                    weight="semibold"
                    accessibilityRole="header"
                  >
                    {t("reviewNote")}
                  </Text>
                  <Text variant="small">{s.reviewNote}</Text>
                </View>
              ) : null}

              {s.state !== "PENDING_REVIEW" ? (
                <Text variant="small" tone="muted">
                  {t("contact")}
                </Text>
              ) : null}
            </Card>

            {s.line ? (
              <Card style={styles.card}>
                <Text variant="subheading" accessibilityRole="header">
                  {t("lineTitle")}
                </Text>
                <Text variant="small">{t("lineBody")}</Text>
                <LinePanel
                  line={s.line}
                  returnTo="/onboarding/status"
                  onChanged={reload}
                />
              </Card>
            ) : null}

            {s.state === "PENDING_REVIEW" ? (
              <PushPrompt variant="onboarding" />
            ) : null}
          </>
        )}
      </QueryState>
    </OnboardingShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text variant="small">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space.lg },
  badge: { flexDirection: "row" },
  gapSm: { gap: space.sm },
  children: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  child: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  fact: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  note: {
    gap: space.xs,
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: space.lg,
  },
});
