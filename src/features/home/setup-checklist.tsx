import type { HomeSetup, HomeSetupKey } from "@contract/home";
import { useRouter } from "expo-router";
import {
  BadgeCheck,
  Camera,
  Check,
  ChevronDown,
  FileText,
  GraduationCap,
  Languages,
  type LucideIcon,
  Mail,
  MessageCircle,
  PenLine,
  UserPlus,
  UsersRound,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { hrefFor } from "@/lib/links";
import { Badge, Button, colors, radius, space, Text, TOUCH } from "@/ui";

const ICONS: Record<HomeSetupKey, LucideIcon> = {
  email: Mail,
  apply: FileText,
  approval: BadgeCheck,
  line: MessageCircle,
  photo: Camera,
  bio: PenLine,
  history: GraduationCap,
  follow: UserPlus,
  family: UsersRound,
  names: Languages,
  schoolEmail: Mail,
};

/**
 * 「はじめの設定」 with progress (the website's SetupChecklist). Each open
 * task says why it helps and opens where it's done — in the app if it has
 * the screen, else the website page.
 */
export function SetupChecklist({ setup }: { setup: HomeSetup }) {
  const t = useTranslations("setup");
  const router = useRouter();
  const [showDone, setShowDone] = useState(false);
  const { done, total, complete } = setup;
  const next = setup.items.find((i) => !i.done && i.href);
  // Open tasks get full rows; finished ones fold into one line.
  const todo = setup.items.filter((i) => !i.done);
  const finished = setup.items.filter((i) => i.done);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="subheading" weight="bold" accessibilityRole="header">
            {t("title")}
          </Text>
          <Text variant="small" tone="muted">
            {complete ? t("complete") : t("intro")}
          </Text>
        </View>
        <Text variant="small" weight="semibold" style={styles.progressText}>
          {t("progress", { done, total })}
        </Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={t("progressLabel")}
        accessibilityValue={{ min: 0, max: total, now: done }}
      >
        <View
          style={[
            styles.fill,
            { width: `${total ? (done / total) * 100 : 0}%` },
          ]}
        />
      </View>

      {todo.length ? (
        <View style={styles.list}>
          {todo.map((item) => {
            const Icon = ICONS[item.key] ?? FileText;
            const title = t(`items.${item.key}.title`);
            const tag = item.recommended
              ? t("recommended")
              : item.optional
                ? t("optional")
                : null;
            return (
              <View key={item.key} style={styles.item}>
                <View style={styles.icon}>
                  <Icon size={16} color={colors.brand700} aria-hidden />
                </View>
                <View style={styles.itemBody}>
                  <View
                    style={styles.itemTitle}
                    accessible
                    accessibilityLabel={[title, tag, t("todo")]
                      .filter(Boolean)
                      .join(" — ")}
                  >
                    <Text variant="body" weight="medium">
                      {title}
                    </Text>
                    {item.recommended ? (
                      <Badge tone="amber" label={t("recommended")} />
                    ) : item.optional ? (
                      // The website's slate-200 pill (slate-100 vanishes on the tinted row).
                      <View style={styles.optional}>
                        <Text
                          variant="caption"
                          weight="medium"
                          style={styles.optionalText}
                        >
                          {t("optional")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="small" tone="muted">
                    {t(`items.${item.key}.body`)}
                  </Text>
                  {!item.href && item.optional ? (
                    <Text variant="caption" tone="subtle">
                      {t("afterApproval")}
                    </Text>
                  ) : item.href && hrefFor(item.href) ? (
                    <Button
                      variant={item === next ? "primary" : "secondary"}
                      label={t(`items.${item.key}.action`)}
                      onPress={() => {
                        const href = item.href ? hrefFor(item.href) : null;
                        if (href) router.push(href);
                      }}
                      style={styles.action}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {finished.length ? (
        <View style={styles.done}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showDone }}
            onPress={() => setShowDone((s) => !s)}
            style={styles.doneHead}
          >
            <View style={styles.check}>
              <Check
                size={14}
                color={colors.white}
                strokeWidth={3}
                aria-hidden
              />
            </View>
            <Text variant="small" weight="medium" style={styles.flex}>
              {t("doneSummary", { count: finished.length })}
            </Text>
            <ChevronDown
              size={16}
              color={colors.slate500}
              aria-hidden
              style={showDone ? styles.flip : undefined}
            />
          </Pressable>
          {showDone ? (
            <View style={styles.doneList}>
              {finished.map((item) => (
                <View
                  key={item.key}
                  style={styles.doneItem}
                  accessible
                  accessibilityLabel={`${t(`items.${item.key}.title`)} — ${t("done")}`}
                >
                  <Check size={16} color={colors.green700} aria-hidden />
                  <Text variant="small" tone="muted" style={styles.flex}>
                    {t(`items.${item.key}.title`)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    gap: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brand100,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  head: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  progressText: { color: colors.brand800 },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.brand700,
  },
  list: { gap: space.sm },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    padding: space.md,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.brand200,
  },
  itemBody: { flex: 1, gap: space.xs, alignItems: "flex-start" },
  itemTitle: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  optional: {
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    backgroundColor: colors.slate200,
  },
  optionalText: { color: colors.slate700 },
  action: { marginTop: space.xs, minWidth: 112 },
  done: { backgroundColor: colors.slate50, borderRadius: radius.md },
  doneHead: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green600,
  },
  flip: { transform: [{ rotate: "180deg" }] },
  doneList: {
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  doneItem: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
