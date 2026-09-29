import type { Locale } from "@contract/core";
import { Stack, useLocalSearchParams } from "expo-router";
import { ArrowDown } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { useVerificationDetail } from "@/features/admin/verification/api";
import { DecisionCard } from "@/features/admin/verification/decision";
import {
  AccountCard,
  AisRecordCard,
  AnswersCard,
  ChildrenCard,
  EvidenceCard,
  InviteCard,
  LastDecisionCard,
  ManagedDuplicateCard,
  RosterCard,
  VouchesCard,
} from "@/features/admin/verification/sections";
import { formatDateTime } from "@/lib/format";
import { Badge, colors, QueryState, space, Text, TOUCH } from "@/ui";

/** Side-by-side (details | decision) from this width, as the website's lg. */
const WIDE = 1024;

/**
 * 本人確認: one application (the website's /app/admin/verification/[id]) —
 * the account, invitation, answers, roster match, vouchers and evidence
 * files, and the decision. Phones get the decision last, with a jump to it.
 */
export default function VerificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations("adminVerify");
  const locale = useLocale() as Locale;
  const query = useVerificationDetail(id);
  const wide = useWindowDimensions().width >= WIDE;
  const scroller = useRef<ScrollView>(null);
  // Where the decision card is: its column's offset + its own.
  const columnsY = useRef(0);
  const decisionY = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{ title: query.data?.name ?? t("detail.title") }}
      />
      <QueryState query={query}>
        {(d) => {
          const aside = (
            <View
              style={styles.column}
              onLayout={(e) => {
                decisionY.current = e.nativeEvent.layout.y;
              }}
            >
              <DecisionCard d={d} />
              <AisRecordCard d={d} />
            </View>
          );
          return (
            <ScrollView
              ref={scroller}
              style={styles.screen}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              contentInsetAdjustmentBehavior="automatic"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  tintColor={colors.brand700}
                  colors={[colors.brand700]}
                />
              }
            >
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text variant="heading" accessibilityRole="header">
                    {d.name}
                  </Text>
                  <Text variant="small" tone="muted">
                    {t("detail.submitted", {
                      date: formatDateTime(d.submittedAt, locale),
                    })}
                  </Text>
                </View>
                <Badge
                  label={t(`status.${d.status}`)}
                  tone={d.open ? "amber" : "slate"}
                />
              </View>
              {d.open && !wide ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    scroller.current?.scrollTo({
                      y: Math.max(
                        0,
                        columnsY.current + decisionY.current - space.lg,
                      ),
                      animated: true,
                    })
                  }
                  style={styles.jump}
                >
                  <Text variant="small" weight="semibold" tone="brand">
                    {t("decision.jump")}
                  </Text>
                  <ArrowDown size={16} color={colors.brand700} aria-hidden />
                </Pressable>
              ) : null}

              {d.schoolEmailVerified || d.minor ? (
                <View style={styles.badges}>
                  {d.schoolEmailVerified ? (
                    <Badge label={t("badges.schoolEmail")} tone="green" />
                  ) : null}
                  {d.minor ? (
                    <Badge label={t("badges.minor")} tone="amber" />
                  ) : null}
                  {d.minor ? (
                    d.parentConfirmed ? (
                      <Badge label={t("badges.parentConfirmed")} tone="green" />
                    ) : (
                      <Badge label={t("badges.parentUnconfirmed")} tone="red" />
                    )
                  ) : null}
                </View>
              ) : null}
              {d.minor ? (
                <Text variant="small" tone="muted">
                  {t("detail.minorNote")}
                </Text>
              ) : null}

              <View
                style={wide ? styles.columns : styles.column}
                onLayout={(e) => {
                  columnsY.current = e.nativeEvent.layout.y;
                }}
              >
                <View style={[styles.column, wide ? styles.main : null]}>
                  <LastDecisionCard d={d} />
                  <AccountCard d={d} />
                  <InviteCard d={d} />
                  <ManagedDuplicateCard d={d} />
                  <ChildrenCard d={d} />
                  <AnswersCard d={d} />
                  <RosterCard d={d} />
                  <VouchesCard d={d} />
                  <EvidenceCard d={d} />
                  {wide ? null : aside}
                </View>
                {wide ? <View style={styles.aside}>{aside}</View> : null}
              </View>
            </ScrollView>
          );
        }}
      </QueryState>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  jump: {
    alignSelf: "flex-start",
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    marginTop: -space.sm,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  columns: { flexDirection: "row", alignItems: "flex-start", gap: space.lg },
  column: { gap: space.lg },
  main: { flex: 1, minWidth: 0 },
  aside: { width: 360 },
});
