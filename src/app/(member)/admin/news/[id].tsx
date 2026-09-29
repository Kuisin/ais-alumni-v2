import type { AdminNewsDetail } from "@contract/admin-news";
import type { ComposeSaved } from "@contract/compose";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Archive, ArchiveRestore, Eye, Trash2 } from "lucide-react-native";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useErrorText, useWide } from "@/features/admin/events/parts";
import {
  adminNewsKeys,
  useAdminNews,
  useArchiveNews,
  useDeleteNews,
} from "@/features/admin/news/api";
import {
  ApprovalPanel,
  CloseControl,
  NewsView,
  NotifyPanel,
  ReadsCard,
  ResponsesCard,
  StatusBadges,
} from "@/features/admin/news/parts";
import { NotificationOpensCard } from "@/features/admin/notify/receipts";
import { useComposeOptions } from "@/features/compose/api";
import { NewsForm } from "@/features/compose/news-form";
import { confirmAction } from "@/features/me/confirm";
import { Notice } from "@/features/news/parts";
import { absoluteUrl } from "@/lib/config";
import {
  Badge,
  Button,
  Card,
  colors,
  QueryState,
  radius,
  space,
  Text,
} from "@/ui";

type Flags = {
  created?: string;
  notify?: string;
  notified?: string;
  approved?: string;
};

/**
 * One post in admin mode (the website's /app/admin/news/[id]): approval,
 * 公開して通知 (with its confirm step), 回答の受付, 回答状況, 既読 and
 * 通知の開封 beside the details (編集 opens the news form, with 削除).
 * Another 同窓会委員 checking a post before approving it sees the details
 * and approval only.
 */
export default function AdminNewsPostScreen() {
  const params = useLocalSearchParams<Flags & { id: string }>();
  const { id } = params;
  const t = useTranslations("adminContent");
  const query = useAdminNews(id);
  const wide = useWide();
  const scroll = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  // The website's ?created=1 / ?notify=1 / ?notified=1 / ?approved=1.
  const [flags, setFlags] = useState<Flags>(() => ({
    created: params.created,
    notify: params.notify,
    notified: params.notified,
    approved: params.approved,
  }));
  const set = (f: Flags) => setFlags((prev) => ({ ...prev, ...f }));

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: query.data?.title || t("news.edit") }} />
      <QueryState query={query}>
        {(post) => {
          const aside = (
            <>
              {post.approval ? (
                <ApprovalPanel
                  id={post.id}
                  approval={post.approval}
                  onApproved={() => set({ approved: "1" })}
                />
              ) : null}
              {!post.canEdit ? null : post.archived ? (
                <Notice tone="warning">{t("news.archivedHint")}</Notice>
              ) : post.notify ? (
                <NotifyPanel
                  id={post.id}
                  status={post.status}
                  notify={post.notify}
                  confirm={flags.notify === "1"}
                  onConfirm={(open) =>
                    set({ notify: open ? "1" : undefined, notified: undefined })
                  }
                  onSent={() => set({ notified: "1" })}
                />
              ) : null}
              {post.close ? (
                <CloseControl id={post.id} close={post.close} />
              ) : null}
              {post.responses ? <ResponsesCard r={post.responses} /> : null}
              {post.reads ? <ReadsCard reads={post.reads} /> : null}
              <NotificationOpensCard opens={post.opens} />
            </>
          );
          return (
            <ScrollView
              ref={scroll}
              style={styles.screen}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
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
              <Header post={post} />
              {flags.created === "1" ? (
                <Notice tone="success">{t("news.created")}</Notice>
              ) : null}
              {flags.notified === "1" ? (
                <Notice tone="success">{t("notify.sent")}</Notice>
              ) : null}
              {flags.approved === "1" ? (
                <Notice tone="success">{t("approval.done")}</Notice>
              ) : null}
              {/* The notify panel first on phones (before the long form);
                  a right column on wide screens. */}
              <View style={wide ? styles.columns : styles.stack}>
                <View style={wide ? styles.aside : styles.stack}>{aside}</View>
                <View style={wide ? styles.main : styles.stack}>
                  <DetailsCard
                    post={post}
                    onSaved={(saved) => {
                      if (saved.next === "notify") {
                        set({ notify: "1", notified: undefined });
                        scroll.current?.scrollTo({ y: 0, animated: true });
                      }
                    }}
                  />
                </View>
              </View>
            </ScrollView>
          );
        }}
      </QueryState>
    </>
  );
}

