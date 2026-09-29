import type {
  NewsDetail,
  NewsPoll,
  NewsReaction,
  NewsVote,
} from "@contract/news";
import type { UseMutationResult } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  CalendarClock,
  ChevronDown,
  Circle,
  CircleCheck,
  CircleDot,
  EyeOff,
  ListChecks,
  MessageSquare,
  Square,
  SquareCheck,
  Trash2,
  Vote as VoteIcon,
} from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  Badge,
  Button,
  colors,
  font,
  radius,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";
import {
  useAddComment,
  useConfirm,
  useDeleteComment,
  useHideComment,
  useHubErrorMessage,
  useToggleReaction,
  useVote,
} from "./api";
import { HubSection, Notice, useHubFormat } from "./parts";

/**
 * The hub under a post (the website's news-hub.tsx): 確認, アンケート,
 * 日程調整, reactions and comments, with the same rules for what shows
 * when (open, admin view, comments off).
 */

const ICON = { size: 20, color: colors.brand700 } as const;

function done() {
  if (Platform.OS !== "web")
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
}

function tap() {
  if (Platform.OS !== "web")
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Small text action with a full touch target (ghost buttons on the website). */
function TextAction({
  label,
  onPress,
  disabled,
  danger = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: (color: string) => ReactNode;
}) {
  const color = danger ? colors.red700 : colors.brand700;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.textAction,
        pressed ? styles.textActionPressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {icon ? icon(color) : null}
      <Text variant="small" weight="semibold" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---- 確認 ----

export function ConfirmCard({ post }: { post: NewsDetail }) {
  const t = useTranslations("news.hub.confirm");
  const fmt = useHubFormat();
  const message = useHubErrorMessage();
  const confirm = useConfirm(post.id);
  // Shown to an admin outside the audience: results only.
  const readOnly = post.adminView;
  return (
    <HubSection icon={<ListChecks {...ICON} aria-hidden />} title={t("title")}>
      {confirm.error ? (
        <Notice tone="error">{message(confirm.error)}</Notice>
      ) : null}
      {post.confirmedAt ? (
        <View style={styles.wrapRow}>
          <View style={styles.donePill}>
            <CircleCheck size={20} color={colors.green700} aria-hidden />
            <Text variant="small" weight="medium" style={styles.doneText}>
              {t("done", { time: fmt(post.confirmedAt) })}
            </Text>
          </View>
          {post.open && !readOnly ? (
            <TextAction
              label={t("undo")}
              disabled={confirm.isPending}
              onPress={() => confirm.mutate(false)}
            />
          ) : null}
        </View>
      ) : readOnly ? null : (
        <>
          <Text variant="small" tone="muted">
            {t("hint")}
          </Text>
          <Button
            label={t("button")}
            loading={confirm.isPending}
            icon={(c) => <CircleCheck size={18} color={c} aria-hidden />}
            onPress={() => confirm.mutate(true, { onSuccess: done })}
          />
        </>
      )}
      <Text variant="caption" tone="subtle">
        {t("count", { count: post.confirmCount })}
      </Text>
    </HubSection>
  );
}

// ---- アンケート ----

export function PollCard({
  postId,
  poll,
  open,
}: {
  postId: string;
  poll: NewsPoll;
  open: boolean;
}) {
  const t = useTranslations("news.hub.poll");
  const message = useHubErrorMessage();
  const vote = useVote(postId);
  const mine = poll.options.filter((o) => o.mine === "YES").map((o) => o.id);
  const [editing, setEditing] = useState(mine.length === 0);
  const [chosen, setChosen] = useState<string[]>(mine);
  const max = Math.max(1, ...poll.options.map((o) => o.counts.YES));
  const showForm = open && editing;

  const choose = (id: string) =>
    setChosen((c) =>
      poll.multiple
        ? c.includes(id)
          ? c.filter((x) => x !== id)
          : [...c, id]
        : [id],
    );

  const submit = () =>
    vote.mutate(
      {
        pollId: poll.id,
        choices: Object.fromEntries(
          chosen.map((id) => [id, "YES" as NewsVote]),
        ),
      },
      {
        onSuccess: () => {
          setEditing(false);
          done();
        },
      },
    );

  return (
    <HubSection icon={<VoteIcon {...ICON} aria-hidden />} title={t("title")}>
      <Text variant="body" weight="medium">
        {poll.question}
      </Text>
      {vote.error ? <Notice tone="error">{message(vote.error)}</Notice> : null}
      {showForm ? (
        <View style={styles.gapMd}>
          <View
            accessibilityRole={poll.multiple ? undefined : "radiogroup"}
            accessibilityLabel={poll.question}
            style={styles.gapSm}
          >
            <Text variant="small" tone="muted">
              {poll.multiple ? t("multiple") : t("single")}
            </Text>
            {poll.options.map((o) => {
              const on = chosen.includes(o.id);
              const Mark = poll.multiple
                ? on
                  ? SquareCheck
                  : Square
                : on
                  ? CircleDot
                  : Circle;
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole={poll.multiple ? "checkbox" : "radio"}
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.label}
                  onPress={() => choose(o.id)}
                  style={({ pressed }) => [
                    styles.choice,
                    on ? styles.choiceOn : null,
                    pressed ? styles.choicePressed : null,
                  ]}
                >
                  <Mark
                    size={20}
                    color={on ? colors.brand700 : colors.slate400}
                    aria-hidden
                  />
                  <Text variant="body" style={styles.flex}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button
            label={mine.length ? t("update") : t("submit")}
            loading={vote.isPending}
            disabled={chosen.length === 0}
            onPress={submit}
          />
        </View>
      ) : (
        <View style={styles.gapSm}>
          {poll.options.map((o) => (
            <View
              key={o.id}
              accessible
              accessibilityLabel={`${o.label}: ${o.counts.YES}${o.mine ? ` (${t("yours")})` : ""}`}
              style={styles.result}
            >
              <View style={styles.resultHead}>
                <View style={styles.inline}>
                  {o.mine ? (
                    <CircleCheck
                      size={16}
                      color={colors.brand700}
                      aria-hidden
                    />
                  ) : null}
                  <Text
                    variant="small"
                    weight={o.mine ? "semibold" : undefined}
                    style={o.mine ? styles.mineText : styles.flexShrink}
                  >
                    {o.label}
                  </Text>
                </View>
                <Text variant="small" tone="muted" style={styles.tabular}>
                  {String(o.counts.YES)}
                </Text>
              </View>
              <View style={styles.bar}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${(o.counts.YES / max) * 100}%`,
                      backgroundColor: o.mine
                        ? colors.brand700
                        : colors.slate400,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={styles.footer}>
        <Text variant="caption" tone="subtle">
          {t("voters", { count: poll.voters })}
        </Text>
        {!showForm && open ? (
          <TextAction
            label={mine.length ? t("update") : t("submit")}
            onPress={() => setEditing(true)}
          />
        ) : null}
      </View>
    </HubSection>
  );
}

// ---- 日程調整 ----

const ANSWERS: NewsVote[] = ["YES", "MAYBE", "NO"];
const ANSWER_TONE: Record<
  NewsVote,
  { border: string; bg: string; fg: string }
> = {
  YES: { border: colors.green700, bg: colors.green50, fg: colors.green700 },
  MAYBE: { border: colors.amber400, bg: colors.amber50, fg: colors.amber900 },
  NO: { border: colors.red700, bg: colors.red50, fg: colors.red700 },
};

function Names({ names }: { names: NewsPoll["options"][number]["names"] }) {
  const t = useTranslations("news.hub.schedule");
  const [shown, setShown] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: shown }}
        onPress={() => setShown((s) => !s)}
        style={styles.toggle}
        hitSlop={4}
      >
        <Text variant="small" tone="muted">
          {t("answers")}
        </Text>
        <ChevronDown
          size={16}
          color={colors.slate500}
          aria-hidden
          style={shown ? styles.flip : undefined}
        />
      </Pressable>
      {shown ? (
        <View style={styles.names}>
          {names.map((n, i) => (
            <Text
              // biome-ignore lint/suspicious/noArrayIndexKey: names may repeat
              key={i}
              variant="small"
              tone="muted"
            >
              {`${t(n.answer)} ${n.name}`}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ScheduleCard({
  postId,
  poll,
  open,
}: {
  postId: string;
  poll: NewsPoll;
  open: boolean;
}) {
  const t = useTranslations("news.hub.schedule");
  const fmt = useHubFormat();
  const message = useHubErrorMessage();
  const vote = useVote(postId);
  const initial = Object.fromEntries(
    poll.options.flatMap((o) => (o.mine ? [[o.id, o.mine]] : [])),
  ) as Record<string, NewsVote>;
  const answered = Object.keys(initial).length > 0;
  const [answers, setAnswers] = useState<Record<string, NewsVote>>(initial);
  const [saved, setSaved] = useState(false);
  // View first once answered; answers change only via the button.
  const [editing, setEditing] = useState(open && !answered);
  const edit = open && editing;
  const complete = poll.options.every((o) => answers[o.id]);

  const submit = () =>
    vote.mutate(
      { pollId: poll.id, choices: answers },
      {
        onSuccess: () => {
          setSaved(true);
          setEditing(false);
          done();
        },
      },
    );

  return (
    <HubSection
      icon={<CalendarClock {...ICON} aria-hidden />}
      title={t("title")}
    >
      {poll.question ? (
        <Text variant="body" weight="medium">
          {poll.question}
        </Text>
      ) : null}
      {vote.error ? <Notice tone="error">{message(vote.error)}</Notice> : null}
      {saved ? <Notice tone="success">{t("saved")}</Notice> : null}
      <View style={styles.candidates}>
        {poll.options.map((o, i) => {
          const date = o.startsAt ? fmt(o.startsAt) : o.label;
          return (
            <View
              key={o.id}
              style={[styles.candidate, i > 0 ? styles.candidateLine : null]}
            >
              <View style={styles.candidateHead}>
                <View style={[styles.wrapRow, styles.flex]}>
                  <Text variant="body" weight="medium">
                    {date}
                    {o.startsAt && o.label ? (
                      <Text variant="small" tone="muted" weight="regular">
                        {`  ${o.label}`}
                      </Text>
                    ) : null}
                  </Text>
                  {o.best ? <Badge tone="green" label={t("best")} /> : null}
                </View>
                <Text variant="small" tone="muted" style={styles.tabular}>
                  {t("counts", {
                    yes: o.counts.YES,
                    maybe: o.counts.MAYBE,
                    no: o.counts.NO,
                  })}
                </Text>
              </View>
              {edit ? (
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t("answerFor", { date })}
                  style={styles.answers}
                >
                  {ANSWERS.map((a) => {
                    const on = answers[o.id] === a;
                    const tone = ANSWER_TONE[a];
                    return (
                      <Pressable
                        key={a}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={t(`${a}Label`)}
                        onPress={() => {
                          setSaved(false);
                          setAnswers((x) => ({ ...x, [o.id]: a }));
                        }}
                        style={[
                          styles.answer,
                          on
                            ? {
                                borderColor: tone.border,
                                backgroundColor: tone.bg,
                              }
                            : null,
                        ]}
                      >
                        <Text
                          variant="subheading"
                          style={on ? { color: tone.fg } : undefined}
                        >
                          {t(a)}
                        </Text>
                        <Text
                          variant="caption"
                          style={on ? { color: tone.fg } : undefined}
                        >
                          {t(`${a}Label`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : o.mine ? (
                <Text variant="small">{`${t(o.mine)} ${t(`${o.mine}Label`)}`}</Text>
              ) : null}
              {o.names.length ? <Names names={o.names} /> : null}
            </View>
          );
        })}
      </View>
      {edit ? (
        <View style={styles.gapSm}>
          {!complete ? (
            <Text variant="small" tone="muted">
              {t("needAll")}
            </Text>
          ) : null}
          <Button
            label={answered ? t("save") : t("submit")}
            loading={vote.isPending}
            disabled={!complete}
            onPress={submit}
          />
          {answered ? (
            <Button
              variant="ghost"
              label={t("cancel")}
              disabled={vote.isPending}
              onPress={() => {
                setAnswers(initial);
                setEditing(false);
              }}
            />
          ) : null}
        </View>
      ) : open ? (
        <Button
          variant="secondary"
          label={t("update")}
          onPress={() => {
            setSaved(false);
            setAnswers(initial);
            setEditing(true);
          }}
        />
      ) : null}
    </HubSection>
  );
}

// ---- リアクション ----

export function Reactions({
  postId,
  reactions,
}: {
  postId: string;
  reactions: NewsReaction[];
}) {
  const t = useTranslations("news.hub.reactions");
  const message = useHubErrorMessage();
  const toggle = useToggleReaction(postId);
  return (
    <View style={styles.gapSm}>
      <View accessibilityLabel={t("label")} style={styles.reactions}>
        {reactions.map((r) => (
          <Pressable
            key={r.emoji}
            accessibilityRole="togglebutton"
            accessibilityState={{ checked: r.mine, disabled: toggle.isPending }}
            accessibilityLabel={t("toggle", { emoji: r.emoji, count: r.count })}
            disabled={toggle.isPending}
            onPress={() => {
              tap();
              toggle.mutate(r.emoji);
            }}
            style={({ pressed }) => [
              styles.reaction,
              r.mine ? styles.reactionOn : null,
              pressed ? styles.choicePressed : null,
            ]}
          >
            <Text variant="body">{r.emoji}</Text>
            {r.count ? (
              <Text
                variant="small"
                style={[styles.tabular, r.mine ? styles.mineText : null]}
              >
                {String(r.count)}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      {toggle.error ? (
        <Notice tone="error">{message(toggle.error)}</Notice>
      ) : null}
    </View>
  );
}

// ---- コメント ----

function askToDelete(
  question: string,
  labels: { cancel: string; delete: string },
  onYes: () => void,
) {
  if (Platform.OS === "web") {
    const confirm = (globalThis as { confirm?: (m: string) => boolean })
      .confirm;
    if (!confirm || confirm(question)) onYes();
    return;
  }
  Alert.alert(question, undefined, [
    { text: labels.cancel, style: "cancel" },
    { text: labels.delete, style: "destructive", onPress: onYes },
  ]);
}

export function Comments({
  post,
  onInputFocus,
}: {
  post: NewsDetail;
  /** the comment box got focus (the screen scrolls it above the keyboard) */
  onInputFocus?: () => void;
}) {
  const t = useTranslations("news.hub.comments");
  const tc = useTranslations("common");
  const fmt = useHubFormat();
  const message = useHubErrorMessage();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = useAddComment(post.id);
  const remove = useDeleteComment(post.id);
  const hide = useHideComment(post.id);
  const pending = add.isPending || remove.isPending || hide.isPending;

  // One error line for the section, as on the website.
  function run<V>(
    m: UseMutationResult<unknown, Error, V>,
    v: V,
    onOk?: () => void,
  ) {
    setError(null);
    m.mutate(v, {
      onSuccess: () => onOk?.(),
      onError: (e) => setError(message(e)),
    });
  }

  return (
    <HubSection
      icon={<MessageSquare {...ICON} aria-hidden />}
      title={t("title")}
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {post.comments.length === 0 ? (
        <Text variant="small" tone="muted">
          {t("empty")}
        </Text>
      ) : (
        <View style={styles.gapMd}>
          {post.comments.map((c) => (
            <View
              key={c.id}
              style={[styles.comment, c.hidden ? styles.commentHidden : null]}
            >
              <View style={styles.commentHead}>
                <Text variant="small" weight="semibold" style={styles.flex}>
                  {c.name}
                </Text>
                <Text variant="caption" tone="subtle">
                  {fmt(c.createdAt, false)}
                </Text>
              </View>
              {c.hidden ? (
                <View style={styles.inline}>
                  <EyeOff size={14} color={colors.amber800} aria-hidden />
                  <Text variant="caption" style={styles.hiddenText}>
                    {t("hidden")}
                  </Text>
                </View>
              ) : null}
              <Text variant="small" selectable style={styles.commentBody}>
                {c.body}
              </Text>
              {c.mine || post.isAdmin ? (
                <View style={styles.commentActions}>
                  {post.isAdmin ? (
                    <TextAction
                      label={c.hidden ? t("show") : t("hide")}
                      disabled={pending}
                      onPress={() =>
                        run(hide, { commentId: c.id, hide: !c.hidden })
                      }
                    />
                  ) : null}
                  <TextAction
                    danger
                    label={t("delete")}
                    disabled={pending}
                    icon={(color) => (
                      <Trash2 size={14} color={color} aria-hidden />
                    )}
                    onPress={() =>
                      askToDelete(
                        t("deleteConfirm"),
                        { cancel: tc("cancel"), delete: t("delete") },
                        () => run(remove, c.id),
                      )
                    }
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
      {post.allowComments ? (
        <View style={styles.gapSm}>
          <TextField
            label={t("label")}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={post.maxCommentLength}
            textAlignVertical="top"
            onFocus={onInputFocus}
            style={styles.textarea}
          />
          <Button
            label={t("submit")}
            loading={add.isPending}
            disabled={!text.trim() || pending}
            onPress={() => run(add, text, () => setText(""))}
          />
        </View>
      ) : (
        <Text variant="small" tone="muted">
          {t("off")}
        </Text>
      )}
    </HubSection>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  gapSm: { gap: space.sm },
  gapMd: { gap: space.md },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  disabled: { opacity: 0.5 },
  tabular: { fontVariant: ["tabular-nums"] },
  textAction: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    alignSelf: "flex-start",
  },
  textActionPressed: { backgroundColor: colors.brand50 },
  donePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.green50,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  doneText: { color: colors.green700 },
  choice: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.white,
  },
  choiceOn: { borderColor: colors.brand700, backgroundColor: colors.brand50 },
  choicePressed: { opacity: 0.8 },
  result: { gap: 4 },
  resultHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  mineText: { color: colors.brand800, flexShrink: 1 },
  bar: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: radius.full },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  candidates: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  candidate: { padding: space.md, gap: space.sm },
  candidateLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  candidateHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  answers: { flexDirection: "row", gap: space.sm },
  answer: {
    flex: 1,
    minHeight: TOUCH + 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    paddingVertical: 4,
    backgroundColor: colors.white,
  },
  toggle: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  flip: { transform: [{ rotate: "180deg" }] },
  names: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reaction: {
    minHeight: TOUCH,
    minWidth: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    backgroundColor: colors.white,
  },
  reactionOn: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  comment: {
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
  },
  commentHidden: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.slate300,
  },
  commentHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.sm,
  },
  hiddenText: { color: colors.amber800 },
  commentBody: { color: colors.slate800 },
  commentActions: { flexDirection: "row", gap: 4, marginLeft: -space.md },
  textarea: {
    minHeight: 88,
    paddingTop: space.sm,
    fontSize: font.size.md,
  },
});
