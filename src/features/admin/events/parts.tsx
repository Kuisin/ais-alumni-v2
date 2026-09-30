import type {
  AdminApproval,
  AdminAudienceSummary,
  AdminEventDetail,
  AdminEventManage,
  AdminReceipt,
  AdminRsvpRow,
} from "@contract/admin-events";
import {
  BellRing,
  ChevronDown,
  CircleCheck,
  Search,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslations } from "use-intl";
import { Notice } from "@/features/events/parts";
import { confirmAction } from "@/features/me/confirm";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime, joinList } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  colors,
  font,
  Markdown,
  radius,
  space,
  Text,
  TOUCH,
} from "@/ui";
import {
  useApproveEvent,
  useSetRsvpClosed,
  useSetStaff,
  useStaffSearch,
} from "./api";

/**
 * The website's admin event pieces (src/components/admin/content-views,
 * news/approval-panel, admin/notification-opens-card,
 * events/event-staff-panel), natively.
 */

/** Wide enough for tables and side-by-side cards (the website's sm). */
export function useWide(): boolean {
  return useWindowDimensions().width >= 640;
}

/** A failed request, in words. */
export function useErrorText(): (e: unknown) => string {
  const tm = useTranslations("mobile.errors");
  return (e) =>
    e instanceof ApiError && e.status === 0 ? tm("network") : tm("generic");
}

