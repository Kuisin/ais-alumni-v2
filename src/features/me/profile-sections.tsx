import type { ChangeRequest, MyProfile } from "@contract/account";
import { type Href, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Cake, Eye, Lock, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Badge, Button, colors, space, Text } from "@/ui";
import { formatBirthDate, historyYears } from "./format";
import { Field, Fields, Notice, ReachTag, SectionCard } from "./parts";
import { RequestStatus } from "./request-status";

/**
 * My profile below the header, section by section as on the website's
 * /app/profile, read-only until editing is built into the app.
 */
export function ProfileSections({ profile }: { profile: MyProfile }) {
  return (
    <>
      <VisibilityCard id={profile.id} />
      <AboutCard profile={profile} />
      {profile.directoryListed !== null ? (
        <DirectoryCard listed={profile.directoryListed} />
      ) : null}
      <PhotoCard photo={profile.photo} />
      <FollowerFieldsCard shared={profile.sharedWithFollowers} />
      <HistoryCard history={profile.history} />
      {profile.currentStage ? <StageCard stage={profile.currentStage} /> : null}
      <RecordCard roles={profile.roles} />
      <NameCard names={profile.names} />
      <BirthDateCard birthDate={profile.birthDate} />
      <GenderCard gender={profile.gender} />
      <AccountCard account={profile.account} />
    </>
  );
}

const icon = (I: typeof Lock) => (
  <I size={18} color={colors.slate600} aria-hidden />
);

function VisibilityCard({ id }: { id: string }) {
  const tv = useTranslations("profile.visibility");
  const router = useRouter();
  return (
    <SectionCard title={tv("title")} description={tv("intro")}>
      <Text variant="small" weight="medium">
        {tv("viewAsTitle")}
      </Text>
      <View style={styles.wrap}>
        {(["members", "followers", "family"] as const).map((as) => (
          <Button
            key={as}
            variant="secondary"
            compact
            hitSlop={4}
            label={tv(`viewAs.${as}`)}
            icon={(c) => <Eye color={c} size={16} aria-hidden />}
            onPress={() =>
              router.push({
                pathname: "/members/[id]",
                params: { id, as },
              } as Href)
            }
          />
        ))}
      </View>
    </SectionCard>
  );
}

function AboutCard({ profile }: { profile: MyProfile }) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const { bio, phone, phoneReach, social, autoAcceptSameYear } = profile.about;
  return (
    <SectionCard title={t("sections.about")}>
      <Fields>
        <Field label={t("fields.bio")} reach="members">
          {bio ? (
            <Text selectable>{bio}</Text>
          ) : (
            <Text tone="subtle">{t("emptyPrompt.bio")}</Text>
          )}
        </Field>
        <Field label={t("fields.phone")} reach={phoneReach}>
          {phone ? (
            <Text selectable>{phone}</Text>
          ) : (
            <Text tone="subtle">{tc("notSet")}</Text>
          )}
        </Field>
        {social.map((s) => (
          <Field key={s.key} label={t(`fields.${s.key}`)} reach={s.reach}>
            <Text
              tone="brand"
              accessibilityRole="link"
              onPress={() => void WebBrowser.openBrowserAsync(s.url)}
              style={styles.link}
            >
              {s.url}
            </Text>
          </Field>
        ))}
        {autoAcceptSameYear !== null ? (
          <Field label={t("sections.follows")} reach="self">
            <Text>
              {`${t("autoAccept.label")}: `}
              <Text weight="bold">
                {autoAcceptSameYear ? tc("on") : tc("off")}
              </Text>
            </Text>
          </Field>
        ) : null}
      </Fields>
    </SectionCard>
  );
}

function DirectoryCard({ listed }: { listed: boolean }) {
  const t = useTranslations("profile.directory");
  return (
    <SectionCard title={t("title")}>
      <Text>{listed ? t("shown") : t("hidden")}</Text>
    </SectionCard>
  );
}

function PhotoCard({ photo }: { photo: MyProfile["photo"] }) {
  const t = useTranslations("profile");
  return (
    <SectionCard title={t("sections.photo")}>
      <Field label={t("photo.visibility")} reach={photo.reach}>
        {photo.public ? t("photo.everyone") : t("photo.onlyConnected")}
      </Field>
    </SectionCard>
  );
}

