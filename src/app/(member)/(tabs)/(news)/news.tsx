import type { MessageSummary, NewsSummary } from "@contract/news";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { type ReactElement, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { SegmentedTabs } from "@/features/events/parts";
import { useMessageList, useNewsList } from "@/features/news/api";
import { MessageFeed, NewsFeed } from "@/features/news/feed";
import { useMe } from "@/lib/auth";
import { Button, ErrorState, Loading, Text } from "@/ui";

type Tab = "news" | "messages";

/**
 * ニュース (the website's /app/news): pinned posts first, 10 per page,
 * loaded as the member scrolls. News authors get 「ニュースを作成」 at the
 * top of the list (/news/new), like イベント's 「イベントを作成」. While
 * messages are switched on (me.features.messages), a
 * second tab lists あなた宛ての連絡 (?tab=messages).
 */
export default function NewsScreen() {
  const me = useMe();
  const params = useLocalSearchParams<{ tab?: string }>();
  const messagesOn = me.features.messages;
  const wanted: Tab =
    messagesOn && params.tab === "messages" ? "messages" : "news";
  const [tab, setTab] = useState<Tab>(wanted);
  // Opened again from a link (Home's banner, a notification).
  useEffect(() => setTab(wanted), [wanted]);
  const t = useTranslations("news");
  const router = useRouter();
  const canCreate = useNewsList().data?.pages[0]?.canCreate ?? false;
  const segments = messagesOn ? (
    <SegmentedTabs
      label={t("tabs.label")}
      value={tab}
      onChange={setTab}
      items={[
        { key: "news", label: withCount(t("tabs.news"), me.badges.news) },
        {
          key: "messages",
          label: withCount(t("tabs.messages"), me.badges.messages),
        },
      ]}
    />
  ) : null;
  const tabs =
    canCreate || segments ? (
      <>
        {canCreate ? (
          <Button
            variant="secondary"
            label={t("create")}
            icon={(color) => <Plus size={20} color={color} aria-hidden />}
            onPress={() => router.push("/news/new")}
          />
        ) : null}
        {segments}
      </>
    ) : null;
  return tab === "messages" ? (
    <MessagesTab tabs={tabs} />
  ) : (
    <NewsTab tabs={tabs} />
  );
}

const withCount = (label: string, n: number) => (n ? `${label} ${n}` : label);

function NewsTab({ tabs }: { tabs: ReactElement | null }) {
  const t = useTranslations("news");
  const list = useNewsList();

  // Pages can shift while scrolling (a new post): show each post once.
  const seen = new Set<string>();
  const posts: NewsSummary[] = [];
  for (const page of list.data?.pages ?? [])
    for (const p of page.posts)
      if (!seen.has(p.id)) {
        seen.add(p.id);
        posts.push(p);
      }

  if (list.data === undefined)
    return list.isError ? (
      <ErrorState error={list.error} onRetry={() => list.refetch()} />
    ) : (
      <Loading />
    );

  return (
    <NewsFeed
      items={posts}
      pager={list}
      header={
        <>
          {tabs}
          <Text variant="small" tone="muted">
            {t("description")}
          </Text>
        </>
      }
    />
  );
}

/** あなた宛ての連絡 (20 per page, newest first). */
function MessagesTab({ tabs }: { tabs: ReactElement | null }) {
  const list = useMessageList(true);
  const seen = new Set<string>();
  const rows: MessageSummary[] = [];
  for (const page of list.data?.pages ?? [])
    for (const m of page.messages)
      if (!seen.has(m.id)) {
        seen.add(m.id);
        rows.push(m);
      }

  if (list.data === undefined)
    return list.isError ? (
      <ErrorState error={list.error} onRetry={() => list.refetch()} />
    ) : (
      <Loading />
    );

  return <MessageFeed items={rows} pager={list} header={tabs} />;
}
