import type {
  AdminNewsBadges,
  AdminNewsDetail,
  AdminNewsResponses,
} from "@contract/admin-news";
import type { Locale } from "@contract/core";
import { useRouter } from "expo-router";
import {
  BellRing,
  CheckCheck,
  ChevronDown,
  ListChecks,
  Send,
  ShieldCheck,
} from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { AudienceBadges, useErrorText } from "@/features/admin/events/parts";
import {
  IconCard,
  ReadMeter,
  ReceiptList,
  readPercent,
  receiptTime,
} from "@/features/admin/notify/receipts";
import { confirmAction } from "@/features/me/confirm";
import { Notice } from "@/features/news/parts";
import { formatDateTime, joinList } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  colors,
  Loading,
  Markdown,
  radius,
  space,
  Text,
  TOUCH,
} from "@/ui";
import {
  useApproveNews,
  useCloseNews,
  useNotifyEstimate,
  useNotifyNews,
} from "./api";

/** Pieces of the admin news screens (the website's news / admin components). */

/** Draft / Scheduled / Published, Awaiting approval, Notified, Pinned. */
export function StatusBadges({ post }: { post: AdminNewsBadges }) {
  const t = useTranslations("adminContent.news.status");
  const tone =
    post.status === "published"
      ? "green"
      : post.status === "scheduled"
        ? "amber"
        : "slate";
  return (
    <>
      <Badge tone={tone} label={t(post.status)} />
      {post.awaitingApproval ? (
        <Badge tone="amber" label={t("awaitingApproval")} />
      ) : null}
      {post.notified ? <Badge tone="brand" label={t("notified")} /> : null}
      {post.pinned ? <Badge tone="brand" label={t("pinned")} /> : null}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="small" weight="medium" tone="muted">
        {label}
      </Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

/** The ja / en bodies, each in a short scrolling box. */
function Bodies({ ja, en }: { ja: string | null; en: string | null }) {
  if (!ja && !en) return null;
  return (
    <View style={styles.bodies}>
      {[ja, en].map((b, i) =>
        b ? (
          <ScrollView
            key={i ? "en" : "ja"}
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            nestedScrollEnabled
          >
            <Markdown source={b} />
          </ScrollView>
        ) : null,
      )}
    </View>
  );
}

/** Read-only post (the website's NewsView, before pressing 編集). */
export function NewsView({
  view,
  cover,
}: {
  view: AdminNewsDetail["view"];
  /** the cover image element (resolved by the screen) */
  cover?: ReactNode;
}) {
  const t = useTranslations("adminContent");
  const locale = useLocale() as Locale;
  const asks = [
    view.requireConfirm ? t("hub.view.confirm") : null,
    view.poll !== null ? t("hub.view.poll", { question: view.poll }) : null,
    view.scheduleCount !== null
      ? t("hub.view.schedule", { count: view.scheduleCount })
      : null,
  ].filter((x): x is string => Boolean(x));
  return (
    <View style={styles.gap}>
      <Row label={t("news.titles")}>
        {view.titleJa ? <Text weight="semibold">{view.titleJa}</Text> : null}
        {view.titleEn ? <Text weight="semibold">{view.titleEn}</Text> : null}
      </Row>
      <Row label={t("news.delivery")}>
        <Text variant="small">
          {`${view.publishedAt ? formatDateTime(view.publishedAt, locale) : "—"} · ${
            view.notifyOnPublish ? t("news.notifyOn") : t("news.notifyOff")
          }${view.pinned ? ` · ${t("news.pinned")}` : ""}`}
        </Text>
      </Row>
      <Row label={t("sections.audience")}>
        <View style={styles.badges}>
          <AudienceBadges audience={view.audience} />
        </View>
      </Row>
      <Row label={t("sections.responses")}>
        <Text variant="small">
          {asks.length ? asks.join(" · ") : t("hub.view.none")}
        </Text>
        <Text variant="small" tone="muted">
          {view.allowComments
            ? t("hub.view.comments")
            : t("hub.view.commentsOff")}
        </Text>
        {view.deadline ? (
          <Text variant="small" tone="muted">
            {t("hub.results.deadline", {
              time: formatDateTime(view.deadline, locale),
            })}
          </Text>
        ) : null}
      </Row>
      {view.attachments.length ? (
        <Row label={t("sections.attachments")}>
          <Text variant="small">{joinList(view.attachments, locale)}</Text>
        </Row>
      ) : null}
      {cover}
      <Bodies ja={view.bodyJa} en={view.bodyEn} />
    </View>
  );
}

/**
 * Approval of a 同窓会委員's post: waiting (with 「承認する」 for another
 * 同窓会委員 or an admin), or who approved it and when.
 */
export function ApprovalPanel({
  id,
  approval,
  onApproved,
}: {
  id: string;
  approval: NonNullable<AdminNewsDetail["approval"]>;
  onApproved: () => void;
}) {
  const t = useTranslations("adminContent.approval");
  const locale = useLocale() as Locale;
  const approve = useApproveNews(id);
  const errorText = useErrorText();
  return (
    <IconCard
      icon={<ShieldCheck size={20} color={colors.brand700} aria-hidden />}
      title={t("title")}
    >
      {approval.approvedAt ? (
        <Text variant="small">
          {t("approved", {
            name: approval.approvedBy ?? "—",
            date: formatDateTime(approval.approvedAt, locale),
          })}
        </Text>
      ) : approval.canApprove ? (
        <>
          <Text variant="small">{t("ask")}</Text>
          <Button
            label={t("approve")}
            loading={approve.isPending}
            onPress={() =>
              approve.mutate(undefined, {
                onSuccess: (r) => {
                  if (r.path?.includes("approved=1")) onApproved();
                },
              })
            }
            style={styles.start}
          />
          {approve.isError ? (
            <Notice tone="error">{errorText(approve.error)}</Notice>
          ) : null}
        </>
      ) : (
        <Text variant="small">{t("waiting")}</Text>
      )}
    </IconCard>
  );
}

/**
 * 公開して通知 (the website's NotifyPanel): sent, or a button that opens
 * the confirm step with the estimated recipients before sending.
 */
export function NotifyPanel({
  id,
  status,
  notify,
  confirm,
  onConfirm,
  onSent,
}: {
  id: string;
  status: AdminNewsDetail["status"];
  notify: NonNullable<AdminNewsDetail["notify"]>;
  /** the confirm step is open (?notify=1) */
  confirm: boolean;
  onConfirm: (open: boolean) => void;
  onSent: () => void;
}) {
  const t = useTranslations("adminContent.notify");
  const locale = useLocale() as Locale;
  const open = confirm && !notify.notifiedAt;
  const estimate = useNotifyEstimate(id, open);
  const send = useNotifyNews(id);
  const errorText = useErrorText();
  const bell = (color: string) => (
    <BellRing size={20} color={color} aria-hidden />
  );

  if (notify.notifiedAt)
    return (
      <IconCard icon={bell(colors.brand700)} title={t("title")}>
        <Text variant="small">
          {t("alreadySent", {
            date: formatDateTime(notify.notifiedAt, locale),
          })}
        </Text>
      </IconCard>
    );

  if (!open)
    return (
      <IconCard icon={bell(colors.brand700)} title={t("title")}>
        <Text variant="small">
          {status === "scheduled" && notify.publishedAt
            ? t("scheduledHint", {
                date: formatDateTime(notify.publishedAt, locale),
              })
            : status === "draft"
              ? t("draftHint")
              : t("publishedHint")}
        </Text>
        <Text variant="caption" tone="subtle">
          {t("contentlessHint")}
        </Text>
        <Button
          variant="secondary"
          label={
            status === "published" ? t("notifyNow") : t("publishAndNotify")
          }
          icon={(c) => <Send size={16} color={c} aria-hidden />}
          onPress={() => onConfirm(true)}
        />
      </IconCard>
    );

  const est = estimate.data;
  return (
    <Card style={styles.confirm}>
      <View style={styles.heading}>
        {bell(colors.amber800)}
        <Text variant="subheading" accessibilityRole="header">
          {t("confirmTitle")}
        </Text>
      </View>
      {status !== "published" ? (
        <Notice tone="warning">{t("willPublishNow")}</Notice>
      ) : null}
      {est ? (
        <View style={styles.stats}>
          <Stat label={t("recipients")} value={est.recipients} />
          <Stat label={t("linePushes")} value={est.line} />
          <Stat label={t("emails")} value={est.email} />
          <Stat label={t("appPushes")} value={est.app} />
          <Stat label={t("unreachable")} value={est.unreachable} />
        </View>
      ) : estimate.isError ? (
        <Notice tone="error">{errorText(estimate.error)}</Notice>
      ) : (
        <Loading inline />
      )}
      <Text variant="caption" tone="subtle">
        {t("contentlessHint")}
      </Text>
      <Text variant="caption" tone="subtle">
        {t("quotaHint")}
      </Text>
      {send.isError ? (
        <Notice tone="error">{errorText(send.error)}</Notice>
      ) : null}
      <View style={styles.buttons}>
        <Button
          label={
            send.isPending
              ? t("sending")
              : t("confirm", { count: est?.recipients ?? 0 })
          }
          loading={send.isPending}
          disabled={!est}
          onPress={() =>
            send.mutate(undefined, {
              onSuccess: (r) => {
                onConfirm(false);
                if (r.path?.includes("notified=1")) onSent();
              },
            })
          }
        />
        <Button
          variant="ghost"
          label={t("cancel")}
          disabled={send.isPending}
          onPress={() => onConfirm(false)}
        />
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text variant="heading">{String(value)}</Text>
    </View>
  );
}

/** 回答の受付: status, with 締め切る / 再開する (CloseControl). */
export function CloseControl({
  id,
  close,
}: {
  id: string;
  close: NonNullable<AdminNewsDetail["close"]>;
}) {
  const t = useTranslations("adminContent.hub.close");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const set = useCloseNews(id);
  const errorText = useErrorText();
  const { closedAt, deadline } = close;
  const past =
    !closedAt && deadline !== null && new Date(deadline) <= new Date();
  const status = closedAt
    ? t("closedManual", { time: formatDateTime(closedAt, locale) })
    : past
      ? t("closedDeadline")
      : deadline
        ? t("open", { time: formatDateTime(deadline, locale) })
        : t("openNoDeadline", { time: "" });

  const onClose = async () => {
    const ok = await confirmAction({
      title: t("close"),
      message: t("closeConfirm"),
      confirm: t("close"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) set.mutate(true);
  };

  return (
    <Card style={styles.gapSm}>
      <Text weight="semibold" accessibilityRole="header">
        {t("title")}
      </Text>
      <Text variant="small">{status}</Text>
      {past ? null : closedAt ? (
        <Button
          variant="secondary"
          label={t("reopen")}
          loading={set.isPending}
          onPress={() => set.mutate(false)}
          style={styles.start}
        />
      ) : (
        <Button
          variant="danger"
          label={t("close")}
          loading={set.isPending}
          onPress={onClose}
          style={styles.start}
        />
      )}
      {set.isError ? (
        <Notice tone="error">{errorText(set.error)}</Notice>
      ) : null}
      <Text variant="caption" tone="subtle">
        {t("hint")}
      </Text>
    </Card>
  );
}

/** A folded list (the website's <details>). */
function Fold({
  label,
  children,
  small = false,
}: {
  label: string;
  children: ReactNode;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.fold}
      >
        <ChevronDown
          size={16}
          color={colors.slate600}
          aria-hidden
          style={open ? styles.flip : undefined}
        />
        <Text
          variant={small ? "caption" : "small"}
          weight={small ? "regular" : "semibold"}
          tone={small ? "muted" : "default"}
        >
          {label}
        </Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

const LIST_LIMIT = 20;

/** 回答状況: who confirmed / answered, poll and 日程調整 results. */
export function ResponsesCard({ r }: { r: AdminNewsResponses }) {
  const t = useTranslations("adminContent.hub.results");
  const ts = useTranslations("news.hub.schedule");
  const locale = useLocale() as Locale;
  return (
    <IconCard
      icon={<ListChecks size={20} color={colors.brand700} aria-hidden />}
      title={t("title")}
    >
      <ReadMeter
        size="lg"
        read={r.done}
        total={r.total}
        label={`${t("responded")} ${r.done} / ${r.total}`}
        percentLabel={`${readPercent(r.done, r.total)}%`}
      />
      {r.deadline ? (
        <View>
          <Text variant="small">
            {t("deadline", { time: formatDateTime(r.deadline, locale) })}
          </Text>
          <Text variant="caption" tone="subtle">
            {r.remindedAt
              ? t("reminded", {
                  time: formatDateTime(r.remindedAt, locale),
                })
              : t("reminderPlanned")}
          </Text>
        </View>
      ) : null}
      <Fold label={`${t("pendingList")}（${r.pending.length}）`}>
        <ReceiptList
          empty={t("none")}
          limit={LIST_LIMIT}
          moreLabel={`+${r.pending.length - LIST_LIMIT}`}
          items={r.pending.map((m) => ({ key: m.userId, name: m.name }))}
        />
      </Fold>
      {r.confirmed ? (
        <Fold label={`${t("confirmedList")}（${r.confirmed.length}）`}>
          <ReceiptList
            empty={t("none")}
            limit={LIST_LIMIT}
            moreLabel={`+${r.confirmed.length - LIST_LIMIT}`}
            items={r.confirmed.map((c) => ({
              key: c.userId,
              name: c.name,
              time: c.at ? formatDateTime(c.at, locale) : null,
            }))}
          />
        </Fold>
      ) : null}
      {r.polls.map((p) => (
        <View key={p.id} style={styles.poll}>
          <Text variant="small" weight="semibold">
            {p.question || ts("title")}
            <Text variant="small" tone="subtle" weight="regular">
              {`  ${t("voters", { count: p.voters })}`}
            </Text>
          </Text>
          {p.options.map((o) => (
            <View key={o.id} style={styles.option}>
              <View style={styles.optionHead}>
                <View style={styles.optionLabel}>
                  <Text variant="small">
                    {o.startsAt
                      ? `${formatDateTime(o.startsAt, locale)}${o.label ? ` ${o.label}` : ""}`
                      : o.label}
                  </Text>
                  {o.best ? <Badge tone="green" label={ts("best")} /> : null}
                </View>
                <Text variant="small" tone="muted">
                  {p.kind === "SCHEDULE"
                    ? ts("counts", { yes: o.yes, maybe: o.maybe, no: o.no })
                    : String(o.yes)}
                </Text>
              </View>
              {o.voters.length ? (
                <Fold label={t("votersList")} small>
                  <Text variant="caption" tone="muted">
                    {o.voters
                      .map(
                        (v) =>
                          `${p.kind === "SCHEDULE" ? `${ts(v.answer)} ` : ""}${v.name}`,
                      )
                      .join(locale === "ja" ? "、" : ", ")}
                  </Text>
                </Fold>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </IconCard>
  );
}

/** 既読: counts, a bar and who read it. */
export function ReadsCard({
  reads,
}: {
  reads: NonNullable<AdminNewsDetail["reads"]>;
}) {
  const t = useTranslations("adminContent.reads");
  const locale = useLocale() as Locale;
  const { read, audience, readers } = reads;
  return (
    <IconCard
      icon={<CheckCheck size={20} color={colors.brand700} aria-hidden />}
      title={t("title")}
    >
      <ReadMeter
        size="lg"
        read={read}
        total={audience}
        label={t("readOf", { read, audience })}
        percentLabel={t("percent", { percent: readPercent(read, audience) })}
      />
      <Text variant="caption" tone="subtle">
        {t("audienceHint")}
      </Text>
      <Text variant="small" weight="semibold" style={styles.sub}>
        {t("readers")}
      </Text>
      <ReceiptList
        empty={t("empty")}
        limit={LIST_LIMIT}
        moreLabel={t("showAll", { count: readers.length - LIST_LIMIT })}
        items={readers.map((r) => ({
          key: r.userId,
          name: r.name,
          time: r.at ? receiptTime(r.at, locale) : null,
        }))}
      />
      {read > readers.length ? (
        <Text variant="caption" tone="subtle">
          {t("truncated", { count: readers.length })}
        </Text>
      ) : null}
    </IconCard>
  );
}

/** 「会員画面で見る」 — the member's view of the post. */
export function ViewAsMember({ id }: { id: string }) {
  const t = useTranslations("adminContent.news");
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      compact
      label={t("viewAsMember")}
      onPress={() => router.push({ pathname: "/news/[id]", params: { id } })}
      style={styles.start}
    />
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  gapSm: { gap: space.sm },
  start: { alignSelf: "flex-start" },
  row: { gap: 2 },
  rowValue: { gap: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  bodies: { gap: space.md },
  body: {
    maxHeight: 288,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
  },
  bodyContent: { padding: space.md },
  confirm: { gap: space.md, borderColor: colors.amber400 },
  heading: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stat: {
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    padding: space.md,
  },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  fold: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  flip: { transform: [{ rotate: "180deg" }] },
  poll: {
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate200,
    paddingTop: space.md,
  },
  option: { gap: 2 },
  optionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  optionLabel: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.xs,
  },
  sub: { marginTop: space.sm },
});
