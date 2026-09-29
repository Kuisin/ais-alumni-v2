import type {
  AdminDecision,
  AdminRequestBase,
  AdminRequestTab,
} from "@contract/admin";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  Circle,
  CircleDot,
  History,
  type LucideIcon,
} from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale } from "use-intl";
import { formatDateTime } from "@/lib/format";
import { nativeHref } from "@/lib/links";
import {
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  radius,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";
import { Notice } from "../parts";

export type Flash = { ok: boolean; text: string };

const localeOf = (l: string) => (l === "en" ? "en" : "ja");

/** Who asked (linked to their admin page once the app has one) and when. */
export function RequestHeader({
  q,
  extra,
}: {
  q: AdminRequestBase;
  extra?: string;
}) {
  const router = useRouter();
  const locale = localeOf(useLocale());
  const href = nativeHref(`/app/admin/members/${q.member.id}`);
  return (
    <View style={styles.header}>
      <View style={styles.who}>
        {href ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(href)}
            style={styles.link}
          >
            <Text weight="semibold" tone="brand">
              {q.member.name}
            </Text>
          </Pressable>
        ) : (
          <Text weight="semibold">{q.member.name}</Text>
        )}
        {extra ? (
          <Text variant="small" tone="muted">
            {extra}
          </Text>
        ) : null}
      </View>
      <Text variant="small" tone="subtle">
        {formatDateTime(q.createdAt, locale)}
      </Text>
    </View>
  );
}

/** before → after, the new value highlighted (unchanged: just the value). */
export function Change({
  before,
  after,
  label,
}: {
  before: string;
  after: string;
  label?: string;
}) {
  const changed = before !== after;
  return (
    <View style={styles.change}>
      {label ? (
        <Text variant="small" tone="muted" style={styles.changeLabel}>
          {label}
        </Text>
      ) : null}
      <View style={styles.changeValues}>
        {changed ? (
          <>
            <Text variant="small" tone="subtle" style={styles.strike}>
              {before}
            </Text>
            <ArrowRight
              size={14}
              color={colors.slate400}
              accessibilityLabel="→"
            />
            <Text variant="small" weight="medium" style={styles.mark}>
              {after}
            </Text>
          </>
        ) : (
          <Text variant="small">{after}</Text>
        )}
      </View>
    </View>
  );
}

/** 理由: … */
export function Reason({ label, text }: { label: string; text: string }) {
  return (
    <Text variant="small" tone="muted">
      <Text variant="small" weight="medium">
        {label}:{" "}
      </Text>
      {text}
    </Text>
  );
}

/** A decided request: status, who decided, when, and their note. */
export function Decided({
  q,
  statusLabel,
  showDate = false,
}: {
  q: AdminRequestBase;
  statusLabel: string;
  showDate?: boolean;
}) {
  const locale = localeOf(useLocale());
  return (
    <View style={styles.decided}>
      <Badge
        tone={q.status === "APPROVED" ? "green" : "red"}
        label={statusLabel}
      />
      {q.reviewer ? <Text variant="small">{q.reviewer}</Text> : null}
      {showDate && q.decidedAt ? (
        <Text variant="small" tone="subtle">
          {formatDateTime(q.decidedAt, locale)}
        </Text>
      ) : null}
      {q.reviewNote ? (
        <Text variant="small" tone="muted">
          — {q.reviewNote}
        </Text>
      ) : null}
    </View>
  );
}

export type DecisionLabels = {
  legend: string;
  decisions: Record<AdminDecision, string>;
  submit: Record<AdminDecision, string>;
  noteOptional: string;
  noteRequired: string;
};

/**
 * Approve or reject (the website's decision forms): choice, a note (sent to
 * the member; required to reject), submit. `onSubmit` resolves the result:
 * decided (the list reloads) or an error to show here.
 */
export function DecisionForm({
  labels,
  onSubmit,
}: {
  labels: DecisionLabels;
  onSubmit: (
    decision: AdminDecision,
    note: string,
  ) => Promise<{ error?: string; noteError?: string } | undefined>;
}) {
  const [decision, setDecision] = useState<AdminDecision>("APPROVE");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    setNoteError(null);
    const r = await onSubmit(decision, note.trim()).finally(() =>
      setBusy(false),
    );
    setError(r?.error ?? null);
    setNoteError(r?.noteError ?? null);
  };
  return (
    <View style={styles.form}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={labels.legend}
        style={styles.radios}
      >
        {(["APPROVE", "REJECT"] as const).map((d) => {
          const on = decision === d;
          const Icon = on ? CircleDot : Circle;
          return (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setDecision(d)}
              style={styles.radio}
            >
              <Icon
                size={20}
                color={on ? colors.brand700 : colors.slate400}
                aria-hidden
              />
              <Text variant="small">{labels.decisions[d]}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label={
          decision === "REJECT" ? labels.noteRequired : labels.noteOptional
        }
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={1000}
        textAlignVertical="top"
        style={styles.note}
        error={noteError}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        variant={decision === "REJECT" ? "danger" : "primary"}
        label={labels.submit[decision]}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}

/** The result of the last decision, above the list. */
export function FlashNotice({ flash }: { flash: Flash | null }) {
  if (!flash) return null;
  return <Notice tone={flash.ok ? "success" : "error"}>{flash.text}</Notice>;
}

/** Nothing in this tab (the pending tab's icon is the page's own). */
export function EmptyList({
  tab,
  icon: PendingIcon,
  title,
  hint,
}: {
  tab: AdminRequestTab;
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  const Icon = tab === "pending" ? PendingIcon : History;
  return (
    <EmptyState
      icon={<Icon size={28} color={colors.slate400} aria-hidden />}
      title={title}
      hint={hint}
    />
  );
}

export function RequestCard({ children }: { children: ReactNode }) {
  return <Card style={styles.card}>{children}</Card>;
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  who: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    flexShrink: 1,
  },
  link: { minHeight: TOUCH, justifyContent: "center" },
  change: { gap: 2 },
  changeLabel: {},
  changeValues: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  strike: { textDecorationLine: "line-through" },
  mark: {
    backgroundColor: colors.amber100,
    color: colors.slate900,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    overflow: "hidden",
  },
  decided: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  form: { gap: space.md },
  radios: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  radio: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  note: { minHeight: 72 },
});
