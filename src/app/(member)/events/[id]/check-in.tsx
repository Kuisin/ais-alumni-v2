import type {
  CheckInAttendee,
  CheckInBoard,
  CheckInCandidate,
  CheckInResult,
} from "@contract/events";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { CircleAlert, CircleCheck, Search, Undo2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import {
  checkIn,
  checkInKey,
  eventKeys,
  searchCheckIn,
  undoCheckIn,
  useCheckInBoard,
} from "@/features/events/api";
import { Notice } from "@/features/events/parts";
import { Scanner } from "@/features/events/scanner";
import { confirmAction } from "@/features/me/confirm";
import { isApiError } from "@/lib/api";
import { formatDateTime, formatTime } from "@/lib/format";
import {
  Button,
  Card,
  colors,
  QueryState,
  radius,
  Screen,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";

type Filter = "all" | "waiting" | "done";

/**
 * Reception at an event (the website's /app/events/[id]/check-in): staff
 * scan QR tickets with the camera, type a code, or tick people off the
 * list; walk-ins are found by name. A ticket link opened from a phone's
 * camera app (?t=…) checks that ticket in at once.
 */
export default function CheckInScreen() {
  const { id, t: token } = useLocalSearchParams<{ id: string; t?: string }>();
  const t = useTranslations("events");
  const query = useCheckInBoard(id);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  // Not staff for this event: the website's message instead of the board.
  if (!query.data && isApiError(query.error, "forbidden"))
    return (
      <>
        <Stack.Screen options={{ title: t("checkIn.title") }} />
        <Screen>
          <Notice tone="warning">{t("checkIn.staffOnly")}</Notice>
        </Screen>
      </>
    );

  return (
    <>
      <Stack.Screen options={{ title: t("checkIn.title") }} />
      <QueryState query={query}>
        {(board) => (
          <Screen refreshing={refreshing} onRefresh={refresh}>
            <Board board={board} token={token ?? null} />
          </Screen>
        )}
      </QueryState>
    </>
  );
}

function Board({
  board,
  token,
}: {
  board: CheckInBoard;
  token: string | null;
}) {
  const t = useTranslations("events.checkIn");
  const te = useTranslations("events");
  const tm = useTranslations("mobile.errors");
  const tc = useTranslations("common");
  const locale = useLocale() === "en" ? "en" : "ja";
  const queryClient = useQueryClient();
  const [people, setPeople] = useState<CheckInAttendee[]>(board.attendees);
  const [result, setResult] = useState<CheckInResult | "network" | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<Filter>("all");
  const [code, setCode] = useState("");

  // A refresh brings the server's list.
  useEffect(() => setPeople(board.attendees), [board.attendees]);

  const apply = useCallback(
    (r: CheckInResult) => {
      setResult(r);
      if (r.status !== "ok" && r.status !== "already") return;
      setPeople((list) => {
        const rest = list.filter((p) => p.id !== r.userId);
        const prev = list.find((p) => p.id === r.userId);
        return [
          ...rest,
          {
            id: r.userId,
            name: r.name,
            kanji: r.kanji,
            answer: r.answer,
            guests: r.guests,
            ...prev,
            checkedInAt: r.at,
          },
        ].sort((a, b) => a.name.localeCompare(b.name));
      });
      // The member's own ticket shows 受付済み.
      void queryClient.invalidateQueries({
        queryKey: eventKeys.detail(board.id),
      });
    },
    [queryClient, board.id],
  );

  const run = useCallback(
    async (body: Parameters<typeof checkIn>[1]) => {
      setBusy(true);
      try {
        apply(await checkIn(board.id, body));
      } catch (e) {
        setResult(
          isApiError(e) && e.status === 0 ? "network" : { status: "invalid" },
        );
      } finally {
        setBusy(false);
      }
    },
    [apply, board.id],
  );

  // Opened from a ticket link: check that ticket in.
  const opened = useRef(false);
  useEffect(() => {
    if (token && !opened.current) {
      opened.current = true;
      void run({ ticket: token });
    }
  }, [token, run]);

  const undo = async (p: CheckInAttendee) => {
    const ok = await confirmAction({
      title: t("list.undoConfirm", { name: p.name }),
      confirm: t("list.undo"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    const r = await undoCheckIn(board.id, p.id).catch(() => ({ ok: false }));
    if (!r.ok) return;
    setResult(null);
    setPeople((list) =>
      list
        .map((x) => (x.id === p.id ? { ...x, checkedInAt: null } : x))
        // A walk-in without an RSVP leaves the list again.
        .filter((x) => x.answer !== null || x.checkedInAt !== null),
    );
    void queryClient.invalidateQueries({
      queryKey: eventKeys.detail(board.id),
    });
    void queryClient.invalidateQueries({ queryKey: checkInKey(board.id) });
  };

  const done = people.filter((p) => p.checkedInAt);
  const going = people.filter((p) => p.answer === "GOING");
  const maybe = people.filter((p) => p.answer === "MAYBE");
  const term = filter.trim().toLowerCase();
  const shown = people.filter(
    (p) =>
      (view === "all" || (view === "done" ? p.checkedInAt : !p.checkedInAt)) &&
      (!term || p.name.toLowerCase().includes(term) || p.kanji?.includes(term)),
  );
  const title = board.title.text || te("untitled");

  return (
    <>
      <View>
        <Text variant="subheading" selectable>
          {title}
        </Text>
        <Text variant="small" tone="muted">
          {formatDateTime(board.startsAt, locale)}
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat label={t("stats.checkedIn")} value={done.length} strong />
        <Stat
          label={t("stats.expected")}
          value={going.length}
          sub={going.reduce((n, p) => n + p.guests, 0)}
        />
        <Stat label={t("stats.maybe")} value={maybe.length} />
      </View>

      <View accessibilityLiveRegion="assertive">
        {result === "network" ? (
          <Notice tone="error">{tm("network")}</Notice>
        ) : result ? (
          <ResultBanner result={result} />
        ) : null}
      </View>

      <Card style={styles.card}>
        <Text variant="subheading" accessibilityRole="header">
          {t("scan.title")}
        </Text>
        <Scanner onScan={(text) => void run({ ticket: text })} paused={busy} />
        <View style={styles.row}>
          <View style={styles.grow}>
            <TextField
              accessibilityLabel={t("scan.manual")}
              placeholder={t("scan.manual")}
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (code.trim())
                  void run({ ticket: code }).then(() => setCode(""));
              }}
            />
          </View>
          <Button
            variant="secondary"
            label={t("scan.manualSubmit")}
            disabled={busy || !code.trim()}
            onPress={() => void run({ ticket: code }).then(() => setCode(""))}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="subheading" accessibilityRole="header">
          {t("list.title")}
        </Text>
        <View>
          <TextField
            accessibilityLabel={t("list.filter")}
            placeholder={t("list.filter")}
            value={filter}
            onChangeText={setFilter}
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.searchInput}
          />
          <View style={styles.searchIcon} pointerEvents="none">
            <Search size={16} color={colors.slate400} aria-hidden />
          </View>
        </View>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {(["all", "waiting", "done"] as const).map((v) => {
            const n =
              v === "all"
                ? people.length
                : v === "done"
                  ? done.length
                  : people.length - done.length;
            const on = view === v;
            return (
              <Pressable
                key={v}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setView(v)}
                style={[styles.chip, on ? styles.chipOn : null]}
              >
                <Text
                  variant="small"
                  weight={on ? "semibold" : "regular"}
                  style={on ? styles.chipOnText : undefined}
                >
                  {t(`list.${v}`)}
                  <Text variant="small" tone="subtle">{` ${n}`}</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
        {shown.length === 0 ? (
          <Text variant="small" tone="muted">
            {t("list.empty")}
          </Text>
        ) : (
          <View>
            {shown.map((p) => (
              <View key={p.id} style={styles.person}>
                <View style={styles.grow}>
                  <Text weight="medium">
                    {p.name}
                    {p.kanji ? (
                      <Text variant="small" tone="muted">{`  ${p.kanji}`}</Text>
                    ) : null}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {p.answer ? te(`answer.${p.answer}`) : t("result.walkIn")}
                    {p.guests
                      ? ` · ${t("result.guests", { count: p.guests })}`
                      : ""}
                    {p.checkedInAt
                      ? ` · ${t("list.at", { time: formatTime(p.checkedInAt, locale) })}`
                      : ""}
                  </Text>
                </View>
                {p.checkedInAt ? (
                  <View style={styles.row}>
                    <CircleCheck
                      size={20}
                      color={colors.green700}
                      accessibilityLabel={t("list.done")}
                    />
                    <Button
                      variant="ghost"
                      compact
                      label={t("list.undo")}
                      accessibilityLabel={`${t("list.undo")}: ${p.name}`}
                      icon={(c) => <Undo2 size={16} color={c} aria-hidden />}
                      onPress={() => void undo(p)}
                    />
                  </View>
                ) : (
                  <Button
                    compact
                    label={t("list.checkIn")}
                    accessibilityLabel={`${t("list.checkIn")}: ${p.name}`}
                    disabled={busy}
                    onPress={() => void run({ userId: p.id })}
                  />
                )}
              </View>
            ))}
          </View>
        )}
      </Card>

      <WalkIn
        eventId={board.id}
        known={people}
        busy={busy}
        onPick={(userId) => run({ userId })}
      />
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  strong,
}: {
  label: string;
  value: number;
  sub?: number;
  strong?: boolean;
}) {
  const t = useTranslations("events.checkIn");
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${value}`}
      style={[styles.stat, strong ? styles.statStrong : null]}
    >
      <Text variant="caption" tone="muted" center>
        {label}
      </Text>
      <Text variant="heading" center>
        {value}
      </Text>
      {sub ? (
        <Text variant="caption" tone="muted" center>
          {t("result.guests", { count: sub })}
        </Text>
      ) : null}
    </View>
  );
}

function ResultBanner({ result }: { result: CheckInResult }) {
  const t = useTranslations("events.checkIn.result");
  const te = useTranslations("events");
  const locale = useLocale() === "en" ? "en" : "ja";
  if (result.status === "ok" || result.status === "already") {
    const ok = result.status === "ok";
    const fg = ok ? colors.white : colors.amber900;
    return (
      <View
        accessibilityRole="alert"
        style={[styles.banner, ok ? styles.bannerOk : styles.bannerAlready]}
      >
        {ok ? (
          <CircleCheck size={28} color={fg} aria-hidden />
        ) : (
          <CircleAlert size={28} color={fg} aria-hidden />
        )}
        <View style={styles.grow}>
          <Text variant="small" weight="semibold" style={{ color: fg }}>
            {ok
              ? t("ok")
              : t("already", { time: formatTime(result.at, locale) })}
          </Text>
          <Text variant="heading" style={{ color: fg }}>
            {result.name}
            {result.kanji ? (
              <Text variant="body" style={{ color: fg }}>
                {`  ${result.kanji}`}
              </Text>
            ) : null}
          </Text>
          <Text variant="small" style={{ color: fg }}>
            {result.answer ? te(`answer.${result.answer}`) : t("walkIn")}
            {result.guests ? ` · ${t("guests", { count: result.guests })}` : ""}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View accessibilityRole="alert" style={[styles.banner, styles.bannerBad]}>
      <CircleAlert size={28} color={colors.white} aria-hidden />
      <Text weight="semibold" tone="inverse" style={styles.grow}>
        {t(result.status)}
      </Text>
    </View>
  );
}

function WalkIn({
  eventId,
  known,
  busy,
  onPick,
}: {
  eventId: string;
  known: CheckInAttendee[];
  busy: boolean;
  onPick: (id: string) => Promise<void>;
}) {
  const t = useTranslations("events.checkIn.search");
  const tl = useTranslations("events.checkIn.list");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CheckInCandidate[] | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const n = ++seq.current;
    if (!term) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      const found = await searchCheckIn(eventId, term)
        .then((r) => r.candidates)
        .catch(() => []);
      if (n === seq.current) setResults(found);
    }, 250);
    return () => clearTimeout(timer);
  }, [q, eventId]);

  const listed = new Set(known.map((p) => p.id));
  const fresh = results?.filter((r) => !listed.has(r.id)) ?? null;

  return (
    <Card style={styles.card}>
      <Text variant="subheading" accessibilityRole="header">
        {t("title")}
      </Text>
      <Text variant="small" tone="muted">
        {t("hint")}
      </Text>
      <TextField
        accessibilityLabel={t("label")}
        placeholder={t("label")}
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <View accessibilityLiveRegion="polite">
        {fresh && fresh.length === 0 ? (
          <Text variant="small" tone="muted">
            {t("noResults")}
          </Text>
        ) : null}
        {fresh?.map((r) => (
          <View key={r.id} style={styles.person}>
            <Text style={styles.grow}>
              {r.name}
              {r.kanji ? (
                <Text variant="small" tone="muted">{`  ${r.kanji}`}</Text>
              ) : null}
            </Text>
            <Button
              compact
              label={tl("checkIn")}
              accessibilityLabel={`${tl("checkIn")}: ${r.name}`}
              disabled={busy}
              onPress={async () => {
                await onPick(r.id);
                setQ("");
              }}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  card: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stats: { flexDirection: "row", gap: space.sm },
  stat: {
    flex: 1,
    borderRadius: radius.lg,
    padding: space.md,
    backgroundColor: colors.slate100,
  },
  statStrong: { backgroundColor: colors.green50 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  bannerOk: { backgroundColor: colors.green600 },
  bannerAlready: { backgroundColor: colors.amber100 },
  bannerBad: { backgroundColor: colors.red700, alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: TOUCH,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.slate300,
  },
  chipOn: { borderColor: colors.brand700, backgroundColor: colors.brand50 },
  chipOnText: { color: colors.brand800 },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slate200,
  },
  searchInput: { paddingLeft: 36 },
  searchIcon: { position: "absolute", left: space.md, top: 14 },
});
