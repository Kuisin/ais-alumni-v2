import type { ChatInfo, ChatReportReason, ReportError } from "@contract/chat";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { ApiError, isApiError } from "@/lib/api";
import {
  Button,
  colors,
  ErrorState,
  QueryState,
  Screen,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";
import { chatApi, useChatInfo } from "./api";
import { toKatakana } from "./mentions";

/** The website's CHAT_REPORT_REASONS, in its order. */
const REASONS: ChatReportReason[] = [
  "HARASSMENT",
  "SPAM",
  "INAPPROPRIATE",
  "IMPERSONATION",
  "PRIVACY",
  "OTHER",
];
/** CHAT_REPORT_LIMITS.detail */
const MAX_DETAIL = 2000;
const ERRORS: ReportError[] = ["forbidden", "reason", "detail", "rateLimited"];

/**
 * 問題を報告する (the website's ChatReportForm on /app/chat/[id]/info):
 * report the talk, or someone in it, to the admins. In a 1:1 talk the
 * other person is chosen already.
 */
export function ChatReportScreen() {
  const t = useTranslations("chat.report");
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useChatInfo(id);
  return (
    <>
      <Stack.Screen options={{ title: t("open") }} />
      <QueryState query={query}>
        {(info) =>
          info.member ? (
            <ReportForm info={info} />
          ) : (
            <ErrorState error={new ApiError(403, "forbidden")} />
          )
        }
      </QueryState>
    </>
  );
}

function ReportForm({ info }: { info: ChatInfo }) {
  const t = useTranslations("chat.report");
  const tc = useTranslations("common");
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const others = info.members.filter((m) => !m.self);
  const [who, setWho] = useState<string | null>(
    info.direct ? (others[0]?.id ?? null) : null,
  );
  const [reason, setReason] = useState<ChatReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<ReportError | "generic" | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const whoName = who
    ? (others.find((m) => m.id === who)?.name ?? "—")
    : t("wholeChat");

  const submit = async () => {
    if (!reason) return setError("reason");
    const text = detail.trim();
    if (text.length < 5 || text.length > MAX_DETAIL) return setError("detail");
    setSending(true);
    setError(null);
    try {
      const r = await chatApi.report(info.id, {
        userId: who,
        reason,
        detail: text,
      });
      setSent(r.ref);
    } catch (e) {
      const code = isApiError(e) ? (e.code as ReportError) : null;
      setError(code && ERRORS.includes(code) ? code : "generic");
    } finally {
      setSending(false);
    }
  };

  if (sent !== null)
    return (
      <Screen>
        <View style={styles.sent} accessibilityRole="alert">
          <Text tone="success" weight="medium">
            {t("sent", { ref: sent })}
          </Text>
        </View>
        <Button
          variant="secondary"
          label={tc("back")}
          onPress={() => router.back()}
        />
      </Screen>
    );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <Screen>
        <Text variant="small" tone="muted">
          {t("intro")}
        </Text>

        <View style={styles.field}>
          <Label text={t("who")} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("who")}: ${whoName}`}
            accessibilityState={{ disabled: info.direct }}
            disabled={info.direct}
            onPress={() => setPicking(true)}
            style={({ pressed }) => [
              styles.select,
              info.direct ? styles.selectFixed : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text numberOfLines={1} style={styles.flex}>
              {whoName}
            </Text>
            {info.direct ? null : (
              <ChevronDown size={18} color={colors.slate500} />
            )}
          </Pressable>
        </View>

        <View style={styles.field}>
          <Label text={t("reason")} required />
          <View
            style={[styles.options, error === "reason" ? styles.invalid : null]}
            accessibilityRole="radiogroup"
            accessibilityLabel={t("reason")}
          >
            {REASONS.map((r, i) => {
              const on = reason === r;
              return (
                <Pressable
                  key={r}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    setReason(r);
                    if (error === "reason") setError(null);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    i > 0 ? styles.optionBorder : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={[styles.radio, on ? styles.radioOn : null]}>
                    {on ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={styles.flex}>{t(`reasons.${r}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          {error === "reason" ? (
            <Text variant="small" tone="danger">
              {t("errors.reason")}
            </Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Label text={t("detail")} required />
          <TextField
            value={detail}
            onChangeText={(v) => {
              setDetail(v);
              if (error === "detail") setError(null);
            }}
            multiline
            maxLength={MAX_DETAIL}
            accessibilityLabel={t("detail")}
            textAlignVertical="top"
            hint={t("detailHint")}
            error={error === "detail" ? t("errors.detail") : null}
            style={styles.textarea}
          />
        </View>

        {error === "forbidden" ||
        error === "rateLimited" ||
        error === "generic" ? (
          <View style={styles.alert} accessibilityRole="alert">
            <Text variant="small" tone="danger">
              {error === "generic"
                ? tc("errors.generic")
                : t(`errors.${error}`)}
            </Text>
          </View>
        ) : null}

        <Button
          variant="danger"
          label={sending ? t("sending") : t("send")}
          loading={sending}
          onPress={submit}
        />
      </Screen>

      <WhoPicker
        visible={picking}
        title={t("who")}
        wholeChat={t("wholeChat")}
        members={others}
        selected={who}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          setWho(id);
          setPicking(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text variant="small" weight="medium" style={styles.label}>
      {text}
      {required ? <Text style={styles.required}>{" *"}</Text> : null}
    </Text>
  );
}

/** 対象: the talk as a whole, or one of the other members (searchable). */
function WhoPicker({
  visible,
  title,
  wholeChat,
  members,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  wholeChat: string;
  members: { id: string; name: string; otherNames: string | null }[];
  selected: string | null;
  onClose: () => void;
  onPick: (id: string | null) => void;
}) {
  const t = useTranslations("chat.info");
  const tc = useTranslations("common");
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const kana = term ? toKatakana(term) : "";
  const rows = [
    ...(term
      ? []
      : [{ id: null as string | null, name: wholeChat, otherNames: null }]),
    ...members.filter(
      (m) =>
        !term ||
        `${m.name} ${m.otherNames ?? ""}`.toLowerCase().includes(term) ||
        (m.otherNames ?? "").includes(kana),
    ),
  ];
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.picker} edges={["top", "bottom"]}>
        <View style={styles.pickerHead}>
          <Text variant="subheading" style={styles.flex}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tc("close")}
            onPress={onClose}
            style={styles.close}
          >
            <X size={22} color={colors.slate700} />
          </Pressable>
        </View>
        {members.length > 8 ? (
          <View style={styles.search}>
            <Search size={16} color={colors.slate400} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t("search")}
              placeholderTextColor={colors.slate400}
              accessibilityLabel={t("search")}
              autoCorrect={false}
              style={styles.searchInput}
            />
          </View>
        ) : null}
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id ?? "__chat__"}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const on = item.id === selected;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => onPick(item.id)}
                style={({ pressed }) => [
                  styles.pickRow,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={styles.flex}>
                  <Text weight={on ? "semibold" : "regular"} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.otherNames ? (
                    <Text variant="caption" tone="subtle" numberOfLines={1}>
                      {item.otherNames}
                    </Text>
                  ) : null}
                </View>
                {on ? <Check size={18} color={colors.brand700} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text variant="small" tone="muted" center style={styles.noMatch}>
              {t("noMatch")}
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sent: {
    borderRadius: 10,
    padding: space.md,
    backgroundColor: colors.green50,
    borderWidth: 1,
    borderColor: colors.green100,
  },
  field: { gap: space.xs },
  label: { color: colors.slate800 },
  required: { color: colors.red700 },
  select: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
  },
  selectFixed: { backgroundColor: colors.slate100 },
  pressed: { backgroundColor: colors.slate50 },
  options: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  invalid: { borderColor: colors.red600 },
  option: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
  },
  optionBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate200,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.slate400,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.brand700 },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand700,
  },
  textarea: { minHeight: 120, paddingTop: space.sm },
  alert: {
    borderRadius: 10,
    padding: space.md,
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: colors.red100,
  },
  picker: { flex: 1, backgroundColor: colors.surface },
  pickerHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  close: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    margin: space.md,
    paddingLeft: space.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.slate300,
  },
  searchInput: {
    flex: 1,
    minHeight: TOUCH,
    paddingRight: space.md,
    fontSize: 16,
    color: colors.text,
  },
  pickRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slate100,
  },
  noMatch: { paddingVertical: space.lg },
});