/** 全員, or the groups / 学年 N / 個別 N人 badges (AudienceSummary). */
export function AudienceBadges({
  audience,
}: {
  audience: AdminAudienceSummary;
}) {
  const t = useTranslations("adminContent.audience");
  if (audience.everyone) return <Badge label={t("everyone")} />;
  return (
    <>
      {audience.groups.map((g) => (
        <Badge key={g} tone="brand" label={t(`groups.${g}`)} />
      ))}
      {audience.cohorts ? (
        <Badge
          tone="brand"
          label={`${t("summaryCohorts", { count: audience.cohorts })}${
            audience.includeParents ? ` · ${t("summaryParents")}` : ""
          }`}
        />
      ) : null}
      {audience.users ? (
        <Badge
          tone="brand"
          label={t("summaryUsers", { count: audience.users })}
        />
      ) : null}
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

/** Read-only event (EventView): the details before pressing 編集. */
export function EventView({ detail }: { detail: AdminEventDetail }) {
  const t = useTranslations("adminContent");
  const tc = useTranslations("common");
  const { locale } = useAuth();
  const e = detail.event;
  const none = (
    <Text variant="small" tone="subtle">
      {tc("notSet")}
    </Text>
  );
  return (
    <View style={styles.gap}>
      <Row label={t("events.titles")}>
        {e.titleJa ? (
          <Text weight="semibold" selectable>
            {e.titleJa}
          </Text>
        ) : null}
        {e.titleEn ? (
          <Text weight="semibold" selectable>
            {e.titleEn}
          </Text>
        ) : null}
      </Row>
      <Row label={t("fields.startsAt")}>
        <Text variant="small">
          {formatDateTime(e.startsAt, locale)}
          {e.endsAt ? ` – ${formatDateTime(e.endsAt, locale)}` : ""}
        </Text>
      </Row>
      <Row label={t("fields.location")}>
        {e.location ? (
          <Text variant="small" selectable>
            {e.location}
          </Text>
        ) : (
          none
        )}
      </Row>
      {e.mapUrl ? (
        <Row label={t("fields.mapUrl")}>
          <Text variant="small" selectable>
            {e.mapUrl}
          </Text>
        </Row>
      ) : null}
      <Row label={t("fields.capacity")}>
        {e.capacity === null ? (
          none
        ) : (
          <Text variant="small">{String(e.capacity)}</Text>
        )}
      </Row>
      <Row label={t("fields.rsvpDeadline")}>
        {e.rsvpDeadline ? (
          <Text variant="small">{formatDateTime(e.rsvpDeadline, locale)}</Text>
        ) : (
          none
        )}
      </Row>
      <Row label={t("events.audience")}>
        <View style={styles.badges}>
          <AudienceBadges audience={detail.audience} />
        </View>
      </Row>
      {[e.bodyJa, e.bodyEn].map((b, i) =>
        b ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed ja/en pair
          <View key={i} style={styles.body}>
            <Markdown source={b} />
          </View>
        ) : null,
      )}
    </View>
  );
}

/** 承認: waiting (with 承認する when allowed), or who approved it and when. */
export function ApprovalCard({
  id,
  approval,
  onApproved,
}: {
  id: string;
  approval: AdminApproval;
  onApproved: () => void;
}) {
  const t = useTranslations("adminContent.approval");
  const { locale } = useAuth();
  const approve = useApproveEvent(id);
  const errorText = useErrorText();
  return (
    <Card style={styles.gap}>
      <View style={styles.titleRow}>
        <ShieldCheck size={20} color={colors.brand700} aria-hidden />
        <Text variant="subheading" accessibilityRole="header">
          {t("title")}
        </Text>
      </View>
      {approval.approvedAt ? (
        <Text variant="small" tone="muted">
          {t("approved", {
            name: approval.approvedBy ?? "—",
            date: formatDateTime(approval.approvedAt, locale),
          })}
        </Text>
      ) : approval.canApprove ? (
        <>
          <Text variant="small" tone="muted">
            {t("ask")}
          </Text>
          <Button
            label={t("approve")}
            loading={approve.isPending}
            onPress={() =>
              approve.mutate(undefined, {
                onSuccess: (r) => {
                  if (r.approved) onApproved();
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
        <Text variant="small" tone="muted">
          {t("waiting")}
        </Text>
      )}
    </Card>
  );
}

/** 参加者: headcount, checked in and the counts per answer. */
export function AttendeeStats({
  manage,
  capacity,
}: {
  manage: AdminEventManage;
  capacity: number | null;
}) {
  const t = useTranslations("adminContent.attendees");
  const te = useTranslations("events.answer");
  const stat = (
    key: string,
    label: string,
    value: ReactNode,
    tone: "slate" | "green" = "slate",
  ) => (
    <View
      key={key}
      style={[styles.stat, tone === "green" ? styles.statGreen : null]}
    >
      <Text variant="small" tone="muted">
        {label}
      </Text>
      {value}
    </View>
  );
  return (
    <View style={styles.stats}>
      {stat(
        "headcount",
        t("headcount"),
        <Text variant="heading">
          {String(manage.headcount)}
          {capacity !== null ? (
            <Text variant="small">{` / ${capacity}`}</Text>
          ) : null}
        </Text>,
      )}
      {stat(
        "checkedIn",
        t("checkedIn"),
        <Text variant="heading">{String(manage.checkedIn)}</Text>,
        "green",
      )}
      {(["GOING", "MAYBE", "NOT_GOING"] as const).map((a) =>
        stat(
          a,
          te(a),
          <View>
            <Text variant="heading">{String(manage.summary[a].count)}</Text>
            {a !== "NOT_GOING" ? (
              <Text variant="caption" tone="muted">
                {t("plusGuests", { guests: manage.summary[a].guests })}
              </Text>
            ) : null}
          </View>,
        ),
      )}
    </View>
  );
}

/** 出欠の受付: status, with 締め切る / 再開する (CloseControl). */
export function CloseControl({
  id,
  closedAt,
  deadline,
}: {
  id: string;
  closedAt: string | null;
  deadline: string | null;
}) {
  const t = useTranslations("adminContent.events.rsvp");
  const tc = useTranslations("common");
  const { locale } = useAuth();
  const set = useSetRsvpClosed(id);
  const errorText = useErrorText();
  const past =
    !closedAt && deadline !== null && new Date(deadline) <= new Date();
  const status = closedAt
    ? t("closedManual", { time: formatDateTime(closedAt, locale) })
    : past
      ? t("closedDeadline")
      : deadline
        ? t("open", { time: formatDateTime(deadline, locale) })
        : t("open", { time: "" });

  const close = async () => {
    const ok = await confirmAction({
      title: t("close"),
      message: t("closeConfirm"),
      confirm: t("close"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) set.mutate({ close: true });
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
          onPress={() => set.mutate({ close: false })}
          style={styles.start}
        />
      ) : (
        <Button
          variant="danger"
          label={t("close")}
          loading={set.isPending}
          onPress={close}
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

const RECEIPT_LIMIT = 20;

/** 「通知の開封」: who got a reminder and who opened its link. */
export function OpensCard({
  opens,
}: {
  opens: NonNullable<AdminEventManage["opens"]>;
}) {
  const t = useTranslations("notifications.receipts");
  const { locale } = useAuth();
  const opened = opens.opened.length;
  const total = opened + opens.unopened.length;
  const percent =
    total > 0 ? Math.min(100, Math.round((opened / total) * 100)) : 0;
  const name = (r: AdminReceipt) =>
    `${r.name} · ${r.channels
      .map((c) => t(`channel.${c === "LINE" || c === "PUSH" ? c : "EMAIL"}`))
      .join("/")}`;
  return (
    <Card style={styles.gap}>
      <View style={styles.titleRow}>
        <BellRing size={20} color={colors.brand700} aria-hidden />
        <Text variant="subheading" accessibilityRole="header">
          {t("title")}
        </Text>
      </View>
      <View style={styles.gapSm}>
        <Text variant="heading">
          {t("openedOf", { opened, total })}
          <Text tone="subtle">{`  ${t("percent", { percent })}`}</Text>
        </Text>
        <View style={styles.meter} aria-hidden>
          <View
            style={[
              styles.meterFill,
              {
                width: `${percent}%`,
                backgroundColor:
                  percent === 100 ? colors.green600 : colors.brand700,
              },
            ]}
          />
        </View>
        <Text variant="caption" tone="subtle">
          {t("hint")}
        </Text>
      </View>
      <Text variant="small" weight="semibold">
        {t("opened")}
      </Text>
      <ReceiptList
        empty={t("noneOpened")}
        moreLabel={t("showAll", { count: opened - RECEIPT_LIMIT })}
        items={opens.opened.map((r) => ({
          key: r.userId,
          name: name(r),
          time: r.openedAt ? formatDateTime(r.openedAt, locale) : null,
        }))}
      />
      <Text variant="small" weight="semibold">
        {t("unopened")}
      </Text>
      <ReceiptList
        empty={t("allOpened")}
        moreLabel={t("showAll", {
          count: opens.unopened.length - RECEIPT_LIMIT,
        })}
        items={opens.unopened.map((r) => ({
          key: r.userId,
          name: name(r),
          time: null,
        }))}
      />
    </Card>
  );
}

function ReceiptList({
  items,
  moreLabel,
  empty,
}: {
  items: { key: string; name: string; time: string | null }[];
  moreLabel: string;
  empty: string;
}) {
  const [all, setAll] = useState(false);
  if (items.length === 0)
    return (
      <Text variant="small" tone="subtle">
        {empty}
      </Text>
    );
  const shown = all ? items : items.slice(0, RECEIPT_LIMIT);
  return (
    <View>
      {shown.map((i) => (
        <View key={i.key} style={styles.receipt}>
          <Text variant="small" style={styles.flex}>
            {i.name}
          </Text>
          {i.time ? (
            <Text variant="caption" tone="subtle">
              {i.time}
            </Text>
          ) : null}
        </View>
      ))}
      {!all && items.length > RECEIPT_LIMIT ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAll(true)}
          style={styles.more}
        >
          <ChevronDown size={16} color={colors.brand700} aria-hidden />
          <Text variant="small" weight="medium" tone="brand">
            {moreLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 受付スタッフ: names; 編集 opens search / remove (applies at once). */
export function StaffCard({
  id,
  staff,
}: {
  id: string;
  staff: AdminEventManage["staff"];
}) {
  const t = useTranslations("adminContent.staff");
  const ta = useTranslations("adminContent.audience");
  const tc = useTranslations("common");
  const { locale } = useAuth();
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const search = useStaffSearch(id, term);
  const setStaff = useSetStaff(id);
  const errorText = useErrorText();

  // Search 250 ms after typing stops, as the website does.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(q), 250);
    return () => clearTimeout(timer);
  }, [q]);

  const ids = new Set(staff.map((s) => s.id));
  const fresh = term.trim()
    ? (search.data ?? []).filter((r) => !ids.has(r.id))
    : null;

  const remove = async (m: { id: string; name: string }) => {
    const ok = await confirmAction({
      title: t("remove", { name: m.name }),
      message: t("removeConfirm", { name: m.name }),
      confirm: t("remove", { name: m.name }),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) setStaff.mutate({ userId: m.id, on: false });
  };

  return (
    <Card style={styles.gap}>
      <View style={styles.titleRow}>
        <Text
          variant="subheading"
          accessibilityRole="header"
          style={styles.flex}
        >
          {t("title")}
        </Text>
        <Button
          compact
          variant="ghost"
          label={editing ? tc("close") : t("edit")}
          onPress={() => {
            setEditing((v) => !v);
            setQ("");
          }}
        />
      </View>
      {!editing ? (
        staff.length ? (
          <Text variant="small">
            {joinList(
              staff.map((s) => s.name),
              locale,
            )}
          </Text>
        ) : (
          <Text variant="small" tone="subtle">
            {t("none")}
          </Text>
        )
      ) : (
        <View style={styles.gap}>
          <Text variant="small" tone="muted">
            {t("hint")}
          </Text>
          {staff.length ? (
            <View style={styles.chips}>
              {staff.map((m) => (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  accessibilityLabel={t("remove", { name: m.name })}
                  disabled={setStaff.isPending}
                  onPress={() => remove(m)}
                  style={({ pressed }) => [
                    styles.chip,
                    pressed ? styles.chipPressed : null,
                  ]}
                >
                  <Text variant="small" style={styles.chipText}>
                    {m.name}
                    {m.kanji ? (
                      <Text
                        variant="caption"
                        tone="brand"
                      >{` ${m.kanji}`}</Text>
                    ) : null}
                  </Text>
                  <X size={16} color={colors.brand800} aria-hidden />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text variant="small" tone="muted">
              {t("none")}
            </Text>
          )}
          <View style={styles.search}>
            <Search size={16} color={colors.slate400} aria-hidden />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t("add")}
              placeholderTextColor={colors.slate400}
              accessibilityLabel={t("add")}
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>
          <View accessibilityLiveRegion="polite">
            {fresh && fresh.length === 0 && !search.isFetching ? (
              <Text variant="small" tone="muted">
                {ta("noResults")}
              </Text>
            ) : null}
            {fresh?.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                disabled={setStaff.isPending}
                onPress={() =>
                  setStaff.mutate(
                    { userId: r.id, on: true },
                    { onSuccess: () => setQ("") },
                  )
                }
                style={({ pressed }) => [
                  styles.result,
                  pressed ? styles.resultPressed : null,
                ]}
              >
                <UserPlus size={16} color={colors.brand700} aria-hidden />
                <Text variant="small">
                  {r.name}
                  {r.kanji ? <Text tone="muted">{` ${r.kanji}`}</Text> : null}
                </Text>
              </Pressable>
            ))}
          </View>
          {setStaff.isError ? (
            <Notice tone="error">{errorText(setStaff.error)}</Notice>
          ) : null}
        </View>
      )}
    </Card>
  );
}

/**
 * 回答一覧: a table on wide screens (氏名 · 回答 · 同伴者 · 更新日時 ·
 * 受付済み), a list on phones.
 */
export function AttendeeList({ rsvps }: { rsvps: AdminRsvpRow[] }) {
  const t = useTranslations("adminContent.attendees");
  const te = useTranslations("events.answer");
  const { locale } = useAuth();
  const wide = useWide();

  if (rsvps.length === 0)
    return (
      <Text variant="small" tone="subtle" center>
        {t("empty")}
      </Text>
    );

  const checked = (r: AdminRsvpRow) =>
    r.checkedInAt ? (
      <View style={styles.checked}>
        <CircleCheck size={16} color={colors.green700} aria-hidden />
        <Text variant="small" tone="success">
          {formatDateTime(r.checkedInAt, locale)}
        </Text>
      </View>
    ) : (
      <Text variant="small">—</Text>
    );

  if (!wide)
    return (
      <View>
        {rsvps.map((r, i) => (
          <View
            key={r.id}
            style={[styles.item, i > 0 ? styles.itemBorder : null]}
          >
            <View style={styles.itemHead}>
              <Text weight="medium" style={styles.flex}>
                {r.name}
              </Text>
              <Badge
                tone={
                  r.answer === "GOING"
                    ? "green"
                    : r.answer === "MAYBE"
                      ? "amber"
                      : "slate"
                }
                label={te(r.answer)}
              />
            </View>
            <Text variant="small" tone="muted">
              {`${t("guests")} ${r.guests} · ${t("updated")} ${formatDateTime(
                r.updatedAt,
                locale,
              )}`}
            </Text>
            {r.checkedInAt ? checked(r) : null}
          </View>
        ))}
      </View>
    );

  return (
    <View accessibilityRole="list">
      <View style={[styles.tr, styles.thead]}>
        <Text variant="small" weight="medium" tone="muted" style={styles.cName}>
          {t("name")}
        </Text>
        <Text
          variant="small"
          weight="medium"
          tone="muted"
          style={styles.cAnswer}
        >
          {t("answer")}
        </Text>
        <Text
          variant="small"
          weight="medium"
          tone="muted"
          style={styles.cGuests}
        >
          {t("guests")}
        </Text>
        <Text variant="small" weight="medium" tone="muted" style={styles.cDate}>
          {t("updated")}
        </Text>
        <Text variant="small" weight="medium" tone="muted" style={styles.cDate}>
          {t("checkedIn")}
        </Text>
      </View>
      {rsvps.map((r) => (
        <View key={r.id} style={[styles.tr, styles.itemBorder]}>
          <Text variant="small" style={styles.cName}>
            {r.name}
          </Text>
          <Text variant="small" style={styles.cAnswer}>
            {te(r.answer)}
          </Text>
          <Text variant="small" style={styles.cGuests}>
            {String(r.guests)}
          </Text>
          <Text variant="small" tone="muted" style={styles.cDate}>
            {formatDateTime(r.updatedAt, locale)}
          </Text>
          <View style={styles.cDate}>{checked(r)}</View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  gapSm: { gap: space.sm },
  flex: { flex: 1 },
  start: { alignSelf: "flex-start" },
  row: { gap: 2 },
  rowValue: { gap: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  body: {
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: space.md,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stat: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 120,
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: space.md,
    gap: 2,
  },
  statGreen: { backgroundColor: colors.green50 },
  meter: {
    height: 12,
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
    overflow: "hidden",
  },
  meterFill: { height: "100%", borderRadius: radius.full },
  receipt: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slate100,
  },
  more: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: TOUCH,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: TOUCH,
    paddingLeft: space.md,
    paddingRight: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brand300,
    backgroundColor: colors.brand50,
  },
  chipPressed: { backgroundColor: colors.brand100 },
  chipText: { color: colors.brand900 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
  },
  searchInput: {
    flex: 1,
    minHeight: TOUCH,
    fontSize: font.size.md,
    color: colors.text,
  },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  resultPressed: { backgroundColor: colors.slate50 },
  checked: { flexDirection: "row", alignItems: "center", gap: space.xs },
  item: { paddingVertical: space.md, gap: 2 },
  itemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate100,
  },
  itemHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  thead: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slate200,
  },
  cName: { flex: 2 },
  cAnswer: { flex: 1 },
  cGuests: { width: 64 },
  cDate: { flex: 2 },
});
