import type { MemberProfile, ProfileAudience } from "@contract/people";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Eye, Lock } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  Avatar,
  Badge,
  Button,
  Card,
  colors,
  radius,
  space,
  Text,
  TOUCH,
} from "@/ui";
import { FollowButton, MessageButton, UnblockButton } from "./follow-button";

/**
 * The sections of a member's profile, as on the website's
 * /app/members/[id]: header (photo, names, badges, counts, follow /
 * message / unblock), 自己紹介, AIS在籍記録, 現在の状況, 学歴・職歴 and
 * 連絡先・リンク (with what is kept private, named but never shown).
 */

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.section}>
      <Text variant="subheading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Card>
  );
}

/** 「フォロワー N」「フォロー中 N」 (not linked: other people's lists are private). */
function FollowCounts({
  followers,
  following,
}: {
  followers: number;
  following: number;
}) {
  const t = useTranslations("follows");
  const b = (chunks: ReactNode) => (
    <Text variant="small" weight="semibold">
      {chunks}
    </Text>
  );
  return (
    <View style={styles.counts}>
      <Text variant="small" tone="muted">
        {t.rich("counts.followers", { count: followers, b })}
      </Text>
      <Text variant="small" tone="muted">
        {t.rich("counts.following", { count: following, b })}
      </Text>
    </View>
  );
}