function FollowerFieldsCard({
  shared,
}: {
  shared: MyProfile["sharedWithFollowers"];
}) {
  const t = useTranslations("profile");
  return (
    <SectionCard
      title={t("followerFields.title")}
      description={t("hints.privateTier")}
    >
      {shared.length ? (
        <View style={styles.wrap}>
          {shared.map((f) => (
            <Badge
              key={f}
              tone="brand"
              label={t(`followerFields.fields.${f}`)}
            />
          ))}
        </View>
      ) : (
        <Text variant="small" tone="muted">
          {t("followerFields.noneShared")}
        </Text>
      )}
    </SectionCard>
  );
}

function HistoryCard({ history }: { history: MyProfile["history"] }) {
  const t = useTranslations("profile");
  const th = useTranslations("history");
  const { education, work } = history;
  return (
    <SectionCard title={t("sections.history")}>
      {education.length || work.length ? (
        <View style={styles.history}>
          {education.length ? (
            <View style={styles.gapSm}>
              <Text weight="semibold">{th("education")}</Text>
              <View style={styles.timeline}>
                {education.map((e) => (
                  <View key={e.id}>
                    <Text weight="medium">{e.school}</Text>
                    <Text variant="small" tone="muted">
                      {`${th(`levels.${e.level}`)}${e.field ? ` · ${e.field}` : ""} · ${historyYears(e, th("present"))}`}
                    </Text>
                    <ReachTag reach={e.reach} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {work.length ? (
            <View style={styles.gapSm}>
              <Text weight="semibold">{th("work")}</Text>
              <View style={styles.timeline}>
                {work.map((e) => (
                  <View key={e.id}>
                    <Text weight="medium">{e.company}</Text>
                    {[e.industry, e.jobType].map((line, i) =>
                      line ? (
                        <Text
                          // biome-ignore lint/suspicious/noArrayIndexKey: fixed pair
                          key={i}
                          variant="caption"
                          tone="subtle"
                        >
                          {line}
                        </Text>
                      ) : null,
                    )}
                    <Text variant="small" tone="muted">
                      {`${e.title ? `${e.title} · ` : ""}${historyYears(e, th("present"))}`}
                    </Text>
                    <ReachTag reach={e.reach} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <Text variant="small" tone="subtle">
          {t("historyIntro")}
        </Text>
      )}
    </SectionCard>
  );
}

function StageCard({
  stage,
}: {
  stage: NonNullable<MyProfile["currentStage"]>;
}) {
  const t = useTranslations("profile");
  const tr = useTranslations("roles");
  return (
    <SectionCard
      title={t("sections.currentStage")}
      description={t("stage.fromHistory")}
    >
      {stage.stage ? (
        <View style={styles.gapSm}>
          <View>
            <Text weight="medium">{tr(`stage.${stage.stage}`)}</Text>
            <ReachTag reach="members" />
          </View>
          {stage.detail ? (
            <View>
              <Text tone="muted" selectable>
                {stage.detail}
              </Text>
              <ReachTag reach={stage.detailReach} />
            </View>
          ) : null}
        </View>
      ) : (
        <Text tone="subtle">{t("stage.none")}</Text>
      )}
    </SectionCard>
  );
}

function RecordCard({ roles }: { roles: MyProfile["roles"] }) {
  const t = useTranslations("profile");
  return (
    <SectionCard
      title={t("sections.aisRecord")}
      description={t("recordReadOnly")}
    >
      <View style={styles.gapMd}>
        {roles.map((r) => (
          <View key={r.role}>
            <Text weight="medium">{r.label}</Text>
            <Text variant="small" tone="muted">
              {r.facts.length ? r.facts.join(" · ") : t("record.noDetails")}
            </Text>
            {r.subjects ? (
              <Text variant="small" tone="muted">
                {t("record.subjects", { subjects: r.subjects })}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <ReachTag reach="members" />
    </SectionCard>
  );
}

/** The status line + withdraw for a locked field's latest request. */
function useRequestLabels() {
  const ts = useTranslations("profile.nameRequest.status");
  return (s: ChangeRequest["status"]) => ts(s);
}

function NameCard({ names }: { names: MyProfile["names"] }) {
  const tn = useTranslations("profile.nameRequest");
  const tnames = useTranslations("common.names");
  const { locale } = useAuth();
  const statusLabel = useRequestLabels();
  const req = names.request;
  const rows: [string, string | null][] = [
    [tnames("romaji"), names.romaji],
    [tnames("kanjiShort"), names.kanji],
    [tnames("kanaShort"), names.kana],
    [tn("nameAtAis"), names.nameAtAis],
  ];
  return (
    <SectionCard
      icon={icon(Lock)}
      title={tn("title")}
      description={tn("lockedNote")}
    >
      <View style={styles.gapXs}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.pair}>
            <Text variant="small" tone="muted" style={styles.pairLabel}>
              {label}
            </Text>
            <Text selectable style={styles.pairValue}>
              {value || "—"}
            </Text>
          </View>
        ))}
        <ReachTag reach="members" />
      </View>
      <RequestStatus
        request={req}
        pendingText={
          req
            ? tn("pendingSince", { date: formatDate(req.createdAt, locale) })
            : ""
        }
        statusLabel={statusLabel}
        reviewNoteLabel={tn("reviewNote")}
        withdrawLabel={tn("cancel")}
      />
    </SectionCard>
  );
}

function BirthDateCard({ birthDate }: { birthDate: MyProfile["birthDate"] }) {
  const tb = useTranslations("profile.birthDate");
  const { locale } = useAuth();
  const statusLabel = useRequestLabels();
  const { value, request: req } = birthDate;
  const pending = req?.status === "PENDING";
  return (
    <SectionCard
      icon={icon(Cake)}
      title={tb("title")}
      description={tb("lockedNote")}
    >
      <View>
        {value ? (
          <Text variant="subheading" weight="medium">
            {formatBirthDate(value, locale)}
          </Text>
        ) : (
          <Text variant="subheading" weight="medium" tone="subtle">
            {tb("notSet")}
          </Text>
        )}
        <ReachTag reach="self" />
      </View>
      {!value && !pending ? <Notice>{tb("notSetHint")}</Notice> : null}
      <RequestStatus
        request={req}
        pendingText={
          req
            ? tb("pendingSince", {
                date: formatDate(req.createdAt, locale),
                value: formatBirthDate(req.proposed, locale),
              })
            : ""
        }
        statusLabel={statusLabel}
        reviewNoteLabel={tb("reviewNote")}
        withdrawLabel={tb("cancel")}
      />
    </SectionCard>
  );
}

const GENDERS = new Set(["MALE", "FEMALE", "OTHER"]);

function GenderCard({ gender }: { gender: MyProfile["gender"] }) {
  const tg = useTranslations("profile.gender");
  const tgs = useTranslations("profile.photo.genders");
  const { locale } = useAuth();
  const statusLabel = useRequestLabels();
  const { value, request: req } = gender;
  return (
    <SectionCard
      icon={icon(UserRound)}
      title={tg("title")}
      description={tg("lockedNote")}
    >
      <View>
        {value ? (
          <Text variant="subheading" weight="medium">
            {tgs(value)}
          </Text>
        ) : (
          <Text variant="subheading" weight="medium" tone="subtle">
            {tg("notSet")}
          </Text>
        )}
        <ReachTag reach="self" />
      </View>
      {!value ? <Notice>{tg("setOnceHint")}</Notice> : null}
      <RequestStatus
        request={req}
        pendingText={
          req
            ? tg("pendingSince", {
                date: formatDate(req.createdAt, locale),
                value: GENDERS.has(req.proposed)
                  ? tgs(req.proposed)
                  : req.proposed,
              })
            : ""
        }
        statusLabel={statusLabel}
        reviewNoteLabel={tg("reviewNote")}
        withdrawLabel={tg("cancel")}
      />
    </SectionCard>
  );
}

function AccountCard({ account }: { account: MyProfile["account"] }) {
  const t = useTranslations("profile");
  return (
    <SectionCard title={t("sections.account")}>
      <Fields>
        <Field label={t("fields.email")} reach={account.emailReach}>
          <Text selectable>{account.email || "—"}</Text>
          <Text variant="small" tone="subtle">
            {t("emailHint")}
          </Text>
        </Field>
        {account.lineDisplayName ? (
          <Field label={t("fields.lineDisplayName")} reach={account.lineReach}>
            {account.lineDisplayName}
          </Field>
        ) : null}
      </Fields>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  link: { textDecorationLine: "underline" },
  history: { gap: space.lg },
  timeline: {
    gap: space.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.brand100,
    paddingLeft: space.lg,
  },
  gapXs: { gap: space.xs },
  gapSm: { gap: space.sm },
  gapMd: { gap: space.md },
  pair: { flexDirection: "row", gap: space.lg },
  pairLabel: { width: 112, paddingTop: 2 },
  pairValue: { flex: 1 },
});
