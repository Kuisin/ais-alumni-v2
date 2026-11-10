import type { Locale } from "@contract/core";
import type { ApplicationAttachment } from "@contract/onboarding";
import { Send } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { formatDateTime } from "@/lib/format";
import { Button, colors, radius, space, Text, TextField } from "@/ui";
import {
  type AttachConfig,
  AttachmentPicker,
  MessageAttachments,
  type PendingAttachment,
} from "./attachments";

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
  /** may be empty (attachments only) */
  body: string;
  createdAt: string;
  attachments?: ApplicationAttachment[];
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
        const files = m.attachments ?? [];
        return (
          <View
            key={m.id}
            style={[styles.item, m.mine ? styles.itemMine : null]}
          >
            <View
              style={[styles.inner, m.mine ? styles.innerMine : null]}
              accessible
              accessibilityLabel={`${m.author}、${time}: ${m.body}`}
            >
              <Text variant="caption" tone="subtle">
                {`${m.author} · ${time}`}
              </Text>
              {m.body ? (
                <View
                  style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}
                >
                  <Text
                    variant="small"
                    selectable
                    style={m.mine ? styles.mineText : null}
                  >
                    {m.body}
                  </Text>
                </View>
              ) : null}
            </View>
            <MessageAttachments
              items={files}
              align={m.mine ? "end" : "start"}
            />
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
  attach,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  sending: boolean;
  error?: string | null;
  /** resolves true when sent (the box and attachments are cleared) */
  onSend: (
    body: string,
    attachments: { key: string; fileName: string }[],
  ) => Promise<boolean>;
  /** photos / PDFs can be attached (uploaded when picked) */
  attach?: AttachConfig;
}) {
  const t = useTranslations("mobile.applicationMessages");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<PendingAttachment[]>([]);
  const ready = Boolean(body.trim()) || files.length > 0;
  const send = async () => {
    const text = body.trim();
    if (!ready || sending) return;
    const sent = await onSend(
      text,
      files.map((f) => ({ key: f.key, fileName: f.fileName })),
    );
    if (sent) {
      setBody("");
      setFiles([]);
    }
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
      {attach ? (
        <AttachmentPicker
          config={attach}
          items={files}
          onChange={setFiles}
          disabled={sending}
        />
      ) : null}
      <Button
        label={sending ? t("sending") : t("send")}
        icon={(c) => <Send size={16} color={c} aria-hidden />}
        loading={sending}
        disabled={!ready}
        onPress={send}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  item: { gap: space.xs, alignItems: "flex-start", maxWidth: "88%" },
  itemMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  inner: { gap: 2, alignItems: "flex-start" },
  innerMine: { alignItems: "flex-end" },
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
