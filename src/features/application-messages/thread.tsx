import type { Locale } from "@contract/core";
import { Send } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { formatDateTime } from "@/lib/format";
import { Button, colors, radius, space, Text, TextField } from "@/ui";

/**
 * 「やりとり」 as chat bubbles (oldest first, newest at the bottom) and a
 * composer — shared by the committee's application screen and the
 * applicant's (or managing parent's) screens. "Mine" sits on the right.
 */

export type ThreadMessage = {
  id: string;
  mine: boolean;
  /** shown above the bubble */
  author: string;
  body: string;
  createdAt: string;
};

/** Longest message (the server's MESSAGE_MAX). */
export const MESSAGE_MAX = 2000;

export function MessageBubbles({
  messages,
  empty,
}: {
  messages: ThreadMessage[];
  /** shown when there are none (null: nothing) */
  empty?: string | null;
}) {
  const locale = useLocale() as Locale;
  if (!messages.length)
    return empty ? (
      <Text variant="small" tone="muted">
        {empty}
      </Text>
    ) : null;
  return (
    <View style={styles.list} accessibilityRole="list">
      {messages.map((m) => {
        const time = formatDateTime(m.createdAt, locale);
        return (
          <View
            key={m.id}
            style={[styles.item, m.mine ? styles.itemMine : null]}
            accessible
            accessibilityLabel={`${m.author}、${time}: ${m.body}`}
          >
            <Text variant="caption" tone="subtle">
              {`${m.author} · ${time}`}
            </Text>
            <View style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}>
              <Text
                variant="small"
                selectable
                style={m.mine ? styles.mineText : null}
              >
                {m.body}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** A message box and its send button; cleared once sent. */
export function Composer({
  label,
  hint,
  placeholder,
  sending,
  error,
  onSend,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  sending: boolean;
  error?: string | null;
  /** resolves true when sent (the box is cleared) */
  onSend: (body: string) => Promise<boolean>;
}) {
  const t = useTranslations("mobile.applicationMessages");
  const [body, setBody] = useState("");
  const send = async () => {
    const text = body.trim();
    if (!text || sending) return;
    if (await onSend(text)) setBody("");
  };
  return (
    <View style={styles.composer}>
      <TextField
        label={label}
        hint={hint}
        error={error}
        placeholder={placeholder}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={MESSAGE_MAX}
        textAlignVertical="top"
        style={styles.input}
      />
      <Button
        label={sending ? t("sending") : t("send")}
        icon={(c) => <Send size={16} color={c} aria-hidden />}
        loading={sending}
        disabled={!body.trim()}
        onPress={send}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  item: { gap: 2, alignItems: "flex-start", maxWidth: "88%" },
  itemMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  theirs: {
    backgroundColor: colors.slate100,
    borderTopLeftRadius: radius.sm,
  },
  mine: {
    backgroundColor: colors.brand700,
    borderTopRightRadius: radius.sm,
  },
  mineText: { color: colors.white },
  composer: { gap: space.sm },
  input: { minHeight: 88, paddingTop: space.sm },
});
