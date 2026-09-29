import type {
  VerificationChildCard,
  VerificationDetail,
  VerificationEvidence,
} from "@contract/admin";
import type { Locale } from "@contract/core";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Baby,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileText,
  MailPlus,
  TriangleAlert,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { confirmAction } from "@/features/me/confirm";
import { absoluteUrl } from "@/lib/config";
import { formatDate, formatDateTime } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import {
  Badge,
  Button,
  colors,
  EmptyState,
  ListGroup,
  radius,
  Separator,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";
import { useAddVoucher, useMergeManaged, useVoucherCandidates } from "./api";
import { DetailCard, formatSize, Inset, Rows } from "./parts";

/** A member in 管理モード, when the app has that screen. */
function useMemberLink() {
  const router = useRouter();
  return (id: string) => {
    const href = hrefFor(`/app/admin/members/${id}`);
    return href ? () => router.push(href) : null;
  };
}

function LinkText({
  label,
  onPress,
  weight = "medium",
}: {
  label: string;
  onPress: (() => void) | null;
  weight?: "medium" | "semibold";
}) {
  if (!onPress) return <Text weight={weight}>{label}</Text>;
  return (
    <Text
      weight={weight}
      tone="brand"
      accessibilityRole="link"
      onPress={onPress}
      style={styles.underline}
    >
      {label}
    </Text>
  );
}

// ---- 前回の判断 / アカウント ----

export function LastDecisionCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify");
  const locale = useLocale() as Locale;
  if (!d.lastDecision) return null;
  const { decidedAt, reviewer, note } = d.lastDecision;
  return (
    <DetailCard title={t("detail.lastDecision")}>
      <Rows
        rows={[
          {
            label: t("detail.decidedAt"),
            value: decidedAt
              ? `${formatDateTime(decidedAt, locale)}${reviewer ? ` · ${reviewer}` : ""}`
              : "",
          },
          { label: t("detail.note"), value: note ?? "" },
        ]}
      />
    </DetailCard>
  );
}

export function AccountCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify");
  const tr = useTranslations("roles");
  const locale = useLocale() as Locale;
  const a = d.account;
  return (
    <DetailCard title={t("detail.account")}>
      <Rows
        rows={[
          { label: t("detail.email"), value: a.email ?? "—" },
          { label: t("detail.state"), value: tr(`state.${a.state}`) },
          {
            label: t("detail.dob"),
            value: a.dateOfBirth ? formatDate(a.dateOfBirth, locale) : "",
          },
          {
            label: t("detail.schoolEmail"),
            value: a.schoolEmail
              ? `${a.schoolEmail.address} ${a.schoolEmail.verified ? t("detail.verified") : t("detail.unverified")}`
              : "",
          },
          {
            label: t("detail.parents"),
            value: a.parents
              .map(
                (p) =>
                  `${p.name} (${p.confirmed ? t("detail.confirmed") : t("detail.unconfirmed")})`,
              )
              .join(", "),
          },
          {
            label: t("detail.children"),
            value: a.children
              .map(
                (c) => `${c.name}${c.linked ? ` (${t("detail.linked")})` : ""}`,
              )
              .join(", "),
          },
        ]}
      />
    </DetailCard>
  );
}

// ---- 招待 ----

export function InviteCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify.invite");
  const locale = useLocale() as Locale;
  const memberLink = useMemberLink();
  const inv = d.invite;
  if (!inv) return null;
  const MatchIcon =
    inv.match === "match"
      ? CircleCheck
      : inv.match === "mismatch"
        ? CircleAlert
        : null;
  const fg =
    inv.match === "match"
      ? colors.green700
      : inv.match === "mismatch"
        ? colors.amber900
        : colors.slate800;
  return (
    <DetailCard
      title={t("title")}
      icon={MailPlus}
      tone={
        inv.match === "match"
          ? "green"
          : inv.match === "mismatch"
            ? "amber"
            : "slate"
      }
    >
      <Text variant="small">
        {t.rich("by", {
          name: () => (
            <LinkText
              label={inv.inviterName}
              weight="semibold"
              onPress={memberLink(inv.inviterId)}
            />
          ),
          date: formatDate(inv.createdAt, locale),
        })}
      </Text>
      <Text variant="small" weight="semibold">
        {inv.kind === "GRADE"
          ? t("kindGrade", { count: inv.uses, max: inv.maxUses })
          : t("kindIndividual")}
      </Text>
      <Text variant="small">
        {t("said", { what: inv.said })}
        {inv.inviteeName ? ` · ${t("name", { name: inv.inviteeName })}` : ""}
      </Text>
      <View style={styles.inline}>
        {MatchIcon ? <MatchIcon size={16} color={fg} aria-hidden /> : null}
        <Text variant="small" weight="medium" style={{ color: fg }}>
          {t(`match.${inv.match}`)}
        </Text>
      </View>
    </DetailCard>
  );
}

