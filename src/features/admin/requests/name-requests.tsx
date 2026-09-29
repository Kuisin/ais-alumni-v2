import type {
  AdminBirthDateRequest,
  AdminDecision,
  AdminGenderRequest,
  AdminNameDecisionBody,
  AdminNameRequest,
  AdminNameRequests,
  AdminRequestBase,
  AdminRequestTab,
} from "@contract/admin";
import { Stack } from "expo-router";
import { IdCard } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { isApiError } from "@/lib/api";
import { QueryState, Screen, Section, Text } from "@/ui";
import { Tabs } from "../parts";
import { useAdminNameRequests, useDecideNameRequest } from "./api";
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

/** The website's formatBirthDate (a calendar day, no time zone shift). */
function formatBirthDate(day: string, locale: "ja" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${day}T00:00:00Z`));
}

type Kind = AdminNameDecisionBody["kind"];

/**
 * 氏名・生年月日・性別の変更 (the website's /app/admin/name-requests):
 * requests waiting or decided, each with approve / reject. Committee admins.
 */
export function NameRequestsScreen() {
  const t = useTranslations("adminMembers.nameRequests");
  const [tab, setTab] = useState<AdminRequestTab>("pending");
  const [flash, setFlash] = useState<Flash | null>(null);
  const query = useAdminNameRequests(tab);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  const pendingCount = query.data?.pendingCount;
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
            count: k === "pending" ? pendingCount : undefined,
          }))}
        />
        <FlashNotice flash={flash} />
        <QueryState query={query}>
          {(data) => <Lists data={data} onDecided={setFlash} />}
        </QueryState>
      </Screen>
    </>
  );
}

function Lists({
  data,
  onDecided,
}: {
  data: AdminNameRequests;
  onDecided: (f: Flash) => void;
}) {
  const t = useTranslations("adminMembers");
  const empty =
    !data.names.length && !data.birthDates.length && !data.genders.length;
  return (
    <>
      {empty ? (
        <EmptyList
          tab={data.tab}
          icon={IdCard}
          title={t(
            data.tab === "pending"
              ? "nameRequests.emptyPending"
              : "nameRequests.emptyDecided",
          )}
          hint={
            data.tab === "pending" ? t("nameRequests.emptyHint") : undefined
          }
        />
      ) : null}
      {data.names.map((q) => (
        <NameCard key={q.id} q={q} onDecided={onDecided} />
      ))}
      {data.birthDates.length ? (
        <Section title={t("birthDateRequests.title")}>
          {data.birthDates.map((q) => (
            <BirthDateCard key={q.id} q={q} onDecided={onDecided} />
          ))}
        </Section>
      ) : null}
      {data.genders.length ? (
        <Section title={t("genderRequests.title")}>
          {data.genders.map((q) => (
            <GenderCard key={q.id} q={q} onDecided={onDecided} />
          ))}
        </Section>
      ) : null}
    </>
  );
}

function NameCard({
  q,
  onDecided,
}: {
  q: AdminNameRequest;
  onDecided: (f: Flash) => void;
}) {
  const tp = useTranslations("profile.nameRequest");
  const tn = useTranslations("common.names");
  const labels = {
    romaji: tn("romaji"),
    kanji: tn("kanjiShort"),
    kana: tn("kanaShort"),
    nameAtAis: tp("nameAtAis"),
  };
  return (
    <RequestCard>
      <RequestHeader q={q} />
      <View>
        {q.lines.map((l) => (
          <Change
            key={l.field}
            label={labels[l.field]}
            before={l.before ?? "—"}
            after={l.after ?? "—"}
          />
        ))}
      </View>
      <Reason label={tp("reason")} text={q.reason} />
      <Outcome q={q} kind="name" onDecided={onDecided} />
    </RequestCard>
  );
}

function BirthDateCard({
  q,
  onDecided,
}: {
  q: AdminBirthDateRequest;
  onDecided: (f: Flash) => void;
}) {
  const t = useTranslations("adminMembers.birthDateRequests");
  const tp = useTranslations("profile.nameRequest");
  const locale = useLocale() === "en" ? "en" : "ja";
  return (
    <RequestCard>
      <RequestHeader q={q} />
      <Change
        label={`${t("current")} → ${t("proposed")}`}
        before={q.current ? formatBirthDate(q.current, locale) : t("notSet")}
        after={formatBirthDate(q.proposed, locale)}
      />
      {q.reason ? <Reason label={tp("reason")} text={q.reason} /> : null}
      <Outcome q={q} kind="birthDate" onDecided={onDecided} />
    </RequestCard>
  );
}

function GenderCard({
  q,
  onDecided,
}: {
  q: AdminGenderRequest;
  onDecided: (f: Flash) => void;
}) {
  const t = useTranslations("adminMembers.genderRequests");
  const tp = useTranslations("profile.nameRequest");
  const tg = useTranslations("profile.photo.genders");
  const label = (v: string | null) => (v ? tg(v) : t("notSet"));
  return (
    <RequestCard>
      <RequestHeader q={q} />
      <Change
        label={`${t("current")} → ${t("proposed")}`}
        before={label(q.current)}
        after={label(q.proposed)}
      />
      {q.reason ? <Reason label={tp("reason")} text={q.reason} /> : null}
      <Outcome q={q} kind="gender" onDecided={onDecided} />
    </RequestCard>
  );
}

/** Pending: the decision form; decided: the outcome. */
function Outcome({
  q,
  kind,
  onDecided,
}: {
  q: AdminRequestBase;
  kind: Kind;
  onDecided: (f: Flash) => void;
}) {
  const tp = useTranslations("profile.nameRequest");
  if (q.status !== "PENDING")
    return <Decided q={q} statusLabel={tp(`status.${q.status}`)} />;
  return <NameDecision id={q.id} kind={kind} onDecided={onDecided} />;
}

function NameDecision({
  id,
  kind,
  onDecided,
}: {
  id: string;
  kind: Kind;
  onDecided: (f: Flash) => void;
}) {
  const t = useTranslations("adminMembers");
  const te = useTranslations("mobile.errors");
  const tc = useTranslations("common.errors");
  const decide = useDecideNameRequest(id);
  const labels: DecisionLabels = {
    legend: t("nameRequests.decision"),
    decisions: {
      APPROVE: t("nameRequests.decisions.APPROVE"),
      REJECT: t("nameRequests.decisions.REJECT"),
    },
    submit: {
      APPROVE: t("nameRequests.submit.APPROVE"),
      REJECT: t("nameRequests.submit.REJECT"),
    },
    noteOptional: t("nameRequests.noteOptional"),
    noteRequired: t("nameRequests.noteRequired"),
  };
  const onSubmit = async (decision: AdminDecision, note: string) => {
    try {
      const r = await decide.mutateAsync({ kind, decision, note });
      const text = t.has(r.message) ? t(r.message) : tc("forbidden");
      if (r.ok) {
        onDecided({ ok: true, text });
        return undefined;
      }
      return { error: text };
    } catch (e) {
      return {
        error: isApiError(e, "forbidden") ? tc("forbidden") : te("generic"),
      };
    }
  };
  return <DecisionForm labels={labels} onSubmit={onSubmit} />;
}
