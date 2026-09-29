import type { Home } from "@contract/home";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useHome } from "@/features/home/api";
import { HomeEventCard } from "@/features/home/event-card";
import { LineBanner } from "@/features/home/line-banner";
import { HomeSection, MessagesBanner, TodoList } from "@/features/home/parts";
import { SetupChecklist } from "@/features/home/setup-checklist";
import { NewsCard } from "@/features/news/news-card";
import { PushPrompt } from "@/features/notifications/push-prompt";
import { useAuth, useMe } from "@/lib/auth";
import { EmptyState, ErrorState, Loading, Screen, Text } from "@/ui";

/**
 * ホーム (the website's /app/dashboard): what's waiting for the member,
 * the setup checklist (or, once it's done, the LINE banner), and the next
 * events and latest news.
 */
export default function HomeScreen() {
  const t = useTranslations("dashboard");
  const me = useMe();
  const { refreshMe } = useAuth();
  const query = useHome();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([query.refetch(), refreshMe()]).catch(() => {});
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text variant="heading" accessibilityRole="header">
        {t("greeting", { name: me.user.name })}
      </Text>
      {query.data ? (
        <HomeBody home={query.data} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <Loading inline />
      )}
    </Screen>
  );
}

function HomeBody({ home }: { home: Home }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  return (
    <>
      <TodoList todo={home.todo} />

      <PushPrompt />

      {/* Waiting on me first; the setup checklist after. */}
      {home.setup.complete ? (
        home.line ? (
          <LineBanner banner={home.line} />
        ) : null
      ) : (
        <SetupChecklist setup={home.setup} />
      )}

      {home.unreadMessages > 0 ? (
        <MessagesBanner count={home.unreadMessages} />
      ) : null}

      <HomeSection
        title={t("events.title")}
        more={t("events.more")}
        onMore={() => router.push("/events")}
      >
        {home.events.length === 0 ? (
          <EmptyState title={t("events.empty")} />
        ) : (
          home.events.map((e) => (
            <HomeEventCard
              key={e.id}
              event={e}
              onPress={() => router.push(`/events/${e.id}`)}
            />
          ))
        )}
      </HomeSection>

      <HomeSection
        title={t("news.title")}
        more={t("news.more")}
        onMore={() => router.push("/news")}
      >
        {home.news.length === 0 ? (
          <EmptyState title={t("news.empty")} />
        ) : (
          home.news.map((p) => (
            <NewsCard
              key={p.id}
              post={p}
              onPress={() => router.push(`/news/${p.id}`)}
            />
          ))
        )}
      </HomeSection>
    </>
  );
}