// ---- 保護者が登録した同一人物 ----

export function ManagedDuplicateCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify.managedDuplicate");
  const tv = useTranslations("adminVerify");
  const tc = useTranslations("common");
  const memberLink = useMemberLink();
  const merge = useMergeManaged(d.id);
  if (d.managedDuplicates.length === 0) return null;
  const onMerge = async (m: { id: string; name: string }) => {
    const ok = await confirmAction({
      title: t("merge"),
      message: t("mergeConfirm", { name: m.name }),
      confirm: t("merge"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) merge.mutate(m.id);
  };
  return (
    <DetailCard title={t("title")} icon={TriangleAlert} tone="amber">
      <Text variant="small" style={{ color: colors.amber900 }}>
        {t("body")}
      </Text>
      {d.managedDuplicates.map((m) => (
        <View key={m.id} style={styles.whiteBox}>
          <LinkText label={m.name} onPress={memberLink(m.id)} />
          <Text variant="small" tone="muted">
            {t("registeredBy", { parent: m.registeredBy })}
          </Text>
          <Button
            label={t("merge")}
            variant="secondary"
            compact
            loading={merge.isPending && merge.variables === m.id}
            disabled={merge.isPending}
            onPress={() => onMerge(m)}
          />
        </View>
      ))}
      {merge.isError ? (
        <Text variant="small" tone="danger">
          {tv("messages.generic")}
        </Text>
      ) : null}
    </DetailCard>
  );
}

// ---- お子さまの在籍情報 (parents) ----

export function ChildrenCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify.children");
  if (!d.children) return null;
  return (
    <DetailCard title={t("title")}>
      <Text variant="small" tone="muted">
        {t("description")}
      </Text>
      {d.children.length === 0 ? (
        <Text variant="small" tone="muted">
          {t("none")}
        </Text>
      ) : (
        d.children.map((c) => <ChildBox key={c.linkId} c={c} />)
      )}
    </DetailCard>
  );
}

function ChildBox({ c }: { c: VerificationChildCard }) {
  const t = useTranslations("adminVerify.children");
  const locale = useLocale() as Locale;
  const memberLink = useMemberLink();
  const x = c.details;
  const roster = x?.roster;
  return (
    <View style={styles.childBox}>
      <View style={styles.inline}>
        <Baby size={16} color={colors.brand700} aria-hidden />
        <LinkText
          label={c.name}
          weight="semibold"
          onPress={c.childId ? memberLink(c.childId) : null}
        />
      </View>
      <View style={styles.badges}>
        <Badge
          label={t(`source.${c.source}`)}
          tone={
            c.source === "nameOnly"
              ? "amber"
              : c.source === "created"
                ? "brand"
                : "slate"
          }
        />
        {c.link ? (
          <Badge
            label={t(`link.${c.link}`)}
            tone={c.link === "confirmed" ? "green" : "amber"}
          />
        ) : null}
      </View>
      {x ? (
        <Rows
          rows={[
            {
              label: t("dob"),
              value: x.dateOfBirth ? formatDate(x.dateOfBirth, locale) : "—",
            },
            { label: t("cohort"), value: x.cohort ?? "—" },
            { label: t("status"), value: x.status ?? "—" },
            { label: t("years"), value: x.years },
            { label: t("studentId"), value: x.studentId ?? "" },
            {
              label: t("roster"),
              value: !roster ? null : roster.score === null ? (
                <Text variant="small" tone="subtle">
                  {t("rosterNone")}
                </Text>
              ) : (
                <View style={styles.inline}>
                  {roster.match ? (
                    <CircleCheck
                      size={16}
                      color={colors.green700}
                      aria-hidden
                    />
                  ) : (
                    <CircleAlert
                      size={16}
                      color={colors.amber800}
                      aria-hidden
                    />
                  )}
                  <Text
                    variant="small"
                    style={{
                      color: roster.match ? colors.green700 : colors.amber800,
                    }}
                  >
                    {roster.match
                      ? t("rosterMatch", { score: roster.score })
                      : t("rosterWeak", { score: roster.score })}
                  </Text>
                </View>
              ),
            },
          ]}
        />
      ) : (
        <Text variant="small" tone="muted">
          {t("nameOnlyHint")}
        </Text>
      )}
    </View>
  );
}

