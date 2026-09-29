import type { HomeTodo } from "@contract/home";
import { type Href, useRouter } from "expo-router";
import { ArrowRight, ChevronRight, Mail } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { hrefFor, webHref } from "@/lib/links";
import { colors, radius, space, Text, TOUCH } from "@/ui";

/**
 * A titled block on Home with a "see all" link (the website's
 * DashboardSection).
 */
export function HomeSection({
  title,
  more,
  onMore,
  children,
}: {
  title: string;
  more: string;
  onMore: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text
          variant="subheading"
          accessibilityRole="header"
          style={styles.flex}
        >
          {title}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={onMore}
          style={({ pressed }) => [
            styles.more,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text variant="small" tone="brand" weight="semibold">
            {more}
          </Text>
          <ChevronRight size={16} color={colors.brand700} aria-hidden />
        </Pressable>
      </View>
      <View style={styles.items}>{children}</View>
    </View>
  );
}

/** A highlighted "you have something to do" row (the website's ActionItem). */
function ActionItem({ label, href }: { label: string; href: Href }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        styles.action,
        pressed ? styles.actionPressed : null,
      ]}
    >
      <Text variant="small" style={styles.actionText}>
        {label}
      </Text>
      <ArrowRight size={16} color={colors.amber900} aria-hidden />
    </Pressable>
  );
}

/** 「対応が必要な項目」: follow requests, vouch requests, family links. */
export function TodoList({ todo }: { todo: HomeTodo }) {
  const t = useTranslations("dashboard.todo");
  if (!todo.followRequests && !todo.vouches.length && !todo.family.length)
    return null;
  return (
    <View style={styles.section}>
      <Text variant="subheading" accessibilityRole="header">
        {t("title")}
      </Text>
      <View style={styles.todo}>
        {todo.followRequests > 0 ? (
          <ActionItem
            label={t("followRequests", { count: todo.followRequests })}
            href={hrefFor("/app/follows")}
          />
        ) : null}
        {todo.vouches.map((v) => (
          <ActionItem
            key={v.id}
            label={t("vouch", { name: v.name })}
            href={webHref(`/app/vouch/${v.id}`)}
          />
        ))}
        {todo.family.map((l) => (
          <ActionItem
            key={l.id}
            label={t(
              l.initiatedBy === "PARENT"
                ? "familyFromParent"
                : "familyFromChild",
              { name: l.name },
            )}
            href={webHref("/app/family")}
          />
        ))}
      </View>
    </View>
  );
}

/** 「新しい連絡が N 件あります」 (only while messages are switched on). */
export function MessagesBanner({ count }: { count: number }) {
  const t = useTranslations("news.messages");
  const router = useRouter();
  const label = t("newCount", { count });
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push(webHref("/app/news?tab=messages"))}
      style={({ pressed }) => [
        styles.messages,
        pressed ? styles.messagesPressed : null,
      ]}
    >
      <Mail size={20} color={colors.brand900} aria-hidden />
      <Text variant="body" weight="medium" style={styles.messagesText}>
        {label}
      </Text>
      <ArrowRight size={18} color={colors.brand900} aria-hidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  more: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: space.sm,
    borderRadius: radius.sm,
  },
  pressed: { opacity: 0.6 },
  items: { gap: space.md },
  todo: { gap: space.sm },
  action: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.amber100,
    backgroundColor: colors.amber50,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  actionPressed: { backgroundColor: colors.amber100 },
  actionText: { flex: 1, color: colors.amber900 },
  messages: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.brand200,
    backgroundColor: colors.brand50,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  messagesPressed: { backgroundColor: colors.brand100 },
  messagesText: { flex: 1, color: colors.brand900 },
});
