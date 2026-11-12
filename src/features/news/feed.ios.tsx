import type { MessageSummary, NewsSummary } from "@contract/news";
import {
  Button,
  Host,
  HStack,
  Image,
  List,
  ProgressView,
  RNHostView,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  background,
  font,
  foregroundStyle,
  lineLimit,
  listRowBackground,
  listRowInsets,
  listStyle,
  onAppear,
  padding,
  refreshable,
  scrollContentBackground,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import { Mail, Newspaper } from "lucide-react-native";
import type { ReactElement, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { colors, EmptyState, ScreenView, space } from "@/ui";
import type { FeedProps } from "./feed";

/**
 * ニュース's posts on iOS: the system's list (SwiftUI `List`, inset
 * grouped), a row per post — its badges, title, the start of its text,
 * date and sender — loaded page by page as the last row appears.
 * Android and the web: feed.tsx (FlatList and cards).
 */
export function NewsFeed({ items, header, pager }: FeedProps<NewsSummary>) {
  const t = useTranslations("news");
  const tc = useTranslations("common");
  const ts = useTranslations("news.sender");
  const { locale } = useAuth();
  const router = useRouter();
  const join = locale === "ja" ? "、" : ", ";

  return (
    <Feed
      items={items}
      header={header}
      pager={pager}
      empty={
        <EmptyState
          icon={<Newspaper size={32} color={colors.slate400} aria-hidden />}
          title={t("empty")}
          hint={t("emptyHint")}
        />
      }
      render={(post) => {
        const title = post.title || t("untitled");
        const fallback =
          post.titleFallback === "en"
            ? tc("englishOnly")
            : post.titleFallback
              ? tc("japaneseOnly")
              : null;
        const date = post.publishedAt
          ? formatDate(post.publishedAt, locale)
          : null;
        const sender = post.sender ? ts("from", { role: post.sender }) : null;
        const label = [
          post.unread ? t("unread") : null,
          post.adminView ? t("adminView.badge") : null,
          post.needsAnswer ? t("hub.needsAnswer") : null,
          post.pinned ? t("pinned") : null,
          title,
          fallback,
          date,
          sender,
        ]
          .filter(Boolean)
          .join(join);
        const badges = post.unread || post.adminView || post.needsAnswer;
        return (
          <Row
            label={label}
            unread={post.unread}
            onPress={() => router.push(`/news/${post.id}`)}
          >
            {badges || post.pinned ? (
              <HStack spacing={6}>
                {post.unread ? <Unread label={t("unread")} /> : null}
                {post.adminView ? (
                  <Pill
                    label={t("adminView.badge")}
                    fg={colors.slate700}
                    bg={colors.slate100}
                  />
                ) : null}
                {post.needsAnswer ? (
                  <Pill
                    label={t("hub.needsAnswer")}
                    fg={colors.amber900}
                    bg={colors.amber100}
                  />
                ) : null}
                {post.pinned ? (
                  <Pill
                    label={t("pinned")}
                    fg={colors.brand700}
                    bg={colors.brand50}
                    symbol="pin.fill"
                  />
                ) : null}
              </HStack>
            ) : null}
            <Text
              modifiers={[
                font({
                  textStyle: "body",
                  weight: post.unread ? "bold" : "semibold",
                }),
                foregroundStyle(colors.text),
                lineLimit(3),
              ]}
            >
              {fallback ? `${title}  ${fallback}` : title}
            </Text>
            {post.excerpt ? (
              <Text
                modifiers={[
                  font({ textStyle: "subheadline" }),
                  foregroundStyle(colors.textMuted),
                  lineLimit(2),
                ]}
              >
                {post.excerpt}
              </Text>
            ) : null}
            {date || sender ? (
              <Text
                modifiers={[
                  font({ textStyle: "footnote" }),
                  foregroundStyle(colors.textSubtle),
                  lineLimit(1),
                ]}
              >
                {[date, sender].filter(Boolean).join("  ·  ")}
              </Text>
            ) : null}
          </Row>
        );
      }}
    />
  );
}

/** あなた宛ての連絡 on iOS (20 per page, newest first). */
export function MessageFeed({
  items,
  header,
  pager,
}: FeedProps<MessageSummary>) {
  const t = useTranslations("news");
  const { locale } = useAuth();
  const router = useRouter();
  const join = locale === "ja" ? "、" : ", ";

  return (
    <Feed
      items={items}
      header={header}
      pager={pager}
      empty={
        <EmptyState
          icon={<Mail size={32} color={colors.slate400} aria-hidden />}
          title={t("messages.empty")}
          hint={t("messages.emptyHint")}
        />
      }
      render={(message) => {
        const date = formatDate(message.sentAt, locale);
        const label = [
          message.unread ? t("unread") : null,
          date,
          message.title,
          message.edited ? t("messages.edited") : null,
          message.sender,
        ]
          .filter(Boolean)
          .join(join);
        return (
          <Row
            label={label}
            unread={message.unread}
            onPress={() => router.push(`/news/messages/${message.id}`)}
          >
            {message.unread ? <Unread label={t("unread")} /> : null}
            <Text
              modifiers={[
                font({
                  textStyle: "body",
                  weight: message.unread ? "bold" : "semibold",
                }),
                foregroundStyle(colors.text),
                lineLimit(3),
              ]}
            >
              {message.edited
                ? `${message.title}  ${t("messages.edited")}`
                : message.title}
            </Text>
            <Text
              modifiers={[
                font({ textStyle: "footnote" }),
                foregroundStyle(colors.textSubtle),
                lineLimit(1),
              ]}
            >
              {`${date}  ·  ${message.sender}`}
            </Text>
          </Row>
        );
      }}
    />
  );
}

function Feed<T extends { id: string }>({
  items,
  header,
  pager,
  render,
  empty,
}: FeedProps<T> & {
  render: (item: T) => ReactElement;
  empty: ReactElement;
}) {
  const tm = useTranslations("mobile.errors");
  const more = () => {
    // After a failed page, the retry row takes over.
    if (pager.hasNextPage && !pager.isFetching && !pager.isFetchNextPageError)
      void pager.fetchNextPage();
  };

  return (
    <ScreenView>
      <Host style={styles.fill}>
        <List
          modifiers={[
            listStyle("insetGrouped"),
            // The app's page background, as on Android and the web.
            scrollContentBackground("hidden"),
            refreshable(async () => {
              await pager.refetch().catch(() => {});
            }),
          ]}
        >
          {header ? (
            <Section>
              <Hosted>
                <View style={styles.header}>{header}</View>
              </Hosted>
            </Section>
          ) : null}
          {items.length === 0 ? (
            <Section>
              <Hosted>{empty}</Hosted>
            </Section>
          ) : (
            <Section>
              {items.map((item, i) => (
                <PagedRow
                  key={item.id}
                  last={i === items.length - 1}
                  onLast={more}
                >
                  {render(item)}
                </PagedRow>
              ))}
            </Section>
          )}
          {pager.isFetchingNextPage ? (
            <Section>
              <HStack modifiers={[listRowBackground("clear")]}>
                <Spacer />
                <ProgressView />
                <Spacer />
              </HStack>
            </Section>
          ) : pager.isFetchNextPageError ? (
            <Section footer={<Text>{tm("generic")}</Text>}>
              <Button
                label={tm("retry")}
                onPress={() => void pager.fetchNextPage()}
              />
            </Section>
          ) : null}
        </List>
      </Host>
    </ScreenView>
  );
}

/** The last row asks for the next page when it appears. */
function PagedRow({
  last,
  onLast,
  children,
}: {
  last: boolean;
  onLast: () => void;
  children: ReactElement;
}) {
  return last ? (
    <VStack modifiers={[onAppear(onLast)]}>{children}</VStack>
  ) : (
    children
  );
}

/** React Native content as a list row of its own, on the page background. */
function Hosted({ children }: { children: ReactElement }) {
  return (
    <VStack
      modifiers={[
        listRowBackground("clear"),
        listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
      ]}
    >
      <RNHostView matchContents={{ vertical: true }}>{children}</RNHostView>
    </VStack>
  );
}

/** A tappable row: its lines, then the disclosure chevron. */
function Row({
  label,
  unread,
  onPress,
  children,
}: {
  label: string;
  unread: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      onPress={onPress}
      modifiers={[
        accessibilityLabel(label),
        ...(unread ? [listRowBackground(colors.brand50)] : []),
      ]}
    >
      <HStack spacing={12}>
        <VStack alignment="leading" spacing={4}>
          {children}
        </VStack>
        <Spacer />
        <Image
          systemName="chevron.right"
          color={colors.slate400}
          modifiers={[font({ textStyle: "footnote", weight: "semibold" })]}
        />
      </HStack>
    </Button>
  );
}

/** 「未読」: a dot plus the word, so it doesn't rely on colour alone. */
function Unread({ label }: { label: string }) {
  return (
    <HStack
      spacing={4}
      modifiers={[
        padding({ horizontal: 8, vertical: 2 }),
        background(colors.red50, shapes.capsule()),
      ]}
    >
      <Image systemName="circle.fill" color={colors.red600} size={7} />
      <Text
        modifiers={[
          font({ textStyle: "caption", weight: "semibold" }),
          foregroundStyle(colors.red700),
        ]}
      >
        {label}
      </Text>
    </HStack>
  );
}

function Pill({
  label,
  fg,
  bg,
  symbol,
}: {
  label: string;
  fg: string;
  bg: string;
  symbol?: "pin.fill";
}) {
  return (
    <HStack
      spacing={3}
      modifiers={[
        padding({ horizontal: 8, vertical: 2 }),
        background(bg, shapes.capsule()),
      ]}
    >
      {symbol ? <Image systemName={symbol} color={fg} size={10} /> : null}
      <Text
        modifiers={[
          font({ textStyle: "caption", weight: "semibold" }),
          foregroundStyle(fg),
        ]}
      >
        {label}
      </Text>
    </HStack>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { gap: space.md, paddingHorizontal: space.lg },
});
