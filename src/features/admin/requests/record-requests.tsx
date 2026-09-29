import type {
  AdminDecision,
  AdminRecordRequest,
  AdminRecordRequests,
  AdminRequestTab,
} from "@contract/admin";
import { Stack } from "expo-router";
import { ClipboardCheck } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { isApiError } from "@/lib/api";
import { QueryState, Screen, space, Text } from "@/ui";
import { Tabs } from "../parts";
import { useAdminRecordRequests, useDecideRecordRequest } from "./api";
import {
  Change,
  Decided,
  DecisionForm,
  type DecisionLabels,
  EmptyList,
  type Flash,
  FlashNotice,
  Reason,
  RequestCard,
  RequestHeader,
} from "./parts";

/**
 * 在籍情報の修正依頼 (the website's /app/admin/record-requests): each
 * request's before → after per field, approve (applied at once) or reject.
 * Committee admins.
 */
export function RecordRequestsScreen() {
  const t = useTranslations("records.admin");
  const [tab, setTab] = useState<AdminRequestTab>("pending");
  const [flash, setFlash] = useState<Flash | null>(null);
  const query = useAdminRecordRequests(tab);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Text variant="small" tone="muted">
          {t("description")}
        </Text>
        <Tabs
          label={t("tabsLabel")}
          value={tab}
          onChange={(k) => {
            setTab(k);
            setFlash(null);
          }}
          items={(["pending", "decided"] as const).map((k) => ({
            key: k,
            label: t(`tabs.${k}`),
            count: k === "pending" ? query.data?.pendingCount : undefined,
          }))}
        />
        <FlashNotice flash={flash} />
        <QueryState query={query}>
          {(data) => <List data={data} onDecided={setFlash} />}
        </QueryState>
      </Screen>
    </>
  );
}

function List({
  data,
  onDecided,
}: {
  data: AdminRecordRequests;
  onDecided: (f: Flash) => void;
}) {
  const t = useTranslations("records.admin");
  if (!data.requests.length)
    return (
      <EmptyList
        tab={data.tab}
        icon={ClipboardCheck}
        title={t(data.tab === "pending" ? "emptyPending" : "empty")}
        hint={t(
          data.tab === "pending" ? "emptyPendingHint" : "emptyDecidedHint",
        )}
      />
    );
  return (
    <>
      {data.requests.map((q) => (
        <RecordCard key={q.id} q={q} onDecided={onDecided} />
      ))}
    </>
  );
}

function RecordCard({
  q,
  onDecided,
}: {
  q: AdminRecordRequest;
  onDecided: (f: Flash) => void;
}) {
  const t = useTranslations("records");
  const tr = useTranslations("roles");
  // RecordValue: a teacher with no end year is still at AIS.
  const show = (field: string, v: string | null) =>
    v ??
    (field === "yearsTo" && q.role === "TEACHER" ? t("stillTeaching") : "—");
  return (
    <RequestCard>
      <RequestHeader q={q} extra={tr(`role.${q.role}`)} />
      <View style={styles.diff}>
        <Text variant="caption" tone="subtle">
          {t("diff.field")} · {t("diff.current")} → {t("diff.proposed")}
        </Text>
        {q.diff.map((d) => (
          <Change
            key={d.field}
            label={t(`fields.${d.field}`)}
            before={show(d.field, d.before)}
            after={show(d.field, d.after)}
          />
        ))}
      </View>
      <Reason label={t("reason")} text={q.reason} />
      {q.status === "PENDING" ? (
        <RecordDecision id={q.id} onDecided={onDecided} />
      ) : (
        <Decided q={q} statusLabel={t(`status.${q.status}`)} showDate />
      )}
    </RequestCard>
  );
}

function RecordDecision({
  id,
  onDecided,
}: {
  id: string;
  onDecided: (f: Flash) => void;
}) {
  const t = useTranslations("records");
  const te = useTranslations("mobile.errors");
  const decide = useDecideRecordRequest(id);
  const labels: DecisionLabels = {
    legend: t("admin.decision"),
    decisions: {
      APPROVE: t("admin.decisions.APPROVE"),
      REJECT: t("admin.decisions.REJECT"),
    },
    submit: {
      APPROVE: t("admin.submit.APPROVE"),
      REJECT: t("admin.submit.REJECT"),
    },
    noteOptional: t("admin.noteOptional"),
    noteRequired: t("admin.noteRequired"),
  };
  const onSubmit = async (decision: AdminDecision, note: string) => {
    try {
      const r = await decide.mutateAsync({ decision, note });
      const text = r.message && t.has(r.message) ? t(r.message) : te("generic");
      if (r.ok) {
        onDecided({ ok: true, text });
        return undefined;
      }
      return {
        error: text,
        noteError: r.fieldErrors?.reason
          ? t("fieldErrors.required")
          : undefined,
      };
    } catch (e) {
      return {
        error: isApiError(e, "forbidden")
          ? t("errors.forbidden")
          : te("generic"),
      };
    }
  };
  return <DecisionForm labels={labels} onSubmit={onSubmit} />;
}

const styles = StyleSheet.create({
  diff: { gap: space.xs },
});
