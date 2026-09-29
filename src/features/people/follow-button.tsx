import type { FollowUiState } from "@contract/people";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Clock, MessageCircle, UserCheck, UserPlus } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ApiError, api } from "@/lib/api";
import { Button, space, Text } from "@/ui";
import {
  CHAT_ERRORS,
  followErrorKey,
  isNetworkError,
  useBlockMember,
  useFollowMember,
  useUnfollowMember,
} from "./api";
import { Sheet } from "./sheet";

function tap() {
  if (Platform.OS !== "web")
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** An error / status line under a button (announced). */
export function StatusLine({
  text,
  ok = false,
}: {
  text: string | null;
  ok?: boolean;
}) {
  if (!text) return null;
  return (
    <Text
      variant="small"
      tone={ok ? "success" : "danger"}
      accessibilityLiveRegion="polite"
      accessibilityRole={ok ? undefined : "alert"}
    >
      {text}
    </Text>
  );
}

/** Generic failure text: offline, or "something went wrong". */
export function useFailureText() {
  const tm = useTranslations("mobile.errors");
  return (e: unknown) => (isNetworkError(e) ? tm("network") : tm("generic"));
}

/**
 * The website's FollowButton (src/components/follows/follow-button.tsx):
 * none / followBack send a request; requested cancels it; following asks
 * before unfollowing. The outcome is shown under the button.
 */
export function FollowButton({
  targetId,
  state,
  name,
  compact = false,
}: {
  targetId: string;
  state: FollowUiState;
  /** display name, for the unfollow confirmation */
  name: string;
  compact?: boolean;
}) {
  const t = useTranslations("follows");
  const failure = useFailureText();
  const follow = useFollowMember(targetId);
  const unfollow = useUnfollowMember(targetId);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const canRequest = state === "none" || state === "followBack";
  // Errors belong to the request button; success notes to the state it led to.
  const message =
    result && (result.ok ? !canRequest : canRequest) ? result : null;
  const busy = follow.isPending || unfollow.isPending;

  const request = () => {
    setResult(null);
    tap();
    follow.mutate(undefined, {
      onSuccess: (r) =>
        setResult({
          ok: true,
          text: t(
            r.status === "ACCEPTED"
              ? "status.autoAccepted"
              : "status.requestSent",
          ),
        }),
      onError: (e) => {
        const key = followErrorKey(e);
        setResult({ ok: false, text: key ? t(key) : failure(e) });
      },
    });
  };
  const remove = () => {
    setResult(null);
    unfollow.mutate(undefined, {
      onSuccess: () => setConfirming(false),
      onError: (e) => setResult({ ok: false, text: failure(e) }),
    });
  };

  let button: ReactNode;
  if (state === "following") {
    button = (
      <Button
        variant="secondary"
        compact={compact}
        label={t("actions.following")}
        icon={(c) => <UserCheck size={16} color={c} aria-hidden />}
        accessibilityState={{ expanded: confirming }}
        onPress={() => setConfirming(true)}
        disabled={busy}
      />
    );
  } else if (state === "requested") {
    button = (
      <Button
        variant="secondary"
        compact={compact}
        label={busy ? t("actions.working") : t("actions.requested")}
        accessibilityLabel={`${t("actions.requested")}${t("actions.requestedHint")}`}
        icon={(c) => <Clock size={16} color={c} aria-hidden />}
        loading={busy}
        onPress={remove}
      />
    );
  } else {
    button = (
      <Button
        compact={compact}
        label={
          busy
            ? t("actions.working")
            : t(
                state === "followBack"
                  ? "actions.followBack"
                  : "actions.follow",
              )
        }
        icon={(c) => <UserPlus size={16} color={c} aria-hidden />}
        loading={busy}
        onPress={request}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      {button}
      <StatusLine text={message?.text ?? null} ok={message?.ok} />
      <Sheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title={t("actions.following")}
      >
        <Text>{t("actions.unfollowConfirm", { name })}</Text>
        <View style={styles.sheetButtons}>
          <Button
            variant="danger"
            label={
              unfollow.isPending ? t("actions.working") : t("actions.unfollow")
            }
            loading={unfollow.isPending}
            onPress={remove}
          />
          <Button
            variant="secondary"
            label={t("actions.cancel")}
            disabled={unfollow.isPending}
            onPress={() => setConfirming(false)}
          />
        </View>
        {confirming ? (
          <StatusLine text={result && !result.ok ? result.text : null} />
        ) : null}
      </Sheet>
    </View>
  );
}

/**
 * 「メッセージ」 (src/components/chat/start-talk.tsx MessageButton): opens,
 * or creates, the 1:1 talk.
 */
export function MessageButton({ memberId }: { memberId: string }) {
  const t = useTranslations("chat");
  const failure = useFailureText();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setPending(true);
    setError(null);
    try {
      const r = await api<{ groupId: string }>("/chat/direct", {
        body: { userId: memberId },
      });
      router.push(`/chat/${r.groupId}`);
    } catch (e) {
      setError(
        isNetworkError(e)
          ? failure(e)
          : t(
              `new.errors.${e instanceof ApiError && CHAT_ERRORS.has(e.code) ? e.code : "forbidden"}`,
            ),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Button
        variant="secondary"
        label={t("message")}
        icon={(c) => <MessageCircle size={16} color={c} aria-hidden />}
        loading={pending}
        onPress={open}
      />
      <StatusLine text={error} />
    </View>
  );
}

/** 「ブロック解除」 (BlockControl with blocked). */
export function UnblockButton({
  memberId,
  compact = false,
}: {
  memberId: string;
  compact?: boolean;
}) {
  const t = useTranslations("follows");
  const failure = useFailureText();
  const block = useBlockMember(memberId);
  return (
    <View style={styles.wrap}>
      <Button
        variant="secondary"
        compact={compact}
        label={block.isPending ? t("actions.working") : t("actions.unblock")}
        loading={block.isPending}
        onPress={() => block.mutate(false)}
      />
      <StatusLine text={block.error ? failure(block.error) : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignItems: "flex-start" },
  sheetButtons: { gap: space.sm },
});
