import type {
  AdminBroadcast,
  BroadcastEditResult,
} from "@contract/admin-notify";
import type { Locale } from "@contract/core";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Archive,
  ArchiveRestore,
  CheckCheck,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import {
  useArchiveBroadcast,
  useDeleteBroadcast,
  useEditBroadcast,
  useSentMessage,
} from "@/features/admin/notify/api";
import { useAudienceText } from "@/features/admin/notify/parts";
import {
  IconCard,
  NotificationOpensCard,
  ReadMeter,
  ReceiptList,
  readPercent,
  receiptTime,
} from "@/features/admin/notify/receipts";
import { confirmAction } from "@/features/me/confirm";
import { Notice } from "@/features/news/parts";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  colors,
  QueryState,
  radius,
  Screen,
  space,
  Text,
  TextField,
} from "@/ui";

/**
 * A sent message (the website's /app/admin/notify/[id]): its sender or an
 * admin sees who has read it, and may edit, archive or delete it.
 */
export default function SentMessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations("broadcast");
  const query = useSentMessage(id);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: t("detail.pageTitle") }} />
      <QueryState query={query}>
        {(b) => (
          <Screen refreshing={refreshing} onRefresh={refresh}>
            <Header b={b} />
            <BodyCard b={b} />
            <ManageCard b={b} />
            <ReceiptsCard b={b} />
            <NotificationOpensCard opens={b.opens} />
          </Screen>
        )}
      </QueryState>
    </>
  );
}

function Header({ b }: { b: AdminBroadcast }) {
  const t = useTranslations("broadcast");
  const locale = useLocale() as Locale;
  const audience = useAudienceText();
  const sender = b.position
    ? t("fromPosition", {
        name: b.senderName,
        position: t(`positions.${b.position}`),
      })
    : b.senderName;
  return (
    <View style={styles.header}>
      <Text variant="heading" accessibilityRole="header">
        {b.title}
      </Text>
      <Fact label={t("detail.sentAt")}>
        {formatDateTime(b.createdAt, locale)}
      </Fact>
      <Fact label={t("detail.audience")}>{audience(b.audience)}</Fact>
      <Fact label={t("detail.from")}>{sender}</Fact>
    </View>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fact}>
      <Text variant="small" tone="subtle" style={styles.factLabel}>
        {label}
      </Text>
      <Text variant="small" style={styles.factValue}>
        {children}
      </Text>
    </View>
  );
}

/** The body once; 編集 turns it into the form (the website's EditableCard). */
function BodyCard({ b }: { b: AdminBroadcast }) {
  const t = useTranslations("broadcast");
  const tm = useTranslations("broadcast.manage");
  const te = useTranslations("mobile.errors");
  const edit = useEditBroadcast(b.id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(b.title);
  const [body, setBody] = useState(b.body);
  const [result, setResult] = useState<BroadcastEditResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const err = (k: "title" | "body") =>
    result?.fieldErrors?.[k] ? tm(`errors.${result.fieldErrors[k]}`) : null;

  const open = () => {
    setTitle(b.title);
    setBody(b.body);
    setResult(null);
    setFailed(null);
    setEditing(true);
  };
  const save = () => {
    setFailed(null);
    edit.mutate(
      { title, body },
      {
        onSuccess: (r) => {
          setResult(r);
          if (r.ok) setEditing(false);
        },
        onError: (e) =>
          setFailed(
            e instanceof ApiError && e.status === 0
              ? te("network")
              : e instanceof ApiError && (e.status === 403 || e.status === 404)
                ? tm("errors.forbidden")
                : te("generic"),
          ),
      },
    );
  };

  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <Text
          variant="subheading"
          accessibilityRole="header"
          style={styles.flex}
        >
          {t("detail.body")}
        </Text>
        {editing ? null : (
          <Button
            variant="secondary"
            compact
            label={tm("edit")}
            icon={(c) => <Pencil size={16} color={c} aria-hidden />}
            onPress={open}
          />
        )}
      </View>
      {result?.ok && !editing ? (
        <Notice tone="success">{t(result.message)}</Notice>
      ) : null}
      {editing ? (
        <View style={styles.card}>
          <TextField
            label={`${tm("fieldTitle")} *`}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            error={err("title")}
          />
          <TextField
            label={`${tm("fieldBody")} *`}
            value={body}
            onChangeText={setBody}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            style={styles.bodyInput}
            hint={tm("editHint")}
            error={err("body")}
          />
          {result && !result.ok ? (
            <Notice tone="error">{t(result.message)}</Notice>
          ) : null}
          {failed ? <Notice tone="error">{failed}</Notice> : null}
          <View style={styles.buttons}>
            <Button
              label={tm("save")}
              loading={edit.isPending}
              onPress={save}
            />
            <Button
              variant="secondary"
              label={tm("cancel")}
              disabled={edit.isPending}
              onPress={() => setEditing(false)}
            />
          </View>
        </View>
      ) : (
        <Text variant="small" selectable>
          {b.body}
        </Text>
      )}
    </Card>
  );
}

