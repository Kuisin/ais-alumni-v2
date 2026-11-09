import type { ApplicationThread } from "@contract/onboarding";
import { MessageCircle } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Badge, Card, colors, space, Text } from "@/ui";
import {
  useApplicationThreads,
  useMarkThreadRead,
  useReplyToThread,
} from "./api";
import { Composer, MessageBubbles } from "./thread";

/**
 * One application's 「やりとり」 for the applicant — or the parent managing
 * a child's account: the committee's messages and a reply box while the
 * application is open. Shown, its messages count as read. `onResumed`: the
 * reply put a NEEDS_INFO application back in review (refresh /me).
 */
export function ApplicationThreadCard({
  thread,
  onResumed,
  card = true,
}: {
  thread: ApplicationThread;
  onResumed?: () => void;
  /** false: without the surrounding card (a screen of its own) */
  card?: boolean;
}) {
  const t = useTranslations("mobile.applicationMessages");
  const reply = useReplyToThread(thread.requestId);
  const markRead = useMarkThreadRead(thread.requestId);
  const { mutate: read } = markRead;
  const unread = thread.unread;
  useEffect(() => {
    if (unread > 0) read();
  }, [unread, read]);

  const child = thread.subject === "child";
  const name = thread.childName ?? "";
  const needsInfo = thread.status === "NEEDS_INFO";
  const body = (
    <>
      <View style={styles.head}>
        <MessageCircle size={20} color={colors.brand700} aria-hidden />
        <Text
          variant="subheading"
          accessibilityRole="header"
          style={styles.flex}
        >
          {child ? t("childTitle", { name }) : t("title")}
        </Text>
        {needsInfo ? <Badge tone="amber" label={t("needsInfo")} /> : null}
      </View>
      <Text variant="small" tone="muted">
        {child ? t("childDescription", { name }) : t("description")}
      </Text>
      <MessageBubbles
        messages={thread.messages.map((m) => ({
          id: m.id,
          mine: !m.fromAdmin,
          author: m.fromAdmin
            ? t("committee")
            : m.mine
              ? t("you")
              : (m.author ?? "—"),
          body: m.body,
          createdAt: m.createdAt,
        }))}
        empty={t("emptyApplicant")}
      />
      {thread.canReply ? (
        <Composer
          label={t("replyLabel")}
          hint={
            needsInfo
              ? child
                ? t("childNeedsInfoHint", { name })
                : t("needsInfoHint")
              : t("replyHint")
          }
          sending={reply.isPending}
          error={reply.isError ? t("error") : null}
          onSend={async (text) => {
            try {
              const sent = await reply.mutateAsync(text);
              if (sent.resumed) onResumed?.();
              return true;
            } catch {
              return false;
            }
          }}
        />
      ) : (
        <Text variant="small" tone="muted">
          {t("closed")}
        </Text>
      )}
    </>
  );
  return card ? (
    <Card style={styles.card}>{body}</Card>
  ) : (
    <View style={styles.card}>{body}</View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
});

/**
 * The onboarding screens' 「やりとり」: my application's thread and those
 * of child accounts I manage — nothing while loading or when there are none
 * (the rest of the screen doesn't wait for it).
 */
export function ApplicationThreads({ onResumed }: { onResumed?: () => void }) {
  const q = useApplicationThreads();
  const threads = q.data?.threads ?? [];
  if (!threads.length) return null;
  return (
    <>
      {threads.map((th) => (
        <ApplicationThreadCard
          key={th.requestId}
          thread={th}
          onResumed={onResumed}
        />
      ))}
    </>
  );
}
