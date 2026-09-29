import type { Locale } from "@contract/core";
import type { FollowLists, FollowUiState, MemberCard } from "@contract/people";
import { CircleCheck } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { formatDate } from "@/lib/format";
import { Button, CountDot, colors, radius, space, Text, TOUCH } from "@/ui";
import { useAnswerRequest, useRemoveFollower, useUnfollowMember } from "./api";
import {
  FollowButton,
  StatusLine,
  UnblockButton,
  useFailureText,
} from "./follow-button";
import { MemberCardView } from "./member-card";

/** The lists of the website's /app/follows, one row type per tab. */

export const FOLLOW_TABS = [
  "incoming",
  "outgoing",
  "followers",
  "following",
  "blocked",
] as const;
export type FollowTab = (typeof FOLLOW_TABS)[number];

export function asFollowTab(v: string | undefined): FollowTab {
  return FOLLOW_TABS.includes(v as FollowTab) ? (v as FollowTab) : "incoming";
}

/** The five lists with their counts (the website's Tabs). */
export function FollowTabs({
  value,
  onChange,
  counts,
}: {
  value: FollowTab;
  onChange: (tab: FollowTab) => void;
  counts: Record<FollowTab, number> | null;
}) {
  const t = useTranslations("follows");
  // Keep the chosen list in view (e.g. opened with ?tab=blocked).
  const scroller = useRef<ScrollView>(null);
  const xs = useRef(new Map<FollowTab, number>());
  const reveal = (key: FollowTab, animated: boolean) => {
    const x = xs.current.get(key);
    if (x !== undefined)
      scroller.current?.scrollTo({ x: Math.max(0, x - space.xxl), animated });
  };
  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.tabs}
      accessibilityRole="tablist"
      accessibilityLabel={t("tabsLabel")}
    >
      {FOLLOW_TABS.map((key) => {
        const on = key === value;
        const n = counts?.[key] ?? 0;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${t(`tabs.${key}`)} ${n}`}
            onPress={() => {
              onChange(key);
              reveal(key, true);
            }}
            onLayout={(e) => {
              xs.current.set(key, e.nativeEvent.layout.x);
              if (on) reveal(key, false);
            }}
            style={({ pressed }) => [
              styles.tab,
              on ? styles.tabOn : null,
              pressed && !on ? styles.tabPressed : null,
            ]}
          >
            <Text
              variant="small"
              weight="semibold"
              style={{ color: on ? colors.white : colors.slate700 }}
            >
              {t(`tabs.${key}`)}
            </Text>
            {key === "incoming" && n > 0 ? (
              <CountDot count={n} />
            ) : counts ? (
              <Text
                variant="caption"
                weight="semibold"
                style={{ color: on ? colors.brand100 : colors.slate500 }}
              >
                {n}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type Open = (member: MemberCard) => void;

function useRequestedAt() {
  const t = useTranslations("follows");
  const locale = useLocale() as Locale;
  return (iso: string) => t("requestedAt", { date: formatDate(iso, locale) });
}

/** A request to me: 「承認」 / 「拒否」. */
export function IncomingRow({
  item,
  onOpen,
  onAccepted,
}: {
  item: FollowLists["incoming"][number];
  onOpen: Open;
  onAccepted: (followId: string) => void;
}) {
  const t = useTranslations("follows");
  const failure = useFailureText();
  const requestedAt = useRequestedAt();
  const answer = useAnswerRequest();
  const accepting = answer.isPending && answer.variables?.accept === true;
  const declining = answer.isPending && answer.variables?.accept === false;
  return (
    <MemberCardView
      member={item.member}
      onPress={() => onOpen(item.member)}
      meta={requestedAt(item.requestedAt)}
      actions={
        <>
          <Button
            label={t("actions.accept")}
            loading={accepting}
            disabled={answer.isPending}
            onPress={() =>
              answer.mutate(
                { followId: item.followId, accept: true },
                { onSuccess: (r) => r.accepted && onAccepted(item.followId) },
              )
            }
          />
          <Button
            variant="secondary"
            label={t("actions.decline")}
            loading={declining}
            disabled={answer.isPending}
            onPress={() =>
              answer.mutate({ followId: item.followId, accept: false })
            }
          />
          <StatusLine text={answer.error ? failure(answer.error) : null} />
        </>
      }
    />
  );
}

/** My pending request: 「リクエストを取り消す」. */
export function OutgoingRow({
  item,
  onOpen,
}: {
  item: FollowLists["outgoing"][number];
  onOpen: Open;
}) {
  const t = useTranslations("follows");
  const failure = useFailureText();
  const requestedAt = useRequestedAt();
  const cancel = useUnfollowMember(item.member.id);
  return (
    <MemberCardView
      member={item.member}
      onPress={() => onOpen(item.member)}
      meta={requestedAt(item.requestedAt)}
      actions={
        <>
          <Button
            variant="secondary"
            label={
              cancel.isPending
                ? t("actions.working")
                : t("actions.cancelRequest")
            }
            loading={cancel.isPending}
            onPress={() => cancel.mutate()}
          />
          <StatusLine text={cancel.error ? failure(cancel.error) : null} />
        </>
      }
    />
  );
}

/** A follower: my follow(-back) button, and 「削除」. */
export function FollowerRow({
  member,
  followState,
  onOpen,
}: {
  member: MemberCard;
  followState: FollowUiState | null;
  onOpen: Open;
}) {
  const t = useTranslations("follows");
  const failure = useFailureText();
  const remove = useRemoveFollower(member.id);
  return (
    <MemberCardView
      member={member}
      onPress={() => onOpen(member)}
      actions={
        <>
          {followState ? (
            <FollowButton
              targetId={member.id}
              state={followState}
              name={member.name}
            />
          ) : null}
          <View style={styles.action}>
            <Button
              variant="secondary"
              label={
                remove.isPending ? t("actions.working") : t("actions.remove")
              }
              loading={remove.isPending}
              onPress={() => remove.mutate()}
            />
            <StatusLine text={remove.error ? failure(remove.error) : null} />
          </View>
        </>
      }
    />
  );
}

/** Someone I follow: 「フォロー中」 (unfollow, confirmed). */
export function FollowingRow({
  member,
  onOpen,
}: {
  member: MemberCard;
  onOpen: Open;
}) {
  return (
    <MemberCardView
      member={member}
      onPress={() => onOpen(member)}
      actions={
        <FollowButton
          targetId={member.id}
          state="following"
          name={member.name}
        />
      }
    />
  );
}

/** Blocked: no profile link or photo; 「ブロック解除」. */
export function BlockedRow({ member }: { member: MemberCard }) {
  return (
    <MemberCardView
      member={member}
      actions={<UnblockButton memberId={member.id} />}
    />
  );
}

/** 「〇〇さんのリクエストを承認しました。」 with a follow-back offer. */
export function AcceptedBanner({
  accepted,
  onOpen,
}: {
  accepted: NonNullable<FollowLists["accepted"]>;
  onOpen: Open;
}) {
  const t = useTranslations("follows");
  const { member, followState } = accepted;
  return (
    <View style={styles.accepted} accessibilityLiveRegion="polite">
      <View style={styles.acceptedTitle}>
        <CircleCheck size={16} color={colors.green700} aria-hidden />
        <Text
          variant="small"
          weight="semibold"
          style={styles.acceptedText}
          accessibilityRole="header"
        >
          {t("accepted.title", { name: member.name })}
        </Text>
      </View>
      <MemberCardView
        member={member}
        onPress={() => onOpen(member)}
        meta={
          followState === "followBack" || followState === "none"
            ? t("accepted.followBackHint")
            : null
        }
        actions={
          followState ? (
            <FollowButton
              targetId={member.id}
              state={followState}
              name={member.name}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Edge to edge, so the scrolling strip isn't cut at the page padding.
  strip: { marginHorizontal: -space.lg },
  tabs: {
    gap: space.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
  },
  tab: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
  },
  tabOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  tabPressed: { backgroundColor: colors.slate100 },
  action: { gap: space.xs },
  accepted: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.green100,
    backgroundColor: colors.green50,
  },
  acceptedTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  acceptedText: { flex: 1, color: colors.green700 },
});