export function ProfileHeader({ profile }: { profile: MemberProfile }) {
  const t = useTranslations("profile");
  const tf = useTranslations("follows");
  const tv = useTranslations("profile.visibility");
  const rel = profile.relationship;
  return (
    <Card style={styles.header}>
      <View style={styles.photo}>
        <Avatar uri={profile.avatar} size={96} />
        {profile.photoHidden ? (
          <Text variant="caption" tone="subtle">
            {tv("photoHidden")}
          </Text>
        ) : null}
      </View>
      <View style={styles.names}>
        <Text variant="heading" center selectable accessibilityRole="header">
          {profile.name}
        </Text>
        {profile.otherName ? (
          <Text tone="muted" center selectable>
            {profile.otherName}
          </Text>
        ) : null}
        {profile.nameAtAis ? (
          <Text variant="small" tone="muted" center>
            {t("nameAtAisValue", { name: profile.nameAtAis })}
          </Text>
        ) : null}
      </View>
      <View style={styles.badges}>
        {rel.family ? <Badge tone="green" label={tf("familyMember")} /> : null}
        {rel.followsYou ? (
          <Badge tone="slate" label={tf("followsYou")} />
        ) : null}
        {profile.roles.map((r) => (
          <Badge key={r} tone="brand" label={r} />
        ))}
      </View>
      <FollowCounts
        followers={profile.counts.followers}
        following={profile.counts.following}
      />
      {rel.follow || rel.blockedByMe ? (
        <View style={styles.actions}>
          {rel.follow ? (
            <View style={styles.follow}>
              <FollowButton
                targetId={profile.id}
                state={rel.follow}
                name={profile.name}
              />
              {rel.canRequest ? (
                <Text variant="small" tone="subtle" center>
                  {tf("followHint")}
                </Text>
              ) : null}
            </View>
          ) : null}
          {rel.canMessage ? <MessageButton memberId={profile.id} /> : null}
          {rel.blockedByMe ? <UnblockButton memberId={profile.id} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

/** 「〇〇として見る」: my own profile as an audience sees it. */
export function PreviewBanner({
  preview,
  onView,
  onBack,
}: {
  preview: ProfileAudience;
  onView: (as: ProfileAudience) => void;
  onBack: () => void;
}) {
  const tv = useTranslations("profile.visibility");
  const audiences: ProfileAudience[] = ["members", "followers", "family"];
  return (
    <View style={styles.info} accessibilityRole="summary">
      <Text weight="semibold" style={styles.infoText}>
        {tv(`previewTitle.${preview}`)}
      </Text>
      <Text variant="small" style={styles.infoText}>
        {tv("previewHint")}
      </Text>
      <View style={styles.viewAs}>
        {audiences.map((a) => (
          <Button
            key={a}
            compact
            variant={a === preview ? "primary" : "secondary"}
            label={tv(`viewAs.${a}`)}
            icon={(c) => <Eye size={16} color={c} aria-hidden />}
            accessibilityState={{ selected: a === preview }}
            onPress={() => onView(a)}
          />
        ))}
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={onBack}
        hitSlop={8}
        style={styles.backLink}
      >
        <Text variant="small" weight="semibold" style={styles.infoLink}>
          {tv("backToProfile")}
        </Text>
      </Pressable>
    </View>
  );
}

export function AboutSection({ bio }: { bio: string }) {
  const t = useTranslations("profile");
  return (
    <SectionCard title={t("sections.about")}>
      <Text selectable style={styles.body}>
        {bio}
      </Text>
    </SectionCard>
  );
}

export function RecordSection({ profile }: { profile: MemberProfile }) {
  const t = useTranslations("profile");
  return (
    <SectionCard title={t("sections.aisRecord")}>
      <View style={styles.list}>
        {profile.record.map((r) => (
          <View key={r.label} style={styles.item}>
            <Text weight="medium">{r.label}</Text>
            <Text variant="small" tone="muted">
              {r.details}
            </Text>
            {r.subjects ? (
              <Text variant="small" tone="muted">
                {r.subjects}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

export function StageSection({
  stage,
}: {
  stage: NonNullable<MemberProfile["currentStage"]>;
}) {
  const t = useTranslations("profile");
  return (
    <SectionCard title={t("sections.currentStage")}>
      <Text style={styles.body}>{stage.label ?? t("stageNotSet")}</Text>
      {stage.detail ? (
        <Text variant="small" tone="muted" selectable>
          {stage.detail}
        </Text>
      ) : null}
    </SectionCard>
  );
}

export function HistorySection({
  history,
}: {
  history: NonNullable<MemberProfile["history"]>;
}) {
  const t = useTranslations("profile");
  const th = useTranslations("history");
  const tv = useTranslations("profile.visibility");
  const shown = history.education.length + history.work.length > 0;
  return (
    <SectionCard title={t("sections.history")}>
      {history.education.length ? (
        <View style={styles.timelineBlock}>
          <Text weight="semibold">{th("education")}</Text>
          <View style={styles.timeline}>
            {history.education.map((e) => (
              <View key={e.id} style={styles.item}>
                <Text weight="medium">{e.school}</Text>
                <Text variant="small" tone="muted">
                  {`${e.level}${e.field ? ` · ${e.field}` : ""} · ${e.years}`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {history.work.length ? (
        <View style={styles.timelineBlock}>
          <Text weight="semibold">{th("work")}</Text>
          <View style={styles.timeline}>
            {history.work.map((e) => (
              <View key={e.id} style={styles.item}>
                <Text weight="medium">{e.company}</Text>
                {e.industry ? (
                  <Text variant="caption" tone="subtle">
                    {e.industry}
                  </Text>
                ) : null}
                {e.jobType ? (
                  <Text variant="caption" tone="subtle">
                    {e.jobType}
                  </Text>
                ) : null}
                <Text variant="small" tone="muted">
                  {`${e.title ? `${e.title} · ` : ""}${e.years}`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {history.hiddenCount > 0 ? (
        <Text
          variant="small"
          tone="muted"
          style={shown ? styles.hiddenNote : undefined}
        >
          {tv("historyHidden", { count: history.hiddenCount })}
        </Text>
      ) : null}
    </SectionCard>
  );
}

/** One contact value; links open mail / phone / the browser. */
function ContactRow({
  label,
  value,
  onPress,
  hint,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  hint?: string;
}) {
  const content = (
    <>
      <Text variant="small" tone="subtle">
        {label}
      </Text>
      <Text
        selectable={!onPress}
        style={onPress ? styles.link : undefined}
        numberOfLines={onPress ? 2 : undefined}
      >
        {value}
      </Text>
    </>
  );
  if (!onPress) return <View style={styles.contact}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.contact,
        pressed ? styles.contactPressed : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function ContactSection({ profile }: { profile: MemberProfile }) {
  const t = useTranslations("profile");
  const tb = useTranslations("profile.birthDate");
  const tv = useTranslations("profile.visibility");
  const tw = useTranslations("mobile.web");
  const c = profile.contact;
  const hasContact = Boolean(
    c.email || c.phone || c.lineDisplayName || c.social.length,
  );
  const lockedText =
    c.locked === "familyOnly"
      ? t("locked.familyOnly", { name: profile.name })
      : c.locked === "requested"
        ? t("locked.requested")
        : c.locked === "body"
          ? t("locked.body", { name: profile.name })
          : t("locked.unavailable");
  const hiddenLabels = c.hidden.map((f) =>
    f === "birthDate" ? tb("title") : t(`followerFields.fields.${f}`),
  );
  const open = (url: string) => void Linking.openURL(url).catch(() => {});

  return (
    <SectionCard title={t("sections.contact")}>
      {c.access === "followers" && hasContact ? (
        <Text variant="small" tone="subtle">
          {t("sharedWithFollowers")}
        </Text>
      ) : null}
      {c.locked === null ? (
        <View style={styles.contacts}>
          {c.birthDate ? (
            <View style={styles.contact}>
              <Text variant="small" tone="subtle">
                {tb("title")}
              </Text>
              <Text tone={c.birthDate.value ? "default" : "subtle"}>
                {c.birthDate.value ?? tb("notSet")}
              </Text>
            </View>
          ) : null}
          {c.email ? (
            <ContactRow
              label={t("fields.email")}
              value={c.email}
              onPress={() => open(`mailto:${c.email}`)}
            />
          ) : null}
          {c.phone ? (
            <ContactRow
              label={t("fields.phone")}
              value={c.phone}
              onPress={() =>
                open(`tel:${(c.phone ?? "").replace(/[^0-9+]/g, "")}`)
              }
            />
          ) : null}
          {c.lineDisplayName ? (
            <ContactRow
              label={t("fields.lineDisplayName")}
              value={c.lineDisplayName}
            />
          ) : null}
          {c.social.map((s) => (
            <ContactRow
              key={s.key}
              label={t(`fields.${s.key}`)}
              value={s.url}
              hint={tw("openInBrowser")}
              onPress={() => void WebBrowser.openBrowserAsync(s.url)}
            />
          ))}
          {!hasContact ? (
            <Text tone="muted">
              {c.access === "followers"
                ? t("noContactFollowers")
                : t("noContact")}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.info}>
          <Text weight="semibold" style={styles.infoText}>
            {t("locked.title")}
          </Text>
          <Text variant="small" style={styles.infoText}>
            {lockedText}
          </Text>
        </View>
      )}
      {hiddenLabels.length ? (
        <View style={styles.hidden}>
          <Text variant="small" tone="muted">
            {tv("hiddenTitle")}
          </Text>
          <View style={styles.chips}>
            {hiddenLabels.map((l) => (
              <View
                key={l}
                style={styles.chip}
                accessible
                accessibilityLabel={`${l}: ${tv("hidden")}`}
              >
                <Lock size={12} color={colors.slate500} aria-hidden />
                <Text variant="caption" weight="medium" tone="muted">
                  {l}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  header: { alignItems: "center", gap: space.md, paddingVertical: space.xl },
  photo: { alignItems: "center", gap: space.xs },
  names: { alignItems: "center", gap: 2 },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.xs,
  },
  counts: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: space.lg,
    rowGap: space.xs,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: space.sm,
    marginTop: space.xs,
  },
  follow: { alignItems: "center", gap: space.xs, maxWidth: 320 },
  info: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand200,
    backgroundColor: colors.brand50,
  },
  infoText: { color: colors.brand900 },
  infoLink: { color: colors.brand900, textDecorationLine: "underline" },
  viewAs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
  },
  backLink: {
    alignSelf: "flex-start",
    minHeight: TOUCH,
    justifyContent: "center",
  },
  body: { color: colors.slate800 },
  list: { gap: space.md },
  item: { gap: 2 },
  timelineBlock: { gap: space.sm },
  timeline: {
    gap: space.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.brand100,
    paddingLeft: space.lg,
  },
  hiddenNote: { marginTop: space.xs },
  contacts: { gap: space.xs },
  contact: {
    minHeight: TOUCH,
    justifyContent: "center",
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
  contactPressed: { backgroundColor: colors.slate100 },
  link: { color: colors.brand700, textDecorationLine: "underline" },
  hidden: {
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
  },
});