function Header({ post }: { post: AdminNewsDetail }) {
  const t = useTranslations("adminContent.news");
  const router = useRouter();
  const archive = useArchiveNews(post.id);
  const errorText = useErrorText();
  return (
    <View style={styles.header}>
      <Text variant="heading" accessibilityRole="header" selectable>
        {post.title || "—"}
      </Text>
      <View style={styles.badges}>
        <StatusBadges post={post} />
        {post.archived ? (
          <Badge tone="amber" label={t("archivedBadge")} />
        ) : null}
      </View>
      {post.canEdit ? (
        <View style={styles.actions}>
          {post.viewAsMember ? (
            <Button
              variant="secondary"
              compact
              label={t("viewAsMember")}
              icon={(c) => <Eye size={16} color={c} aria-hidden />}
              onPress={() =>
                router.push({ pathname: "/news/[id]", params: { id: post.id } })
              }
            />
          ) : null}
          <Button
            variant="secondary"
            compact
            label={post.archived ? t("restore") : t("archive")}
            icon={(c) =>
              post.archived ? (
                <ArchiveRestore size={16} color={c} aria-hidden />
              ) : (
                <Archive size={16} color={c} aria-hidden />
              )
            }
            loading={archive.isPending}
            onPress={() => archive.mutate(!post.archived)}
          />
        </View>
      ) : null}
      {archive.isError ? (
        <Notice tone="error">{errorText(archive.error)}</Notice>
      ) : null}
    </View>
  );
}

/** ニュースの内容: read-only; 編集 opens the news form (with 削除). */
function DetailsCard({
  post,
  onSaved,
}: {
  post: AdminNewsDetail;
  onSaved: (saved: ComposeSaved) => void;
}) {
  const t = useTranslations("adminContent");
  const tc = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const options = useComposeOptions();
  const remove = useDeleteNews(post.id);
  const errorText = useErrorText();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const values = post.values;

  const onDelete = async () => {
    const ok = await confirmAction({
      title: t("news.deleteTitle"),
      message: t("news.deleteConfirm"),
      confirm: tc("delete"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () =>
        router.dismissTo({ pathname: "/admin/news", params: { deleted: "1" } }),
    });
  };

  const deleteButton = (
    <>
      <Button
        variant="danger"
        label={t("news.deleteTitle")}
        loading={remove.isPending}
        icon={(c) => <Trash2 size={16} color={c} aria-hidden />}
        onPress={onDelete}
        style={styles.start}
      />
      {remove.isError ? (
        <Notice tone="error">{errorText(remove.error)}</Notice>
      ) : null}
    </>
  );

  return (
    <Card style={styles.gap}>
      <View style={styles.titleRow}>
        <Text
          variant="subheading"
          accessibilityRole="header"
          style={styles.flex}
        >
          {t("news.details")}
        </Text>
        {values ? (
          <Button
            compact
            variant={editing ? "ghost" : "secondary"}
            label={editing ? tc("cancel") : tc("edit")}
            onPress={() => {
              setEditing((e) => !e);
              setSaved(false);
            }}
          />
        ) : null}
      </View>
      {saved ? <Notice tone="success">{tc("saved")}</Notice> : null}
      {editing && values ? (
        <QueryState query={options}>
          {(o) => (
            <NewsForm
              values={values}
              options={o}
              onSaved={(s) => {
                setEditing(false);
                setSaved(s.next !== "notify");
                void queryClient.invalidateQueries({
                  queryKey: adminNewsKeys.all,
                });
                onSaved(s);
              }}
              extraActions={deleteButton}
            />
          )}
        </QueryState>
      ) : (
        <NewsView
          view={post.view}
          cover={
            post.view.cover ? (
              <Image
                source={{ uri: absoluteUrl(post.view.cover) }}
                style={styles.cover}
                contentFit="cover"
                accessibilityLabel={t("fields.currentCover")}
              />
            ) : null
          }
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  header: { gap: space.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  start: { alignSelf: "flex-start" },
  gap: { gap: space.md },
  stack: { gap: space.lg },
  columns: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: space.lg,
  },
  aside: { width: 320, gap: space.lg },
  main: { flex: 1, minWidth: 0, gap: space.lg },
  cover: {
    width: "100%",
    maxWidth: 480,
    height: 192,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
