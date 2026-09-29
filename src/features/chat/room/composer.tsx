import type { ChatRoomMember } from "@contract/chat";
import { SendHorizontal } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useTranslations } from "use-intl";
import { isApiError } from "@/lib/api";
import { Avatar, colors, font, space, Text, TOUCH } from "@/ui";
import { applyMention, mentionQuery } from "../mentions";

/** The website composer's limit (MAX_CHAT_MESSAGE). */
const MAX_MESSAGE = 2000;
const SEND_ERRORS = new Set(["forbidden", "invalid", "tooFast"]);
/** Picker id of @全員. */
const ALL = "__all__";

/** The web build's textarea starts at one row (native inputs grow by themselves). */
const WEB_ONE_ROW = (Platform.OS === "web" ? { rows: 1 } : {}) as object;

type Suggestion = { id: string; name: string; avatar: string | null };
type Selection = { start: number; end: number };

/**
 * Write a message: multiline (Return is a new line), 「送信」 sends; "@"
 * opens the mention picker (全員 in groups, and the other members), as on
 * the website.
 */
export function Composer({
  others,
  direct,
  bottomInset,
  onSend,
}: {
  /** the other members of the talk */
  others: ChatRoomMember[];
  direct: boolean;
  bottomInset: number;
  onSend: (body: string) => Promise<unknown>;
}) {
  const t = useTranslations("chat.room");
  const tm = useTranslations("mobile.chat");
  const [text, setText] = useState("");
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const input = useRef<TextInput>(null);
  // Where the caret goes once a picked mention is in the text.
  const [caretAfterPick, setCaretAfterPick] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q =
    selection.start === selection.end
      ? mentionQuery(text, selection.end)
      : null;
  const suggestions: Suggestion[] = q
    ? [
        ...(direct ? [] : [{ id: ALL, name: t("mentionAll"), avatar: null }]),
        ...others,
      ]
        .filter((s) => s.name.toLowerCase().includes(q.query.toLowerCase()))
        .slice(0, 8)
    : [];

  const pick = (s: Suggestion) => {
    if (!q) return;
    const r = applyMention(text, q.start, selection.end, s.name);
    setText(r.text);
    setSelection({ start: r.caret, end: r.caret });
    setCaretAfterPick(r.caret);
  };
  useEffect(() => {
    const el = input.current as
      | (TextInput & { setSelectionRange?: (a: number, b: number) => void })
      | null;
    if (caretAfterPick === null || !el) return;
    el.focus();
    // Native inputs have setSelection; the web build's is a <textarea>.
    if (typeof el.setSelection === "function")
      el.setSelection(caretAfterPick, caretAfterPick);
    else el.setSelectionRange?.(caretAfterPick, caretAfterPick);
    setCaretAfterPick(null);
  }, [caretAfterPick]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(body);
      setText("");
      setSelection({ start: 0, end: 0 });
    } catch (e) {
      const code = isApiError(e) ? e.code : "generic";
      setError(t(`errors.${SEND_ERRORS.has(code) ? code : "generic"}`));
    } finally {
      setSending(false);
    }
  };

  const empty = !text.trim();
  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset }]}>
      {suggestions.length ? (
        <ScrollView
          style={styles.suggestions}
          keyboardShouldPersistTaps="always"
          accessibilityLabel={t("mentionList")}
        >
          {suggestions.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={
                s.id === ALL
                  ? `@${s.name}, ${t("mentionAllHint")}`
                  : `@${s.name}`
              }
              onPress={() => pick(s)}
              style={({ pressed }) => [
                styles.suggestion,
                pressed ? styles.suggestionPressed : null,
              ]}
            >
              {s.id === ALL ? (
                <View style={styles.allIcon}>
                  <Text weight="semibold" style={styles.allAt}>
                    @
                  </Text>
                </View>
              ) : (
                <Avatar uri={s.avatar} size={28} />
              )}
              <Text variant="small" weight="medium" numberOfLines={1}>
                {s.name}
              </Text>
              {s.id === ALL ? (
                <Text variant="caption" tone="subtle" numberOfLines={1}>
                  {t("mentionAllHint")}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {error ? (
        <Text
          variant="small"
          tone="danger"
          accessibilityRole="alert"
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
      <View style={styles.row}>
        <TextInput
          ref={input}
          value={text}
          onChangeText={(v) => {
            // Typing at the end: keep the caret there until the platform
            // reports the selection (not every platform does on each key).
            if (selection.end === text.length)
              setSelection({ start: v.length, end: v.length });
            setText(v);
            setError(null);
          }}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          multiline
          maxLength={MAX_MESSAGE}
          placeholder={t("placeholder")}
          placeholderTextColor={colors.slate500}
          accessibilityLabel={t("messageLabel")}
          accessibilityHint={tm("composerHint")}
          style={styles.input}
          {...WEB_ONE_ROW}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sending ? t("sending") : t("send")}
          accessibilityState={{ disabled: sending || empty, busy: sending }}
          disabled={sending || empty}
          onPress={send}
          style={({ pressed }) => [
            styles.send,
            sending || empty ? styles.sendOff : null,
            pressed ? styles.sendPressed : null,
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <SendHorizontal size={16} color={colors.white} />
          )}
          <Text variant="small" weight="semibold" tone="inverse">
            {sending ? t("sending") : t("send")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate200,
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
  },
  suggestions: {
    maxHeight: 4.5 * TOUCH,
    marginBottom: space.xs,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slate200,
    backgroundColor: colors.surface,
  },
  suggestion: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.sm,
  },
  suggestionPressed: { backgroundColor: colors.brand50 },
  allIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand100,
  },
  allAt: { color: colors.brand800 },
  error: { paddingHorizontal: space.sm, paddingBottom: space.xs },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  input: {
    flex: 1,
    minHeight: TOUCH,
    maxHeight: 144,
    borderRadius: 20,
    backgroundColor: colors.slate100,
    paddingHorizontal: space.lg,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: font.size.md,
    lineHeight: 22,
    color: colors.text,
  },
  send: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    borderRadius: 999,
    backgroundColor: colors.brand700,
  },
  sendOff: { backgroundColor: colors.slate300 },
  sendPressed: { backgroundColor: colors.brand800 },
});