// ---- 回答内容 ----

export function AnswersCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify");
  return (
    <DetailCard title={t("detail.answers")}>
      {d.answers === null ? (
        <Text variant="small" tone="muted">
          {t("detail.oldFormat")}
        </Text>
      ) : (
        d.answers.map((s) => (
          <View key={s.title} style={styles.answerSection}>
            <Text weight="semibold">{s.title}</Text>
            {s.rows.length ? <Rows rows={s.rows} /> : null}
            {s.items?.map((rows, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: answers are a fixed list
              <Inset key={i}>
                <Rows rows={rows} />
              </Inset>
            ))}
          </View>
        ))
      )}
    </DetailCard>
  );
}

// ---- 名簿との照合 ----

export function RosterCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify");
  const tr = useTranslations("roles");
  const r = d.roster;
  return (
    <DetailCard title={t("detail.roster")}>
      {!r ? (
        <Text variant="small" tone="muted">
          {t("detail.noRoster")}
        </Text>
      ) : (
        <>
          <View style={styles.inlineWrap}>
            <Badge
              label={t("badges.roster", { score: r.score })}
              tone={r.match ? "green" : "amber"}
            />
            <Text variant="small">
              {r.match ? t("detail.rosterMatch") : t("detail.rosterWeak")}
            </Text>
          </View>
          {r.row ? (
            <Inset>
              <Rows
                rows={[
                  { label: t("roster.nameRomaji"), value: r.row.nameRomaji },
                  {
                    label: t("roster.nameKanji"),
                    value: r.row.nameKanji ?? "—",
                  },
                  { label: t("roster.dob"), value: r.row.dateOfBirth ?? "—" },
                  { label: t("roster.years"), value: r.row.years },
                  { label: t("roster.kind"), value: tr(`role.${r.row.kind}`) },
                  {
                    label: t("roster.claimed"),
                    value:
                      r.row.claimed === "applicant"
                        ? t("roster.claimedByApplicant")
                        : r.row.claimed === "other"
                          ? t("roster.claimedByOther")
                          : "",
                  },
                ]}
              />
            </Inset>
          ) : (
            <Text variant="small" tone="muted">
              {t("detail.rosterRowGone")}
            </Text>
          )}
        </>
      )}
    </DetailCard>
  );
}

// ---- 推薦 ----

