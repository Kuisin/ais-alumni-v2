import type { VerificationDetail } from "@contract/admin";
import { MessageCircle } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
import {
  Composer,
  MessageBubbles,
} from "@/features/application-messages/thread";
import { Text } from "@/ui";
import { useSendVerificationMessage } from "./api";
import { DetailCard } from "./parts";

/**
 * 「やりとり」: messages with the applicant — or, for a child a parent
 * registered (no sign-in), with that parent. While the application is open
 * the committee can write without changing its status; 「追加情報が必要」's
 * note is posted here too. Committee messages sit on the right.
 */
export function MessagesCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("mobile.applicationMessages");
  const ta = useTranslations("adminVerify");
  const send = useSendVerificationMessage(d.id);
  const [error, setError] = useState<string | null>(null);
  // Older servers: no thread.
  if (!d.messages) return null;
  const messages = d.messages;
  if (!messages.length && !d.canMessage) return null;
  return (
    <DetailCard title={t("title")} icon={MessageCircle}>
      <Text variant="small" tone="muted">
        {d.messagesTo
          ? t("adminDescriptionManaged", { name: d.messagesTo })
          : t("adminDescription")}
      </Text>
      <MessageBubbles
        messages={messages.map((m) => ({
          id: m.id,
          mine: m.fromAdmin,
          author: m.fromAdmin
            ? (m.author ?? t("committee"))
            : (m.author ?? d.name),
          body: m.body,
          createdAt: m.createdAt,
        }))}
        empty={t("emptyAdmin")}
      />
      {d.canMessage ? (
        <View accessibilityLiveRegion="polite">
          <Composer
            label={t("adminLabel")}
            hint={t("adminHint")}
            sending={send.isPending}
            error={error}
            onSend={async (body) => {
              setError(null);
              try {
                const r = await send.mutateAsync(body);
                if (r.ok) return true;
                setError(
                  r.errors?.body
                    ? ta(`errors.${r.errors.body}`)
                    : ta(`messages.${r.message ?? "generic"}`),
                );
              } catch {
                setError(ta("messages.generic"));
              }
              return false;
            }}
          />
        </View>
      ) : (
        <Text variant="small" tone="muted">
          {t("closedAdmin")}
        </Text>
      )}
    </DetailCard>
  );
}
