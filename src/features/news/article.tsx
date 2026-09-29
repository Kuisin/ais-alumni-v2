import type { NewsDetail } from "@contract/news";
import { Image } from "expo-image";
import { useHeaderHeight } from "expo-router/react-navigation";
import * as WebBrowser from "expo-web-browser";
import { ArrowDown, Calendar, Clock, Paperclip } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { absoluteUrl } from "@/lib/config";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  Badge,
  Card,
  colors,
  Markdown,
  radius,
  space,
  Text,
  TOUCH,
} from "@/ui";
import {
  Comments,
  ConfirmCard,
  PollCard,
  Reactions,
  ScheduleCard,
} from "./hub";
import { FallbackTag, Notice, SenderTag } from "./parts";

/** Attachment size as the website shows it. */
function size(n: number): string {
  return n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** The cover image, full width at its own proportions (at most 384 pt tall). */
function Cover({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState(16 / 9);
  const [width, setWidth] = useState(0);
  // Signed URLs change on every load; cache by the file instead.
  const key = /[?&]key=([^&]+)/.exec(uri)?.[1];
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Image
        source={{
          uri: absoluteUrl(uri),
          cacheKey: key ? `news-cover:${decodeURIComponent(key)}` : undefined,
        }}
        style={[
          styles.cover,
          { height: width ? Math.min(width / ratio, 384) : 200 },
        ]}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        accessible={false}
        accessibilityIgnoresInvertColors
        onLoad={(e) => {
          const { width: w, height: h } = e.source;
          if (w > 0 && h > 0) setRatio(w / h);
        }}
      />
    </View>
  );
}

/**
 * One ニュース post (the website's /app/news/[id]): notices, date and
 * sender, title, deadline, cover, body, attachments, then what it asks for
 * (確認 / アンケート / 日程調整), reactions and comments.
 */
export function NewsArticle({
  post,
  refreshing,
  onRefresh,
  fresh,
}: {
  post: NewsDetail;
  refreshing: boolean;
  onRefresh: () => void;
  /** the post with signed URLs that are still valid */
  fresh: () => Promise<NewsDetail>;
}) {
  const t = useTranslations("news");
  const th = useTranslations("news.hub");
  const { locale } = useAuth();
  const headerHeight = useHeaderHeight();
  const scroll = useRef<ScrollView>(null);
  const respondY = useRef(0);
  const [typing, setTyping] = useState(false);

  // Keep the comment box above the keyboard while typing.
  useEffect(() => {
    if (!typing) return;
    const toEnd = () =>
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    const shown = Keyboard.addListener("keyboardDidShow", toEnd);
    const hidden = Keyboard.addListener("keyboardDidHide", () =>
      setTyping(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [typing]);

  const openAttachment = async (id: string) => {
    const current = await fresh();
    const file = current.attachments.find((a) => a.id === id);
    if (file) await WebBrowser.openBrowserAsync(absoluteUrl(file.url));
  };

  const asks = post.requireConfirm || post.polls.length > 0;
  const title = post.title || t("untitled");

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        ref={scroll}
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand700}
            colors={[colors.brand700]}
          />
        }
      >
        {post.adminView ? (
          <Notice tone="info" title={t("adminView.title")}>
            {t("adminView.body")}
          </Notice>
        ) : null}

        <View style={styles.head}>
          <View style={styles.meta}>
            {post.pinned ? <Badge tone="brand" label={t("pinned")} /> : null}
            <View style={styles.inline}>
              <Calendar size={16} color={colors.slate600} aria-hidden />
              <Text variant="small" tone="muted">
                {formatDate(post.publishedAt, locale)}
              </Text>
            </View>
            <SenderTag sender={post.sender} />
          </View>
          <Text variant="heading" accessibilityRole="header" selectable>
            {title}
            <FallbackTag fallback={post.titleFallback} />
          </Text>
          {post.deadline || post.closedAt || (post.open && asks) ? (
            <View style={styles.meta}>
              {post.deadline || post.closedAt ? (
                <View
                  style={[
                    styles.pill,
                    post.open ? styles.pillOpen : styles.pillClosed,
                  ]}
                >
                  <Clock
                    size={16}
                    color={post.open ? colors.amber900 : colors.slate700}
                    aria-hidden
                  />
                  <Text
                    variant="small"
                    weight="medium"
                    style={post.open ? styles.openText : styles.closedText}
                  >
                    {post.open && post.deadline
                      ? th("deadline", {
                          time: formatDateTime(post.deadline, locale),
                        })
                      : post.closedAt
                        ? th("closedManual")
                        : th("closed")}
                  </Text>
                </View>
              ) : null}
              {/* Something to answer: jump past the body to it. */}
              {post.open && asks ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    scroll.current?.scrollTo({
                      y: Math.max(0, respondY.current - space.md),
                      animated: true,
                    })
                  }
                  style={({ pressed }) => [
                    styles.jump,
                    pressed ? styles.jumpPressed : null,
                  ]}
                >
                  <Text variant="small" tone="brand" weight="semibold">
                    {t("respondJump")}
                  </Text>
                  <ArrowDown size={16} color={colors.brand700} aria-hidden />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {post.cover ? <Cover uri={post.cover} /> : null}
        {post.bodyFallback ? (
          <FallbackTag block fallback={post.bodyFallback} />
        ) : null}
        <Markdown source={post.body} />

        {post.attachments.length ? (
          <Card style={styles.files}>
            <View style={styles.inline}>
              <Paperclip size={20} color={colors.brand700} aria-hidden />
              <Text variant="subheading" accessibilityRole="header">
                {th("files.title")}
              </Text>
            </View>
            {post.attachments.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="link"
                accessibilityLabel={`${a.fileName} (${size(a.size)})`}
                onPress={() => void openAttachment(a.id)}
                style={({ pressed }) => [
                  styles.file,
                  pressed ? styles.jumpPressed : null,
                ]}
              >
                <Text variant="body" tone="brand" style={styles.fileName}>
                  {a.fileName}
                </Text>
                <Text variant="caption" tone="subtle">
                  {size(a.size)}
                </Text>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {asks ? (
          <View
            style={styles.respond}
            onLayout={(e) => {
              respondY.current = e.nativeEvent.layout.y;
            }}
          >
            {post.requireConfirm ? <ConfirmCard post={post} /> : null}
            {post.polls.map((p) =>
              p.kind === "SCHEDULE" ? (
                <ScheduleCard
                  key={p.id}
                  postId={post.id}
                  poll={p}
                  open={post.open}
                />
              ) : (
                <PollCard
                  key={p.id}
                  postId={post.id}
                  poll={p}
                  open={post.open}
                />
              ),
            )}
          </View>
        ) : null}

        {post.allowComments ? (
          <Reactions postId={post.id} reactions={post.reactions} />
        ) : null}

        {post.allowComments || post.comments.length ? (
          <Comments post={post} onInputFocus={() => setTyping(true)} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  head: { gap: space.sm },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: space.sm,
    rowGap: space.xs,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  pillOpen: { backgroundColor: colors.amber100 },
  pillClosed: { backgroundColor: colors.slate100 },
  openText: { color: colors.amber900 },
  closedText: { color: colors.slate700 },
  jump: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
  },
  jumpPressed: { backgroundColor: colors.brand50 },
  cover: {
    width: "100%",
    borderRadius: radius.lg,
    backgroundColor: colors.slate100,
  },
  files: { gap: space.xs },
  file: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.sm,
  },
  fileName: { flexShrink: 1, textDecorationLine: "underline" },
  respond: { gap: space.xl },
});