export function VouchesCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify");
  const tv = useTranslations("vouch");
  const locale = useLocale() as Locale;
  return (
    <DetailCard title={t("detail.vouches")}>
      {d.vouches.length ? (
        <View>
          {d.vouches.map((v, i) => (
            <View key={v.id}>
              {i > 0 ? <Separator /> : null}
              <View style={styles.vouch}>
                <Text variant="small" style={styles.grow}>
                  {v.name}
                </Text>
                <Badge
                  label={
                    v.answer ? tv(`answers.${v.answer}`) : t("vouches.pending")
                  }
                  tone={
                    v.answer === "YES"
                      ? "green"
                      : v.answer === "NO"
                        ? "red"
                        : "slate"
                  }
                />
                <Text variant="caption" tone="subtle">
                  {formatDateTime(v.at, locale)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title={t("vouches.none")} />
      )}
      {d.canAddVoucher ? <VoucherSearch requestId={d.id} /> : null}
    </DetailCard>
  );
}

function VoucherSearch({ requestId }: { requestId: string }) {
  const t = useTranslations("adminVerify");
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const candidates = useVoucherCandidates(requestId, q);
  const add = useAddVoucher(requestId);
  const search = () => setQ(draft.trim().slice(0, 100));
  return (
    <View style={styles.voucherSearch}>
      <View style={styles.searchRow}>
        <View style={styles.grow}>
          <TextField
            label={t("vouches.searchLabel")}
            value={draft}
            onChangeText={setDraft}
            maxLength={100}
            returnKeyType="search"
            onSubmitEditing={search}
            autoCorrect={false}
          />
        </View>
        <Button
          label={t("vouches.search")}
          variant="secondary"
          onPress={search}
          style={styles.searchButton}
        />
      </View>
      {q ? (
        candidates.data ? (
          candidates.data.length ? (
            <ListGroup>
              {candidates.data.map((c, i) => {
                const result =
                  add.variables === c.id && add.data?.message ? add.data : null;
                return (
                  <View key={c.id}>
                    {i > 0 ? <Separator /> : null}
                    <View style={styles.candidate}>
                      <Text variant="small" style={styles.grow}>
                        {c.name}
                        {c.nameRomaji && c.nameRomaji !== c.name ? (
                          <Text variant="small" tone="subtle">
                            {` (${c.nameRomaji})`}
                          </Text>
                        ) : null}
                      </Text>
                      <Button
                        label={t("vouches.add")}
                        accessibilityLabel={t("vouches.addNamed", {
                          name: c.name,
                        })}
                        variant="secondary"
                        compact
                        loading={add.isPending && add.variables === c.id}
                        disabled={add.isPending}
                        onPress={() => add.mutate(c.id)}
                      />
                    </View>
                    {result?.message ? (
                      <Text
                        variant="small"
                        tone={result.ok ? "success" : "danger"}
                        accessibilityLiveRegion="polite"
                        style={styles.candidateResult}
                      >
                        {t(`messages.${result.message}`)}
                      </Text>
                    ) : add.isError && add.variables === c.id ? (
                      <Text
                        variant="small"
                        tone="danger"
                        style={styles.candidateResult}
                      >
                        {t("messages.generic")}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </ListGroup>
          ) : (
            <Text variant="small" tone="muted">
              {t("vouches.noResults")}
            </Text>
          )
        ) : candidates.isError ? (
          <Text variant="small" tone="danger">
            {t("messages.generic")}
          </Text>
        ) : null
      ) : null}
    </View>
  );
}

// ---- 確認書類 ----

const isImage = (e: VerificationEvidence) => e.mimeType.startsWith("image/");

/** Opens a file (the signed link) in the in-app browser / a new tab. */
function openFile(url: string) {
  void WebBrowser.openBrowserAsync(absoluteUrl(url)).catch(() => {});
}

export function EvidenceCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify");
  const locale = useLocale() as Locale;
  return (
    <DetailCard title={t("detail.evidence")}>
      {d.evidence.length ? (
        d.evidence.map((e) => (
          <View key={e.id} style={styles.evidence}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={e.fileName}
              onPress={() => openFile(e.url)}
              style={({ pressed }) => [
                styles.fileRow,
                pressed ? styles.pressed : null,
              ]}
            >
              <FileText size={18} color={colors.brand700} aria-hidden />
              <Text
                variant="small"
                tone="brand"
                style={[styles.grow, styles.underline]}
              >
                {e.fileName}
              </Text>
              <ChevronRight size={16} color={colors.slate400} aria-hidden />
            </Pressable>
            {isImage(e) ? (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={e.fileName}
                onPress={() => openFile(e.url)}
              >
                <Image
                  source={{ uri: absoluteUrl(e.url) }}
                  style={styles.image}
                  contentFit="contain"
                  accessibilityIgnoresInvertColors
                />
              </Pressable>
            ) : null}
            <View style={styles.inlineWrap}>
              {e.diploma ? (
                <Badge label={t("badges.diploma")} tone="green" />
              ) : null}
              <Text variant="caption" tone="subtle">
                {e.mimeType} · {formatSize(e.size)}
                {e.deleteAfter
                  ? ` · ${t("detail.deleteAfter", { date: formatDate(e.deleteAfter, locale) })}`
                  : ""}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <EmptyState title={t("detail.noEvidence")} />
      )}
      {d.evidence.length ? (
        <Text variant="caption" tone="subtle">
          {t("detail.linkExpiry")}
        </Text>
      ) : null}
    </DetailCard>
  );
}

// ---- 在籍情報 ----

export function AisRecordCard({ d }: { d: VerificationDetail }) {
  const t = useTranslations("adminVerify.aisRecord");
  const memberLink = useMemberLink();
  const open = memberLink(d.applicantId);
  return (
    <DetailCard title={t("title")}>
      <Text variant="small" tone="muted">
        {t("description")}
      </Text>
      {open ? (
        <Button
          label={t("edit")}
          variant="ghost"
          icon={(c) => <ChevronRight size={16} color={c} aria-hidden />}
          onPress={open}
          style={styles.start}
        />
      ) : null}
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  underline: { textDecorationLine: "underline" },
  inline: { flexDirection: "row", alignItems: "center", gap: space.xs },
  inlineWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  whiteBox: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
    alignItems: "flex-start",
  },
  childBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  answerSection: { gap: space.sm },
  vouch: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
  },
  grow: { flex: 1 },
  voucherSearch: {
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.md,
  },
  searchRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  searchButton: { marginBottom: 0 },
  candidate: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: TOUCH,
  },
  candidateResult: { paddingHorizontal: space.md, paddingBottom: space.sm },
  evidence: { gap: space.xs },
  fileRow: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.slate100 },
  image: {
    width: "100%",
    height: 240,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
  },
  start: { alignSelf: "flex-start", paddingHorizontal: 0 },
});