/** Archive / restore and delete (the website's ManageMessage). */
function ManageCard({ b }: { b: AdminBroadcast }) {
  const t = useTranslations("broadcast.manage");
  const tc = useTranslations("common");
  const te = useTranslations("mobile.errors");
  const router = useRouter();
  const archive = useArchiveBroadcast(b.id);
  const remove = useDeleteBroadcast(b.id);
  const [failed, setFailed] = useState<string | null>(null);
  const onError = (e: unknown) =>
    setFailed(
      e instanceof ApiError && e.status === 0
        ? te("network")
        : e instanceof ApiError && (e.status === 403 || e.status === 404)
          ? t("errors.forbidden")
          : te("generic"),
    );

  const onDelete = async () => {
    const ok = await confirmAction({
      title: t("delete"),
      message: t("deleteConfirm"),
      confirm: t("delete"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    setFailed(null);
    remove.mutate(undefined, {
      onSuccess: () => {
        if (router.canGoBack()) router.back();
        else router.replace("/admin/notify");
      },
      onError,
    });
  };

  return (
    <Card style={styles.card}>
      <View style={styles.badges}>
        <Text variant="subheading" accessibilityRole="header">
          {t("title")}
        </Text>
        {b.archived ? <Badge tone="amber" label={t("archivedBadge")} /> : null}
        {b.edited ? <Badge label={t("editedBadge")} /> : null}
      </View>
      {b.archived ? (
        <Text variant="small" tone="muted">
          {t("archivedHint")}
        </Text>
      ) : null}
      {failed ? <Notice tone="error">{failed}</Notice> : null}
      <View style={styles.buttons}>
        <Button
          variant="secondary"
          label={b.archived ? t("restore") : t("archive")}
          icon={(c) =>
            b.archived ? (
              <ArchiveRestore size={16} color={c} aria-hidden />
            ) : (
              <Archive size={16} color={c} aria-hidden />
            )
          }
          loading={archive.isPending}
          onPress={() => {
            setFailed(null);
            archive.mutate(!b.archived, { onError });
          }}
        />
        <Button
          variant="danger"
          label={t("delete")}
          icon={(c) => <Trash2 size={16} color={c} aria-hidden />}
          loading={remove.isPending}
          onPress={onDelete}
        />
      </View>
    </Card>
  );
}

function ReceiptsCard({ b }: { b: AdminBroadcast }) {
  const t = useTranslations("broadcast.receipts");
  const locale = useLocale() as Locale;
  const read = b.receipts.read.length;
  const unread = b.receipts.unread.length;
  const total = read + unread;
  const more = (n: number) => t("showAll", { count: n - 20 });
  return (
    <IconCard
      icon={<CheckCheck size={20} color={colors.brand700} aria-hidden />}
      title={t("title")}
    >
      {total === 0 ? (
        <Notice tone="info">{t("legacy")}</Notice>
      ) : (
        <>
          <ReadMeter
            size="lg"
            read={read}
            total={total}
            label={t("readOf", { read, total })}
            percentLabel={t("percent", { percent: readPercent(read, total) })}
          />
          <ListHead
            icon={<Eye size={16} color={colors.brand700} aria-hidden />}
            label={t("read")}
            count={read}
          />
          <ReceiptList
            empty={t("noneRead")}
            moreLabel={more(read)}
            items={b.receipts.read.map((r) => ({
              key: r.userId,
              name: r.name,
              time: r.at ? receiptTime(r.at, locale) : null,
            }))}
          />
          <ListHead
            icon={<EyeOff size={16} color={colors.slate500} aria-hidden />}
            label={t("unread")}
            count={unread}
          />
          <ReceiptList
            empty={t("allRead")}
            moreLabel={more(unread)}
            items={b.receipts.unread.map((r) => ({
              key: r.userId,
              name: r.name,
            }))}
          />
        </>
      )}
    </IconCard>
  );
}

function ListHead({
  icon,
  label,
  count,
}: {
  icon: ReactNode;
  label: string;
  count: number;
}) {
  return (
    <View style={styles.listHead}>
      {icon}
      <Text variant="small" weight="semibold" accessibilityRole="header">
        {label}
      </Text>
      <View style={styles.pill}>
        <Text variant="caption" weight="medium" tone="muted">
          {String(count)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  fact: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md },
  factLabel: { minWidth: 72 },
  factValue: { flexShrink: 1 },
  card: { gap: space.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  bodyInput: { minHeight: 140 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  listHead: {
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  pill: {
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
    paddingHorizontal: space.sm,
    paddingVertical: 1,
  },
});
