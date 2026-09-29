import type { AdminEventDetail } from "@contract/admin-events";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Download,
  Eye,
  FileSpreadsheet,
  ListChecks,
  ScanLine,
  Trash2,
} from "lucide-react-native";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  adminEventKeys,
  useAdminEvent,
  useDeleteEvent,
} from "@/features/admin/events/api";
import { downloadFile } from "@/features/admin/events/download";
import {
  ApprovalCard,
  AttendeeList,
  AttendeeStats,
  CloseControl,
  EventView,
  OpensCard,
  StaffCard,
  useErrorText,
  useWide,
} from "@/features/admin/events/parts";
import { useComposeOptions } from "@/features/compose/api";
import { EventForm } from "@/features/compose/event-form";
import { Notice } from "@/features/events/parts";
import { confirmAction } from "@/features/me/confirm";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { Button, Card, colors, QueryState, space, Text } from "@/ui";

/**
 * One event in admin mode (the website's /app/admin/events/[id]): approval,
 * attendee counts and exports, closing RSVPs, reminder opens, 受付スタッフ,
 * the details (編集 / 削除) and every answer. Another 同窓会委員 checking
 * an event before approving it sees the details and approval only.
 */
export default function AdminEventScreen() {
  const { id, created } = useLocalSearchParams<{
    id: string;
    created?: string;
  }>();
  const t = useTranslations("adminContent.events");
  const ta = useTranslations("adminContent");
  const query = useAdminEvent(id);
  const [refreshing, setRefreshing] = useState(false);
  const [approved, setApproved] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const wide = useWide();

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: query.data?.title || t("edit") }} />
      <QueryState query={query}>
        {(detail) => (
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
            <Header detail={detail} />
            {created === "1" ? (
              <Notice tone="success">{t("created")}</Notice>
            ) : null}
            {approved ? (
              <Notice tone="success">{ta("approval.done")}</Notice>
            ) : null}
            {detail.canEdit && detail.manage ? (
              <View style={wide ? styles.columns : styles.stack}>
                <View style={wide ? styles.aside : styles.stack}>
                  {detail.approval ? (
                    <ApprovalCard
                      id={detail.id}
                      approval={detail.approval}
                      onApproved={() => setApproved(true)}
                    />
                  ) : null}
                  <AttendeesCard
                    detail={detail}
                    // 回答一覧 is the last card
                    onJump={() =>
                      scroll.current?.scrollToEnd({ animated: true })
                    }
                  />
                  <CloseControl
                    id={detail.id}
                    closedAt={detail.manage.rsvpClosedAt}
                    deadline={detail.manage.rsvpDeadline}
                  />
                  {detail.manage.opens ? (
                    <OpensCard opens={detail.manage.opens} />
                  ) : null}
                  <StaffCard id={detail.id} staff={detail.manage.staff} />
                </View>
                <View style={wide ? styles.main : styles.stack}>
                  <DetailsCard detail={detail} />
                  <Card style={styles.gap}>
                    <Text variant="subheading" accessibilityRole="header">
                      {ta("attendees.list")}
                    </Text>
                    <AttendeeList rsvps={detail.manage.rsvps} />
                  </Card>
                </View>
              </View>
            ) : (
              <View style={wide ? styles.columns : styles.stack}>
                {detail.approval ? (
                  <View style={wide ? styles.aside : styles.stack}>
                    <ApprovalCard
                      id={detail.id}
                      approval={detail.approval}
                      onApproved={() => setApproved(true)}
                    />
                  </View>
                ) : null}
                <View style={wide ? styles.main : styles.stack}>
                  <Card style={styles.gap}>
                    <Text variant="subheading" accessibilityRole="header">
                      {t("details")}
                    </Text>
                    <EventView detail={detail} />
                  </Card>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </QueryState>
    </>
  );
}

function Header({ detail }: { detail: AdminEventDetail }) {
  const t = useTranslations("adminContent.events");
  const router = useRouter();
  const { locale } = useAuth();
  return (
    <View style={styles.header}>
      <Text variant="heading" accessibilityRole="header" selectable>
        {detail.title || "—"}
      </Text>
      <Text variant="small" tone="muted">
        {formatDateTime(detail.startsAt, locale)}
      </Text>
      {detail.canEdit ? (
        <Button
          variant="secondary"
          compact
          label={t("viewAsMember")}
          icon={(c) => <Eye size={16} color={c} aria-hidden />}
          onPress={() =>
            router.push({ pathname: "/events/[id]", params: { id: detail.id } })
          }
          style={styles.start}
        />
      ) : null}
    </View>
  );
}

/** 参加者: counts, then 受付画面 / Excel / CSV / 回答一覧. */
function AttendeesCard({
  detail,
  onJump,
}: {
  detail: AdminEventDetail;
  onJump: () => void;
}) {
  const t = useTranslations("adminContent");
  const tm = useTranslations("mobile.admin.events");
  const router = useRouter();
  const { locale } = useAuth();
  const errorText = useErrorText();
  const [busy, setBusy] = useState<"csv" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const manage = detail.manage;
  if (!manage) return null;
  // The member-side check-in screen, when the app has it.
  const checkIn = hrefFor(`/app/events/${detail.id}/check-in`);

  const download = async (kind: "csv" | "xlsx") => {
    setBusy(kind);
    setError(null);
    try {
      const base = `/admin/events/${encodeURIComponent(detail.id)}`;
      await downloadFile(
        kind === "csv"
          ? {
              path: `${base}/csv`,
              mimeType: "text/csv",
              uti: "public.comma-separated-values-text",
              dialogTitle: t("attendees.csv"),
            }
          : {
              path: `${base}/xlsx?lang=${locale}`,
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              uti: "org.openxmlformats.spreadsheetml.sheet",
              dialogTitle: t("xlsx.download"),
            },
      );
    } catch (e) {
      setError(
        e instanceof Error && e.message === "sharing"
          ? tm("exportFailed")
          : errorText(e),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={styles.gap}>
      <Text variant="subheading" accessibilityRole="header">
        {t("attendees.title")}
      </Text>
      <AttendeeStats manage={manage} capacity={detail.event.capacity} />
      <View style={styles.actions}>
        {checkIn ? (
          <Button
            label={t("staff.open")}
            icon={(c) => <ScanLine size={16} color={c} aria-hidden />}
            onPress={() => router.push(checkIn)}
          />
        ) : null}
        <Button
          variant="secondary"
          label={t("xlsx.download")}
          loading={busy === "xlsx"}
          disabled={busy !== null}
          icon={(c) => <FileSpreadsheet size={16} color={c} aria-hidden />}
          onPress={() => download("xlsx")}
        />
        <Button
          variant="secondary"
          label={t("attendees.csv")}
          loading={busy === "csv"}
          disabled={busy !== null}
          icon={(c) => <Download size={16} color={c} aria-hidden />}
          onPress={() => download("csv")}
        />
        {manage.rsvps.length > 0 ? (
          <Button
            variant="ghost"
            label={t("attendees.jumpToList")}
            icon={(c) => <ListChecks size={16} color={c} aria-hidden />}
            onPress={onJump}
          />
        ) : null}
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Card>
  );
}

/** イベントの内容: read-only, with 削除 for the event's editors. */
function DetailsCard({ detail }: { detail: AdminEventDetail }) {
  const t = useTranslations("adminContent.events");
  const tc = useTranslations("common");
  const router = useRouter();
  const remove = useDeleteEvent(detail.id);
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const options = useComposeOptions();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const values = detail.manage?.values;

  const onDelete = async () => {
    const ok = await confirmAction({
      title: t("deleteTitle"),
      message: `${t("deleteConfirm")}\n${t("deleteHint")}`,
      confirm: tc("delete"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () =>
        router.dismissTo({
          pathname: "/admin/events",
          params: { deleted: "1" },
        }),
    });
  };

  const deleteButton = (
    <>
      <Button
        variant="danger"
        label={t("deleteTitle")}
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

  // The website's ViewEdit: the details, 編集 opens the event form.
  return (
    <Card style={styles.gap}>
      <View style={styles.titleRow}>
        <Text
          variant="subheading"
          accessibilityRole="header"
          style={styles.flex}
        >
          {t("details")}
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
            <EventForm
              values={values}
              options={o}
              onSaved={() => {
                setEditing(false);
                setSaved(true);
                void queryClient.invalidateQueries({
                  queryKey: adminEventKeys.all,
                });
              }}
              extraActions={deleteButton}
            />
          )}
        </QueryState>
      ) : (
        <EventView detail={detail} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  header: { gap: space.xs },
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
  actions: { gap: space.sm },
});
