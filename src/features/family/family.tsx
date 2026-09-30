import type {
  FamilyLinkRow,
  FamilyPage,
  FamilyRequest,
  ManagedChild,
} from "@contract/family";
import type { MemberCard } from "@contract/people";
import { useRouter } from "expo-router";
import { Search, Send, UserRoundCheck, UsersRound } from "lucide-react-native";
import { forwardRef, useState } from "react";
import { StyleSheet, type TextInput, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";
import { confirmAction } from "@/features/me/confirm";
import { MemberCardView } from "@/features/people/member-card";
import { useMe } from "@/lib/auth";
import { TIME_ZONE } from "@/lib/format";
import {
  Badge,
  Button,
  colors,
  EmptyState,
  radius,
  space,
  Text,
  TextField,
} from "@/ui";
import {
  errorCode,
  useCancelHandover,
  useClaimChildByName,
  useClaimFamily,
  useConfirmLink,
  useFamilySearch,
  useRemoveLink,
  useStartHandover,
} from "./api";
import { CohortPicker, Notice, SectionCard } from "./parts";

const CLAIM_ERRORS = [
  "notAllowed",
  "notFound",
  "wrongRole",
  "already",
  "tooMany",
  "invalid",
  "cohort",
] as const;
const HANDOVER_ERRORS = [
  "forbidden",
  "notFound",
  "invalidEmail",
  "notActive",
] as const;

/** Open a member's profile (mine: マイページ). */
function useOpenMember() {
  const router = useRouter();
  const me = useMe();
  return (m: MemberCard) =>
    router.push(
      m.id === me.user.id
        ? "/profile"
        : { pathname: "/members/[id]", params: { id: m.id } },
    );
}

// ---- あなたの承認待ち ----

export function RequestsCard({ requests }: { requests: FamilyRequest[] }) {
  const t = useTranslations("family");
  const open = useOpenMember();
  return (
    <SectionCard title={t("pendingForMe.title")}>
      {requests.map((r) => (
        <MemberCardView
          key={r.linkId}
          member={r.member}
          onPress={() => open(r.member)}
          meta={t(`pendingForMe.${r.key}`, { name: r.member.name })}
          actions={<RequestActions linkId={r.linkId} />}
        />
      ))}
    </SectionCard>
  );
}

function RequestActions({ linkId }: { linkId: string }) {
  const t = useTranslations("family");
  const tc = useTranslations("common");
  const confirm = useConfirmLink();
  const remove = useRemoveLink();
  const busy = confirm.isPending || remove.isPending;
  const decline = async () => {
    const ok = await confirmAction({
      title: t("declineConfirm"),
      confirm: t("decline"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) remove.mutate(linkId);
  };
  return (
    <View style={styles.actions}>
      <Button
        compact
        label={t("confirm")}
        loading={confirm.isPending}
        disabled={busy}
        onPress={() => confirm.mutate(linkId)}
      />
      <Button
        compact
        variant="secondary"
        label={t("decline")}
        loading={remove.isPending}
        disabled={busy}
        onPress={decline}
      />
    </View>
  );
}

// ---- あなたが管理しているお子さま ----

export function ManagedCard({ managed }: { managed: ManagedChild[] }) {
  const t = useTranslations("family.managed");
  const open = useOpenMember();
  return (
    <SectionCard title={t("title")} description={t("description")}>
      {managed.map((m) => (
        <View key={m.member.id} style={styles.managed}>
          <MemberCardView member={m.member} onPress={() => open(m.member)} />
          <View style={styles.row}>
            <Badge
              tone={m.state === "active" ? "green" : "amber"}
              label={t(`state.${m.state}`)}
            />
          </View>
          {m.state === "active" ? (
            <HandoverPanel childId={m.member.id} pending={m.handover} />
          ) : null}
        </View>
      ))}
    </SectionCard>
  );
}

/** Parent: hand a managed child account over to the child (by email). */
function HandoverPanel({
  childId,
  pending,
}: {
  childId: string;
  pending: ManagedChild["handover"];
}) {
  const t = useTranslations("family.handover");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const start = useStartHandover(childId);
  const cancel = useCancelHandover(childId);

  if (pending && !open) {
    return (
      <View style={styles.panel}>
        {sent ? <Notice tone="success">{t("sent")}</Notice> : null}
        <View style={styles.pendingRow}>
          <Send size={16} color={colors.brand700} aria-hidden />
          <Text variant="small" tone="muted" style={styles.flex}>
            {t("pending", {
              email: pending.email,
              date: format.dateTime(new Date(pending.expiresAt), {
                dateStyle: "medium",
                timeZone: TIME_ZONE,
              }),
            })}
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            compact
            variant="secondary"
            label={t("resend")}
            onPress={() => {
              setSent(false);
              start.reset();
              setOpen(true);
            }}
          />
          <Button
            compact
            variant="ghost"
            label={t("cancel")}
            loading={cancel.isPending}
            onPress={() => {
              setSent(false);
              cancel.mutate();
            }}
          />
        </View>
      </View>
    );
  }
  if (!open) {
    return (
      <Button
        variant="secondary"
        label={t("open")}
        icon={(c) => <UserRoundCheck size={18} color={c} aria-hidden />}
        onPress={() => setOpen(true)}
      />
    );
  }
  const error = start.isError
    ? t(`errors.${errorCode(start.error, HANDOVER_ERRORS, "forbidden")}`)
    : null;
  const submit = () =>
    start.mutate(email, {
      onSuccess: () => {
        // Show the pending status instead of the form.
        setSent(true);
        setOpen(false);
        setEmail("");
      },
    });
  return (
    <View style={[styles.panel, styles.panelForm]}>
      <Text variant="small" tone="muted">
        {t("intro")}
      </Text>
      <TextField
        label={t("email")}
        hint={t("emailHint")}
        error={error}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        onSubmitEditing={submit}
      />
      <View style={styles.actions}>
        <Button
          label={t("send")}
          loading={start.isPending}
          disabled={!email.trim()}
          onPress={submit}
        />
        <Button
          variant="ghost"
          label={t("close")}
          onPress={() => setOpen(false)}
        />
      </View>
    </View>
  );
}

// ---- わたしの家族 ----

export function MembersCard({
  page,
  onFind,
}: {
  page: FamilyPage;
  /** jump to the child / parent search */
  onFind: (direction: "child" | "parent") => void;
}) {
  const t = useTranslations("family.members");
  const open = useOpenMember();
  // Where the empty state's call to action should jump to.
  const target = page.canClaimChild
    ? "child"
    : page.canClaimParent
      ? "parent"
      : null;
  return (
    <SectionCard title={t("title")}>
      {page.members.length ? (
        page.members.map((m) => (
          <MemberCardView key={m.id} member={m} onPress={() => open(m)} />
        ))
      ) : (
        <EmptyState
          icon={<UsersRound size={32} color={colors.slate400} />}
          title={t("empty")}
          action={
            target ? (
              <View style={styles.empty}>
                {(["one", "two", "three"] as const).map((step, i) => (
                  <View key={step} style={styles.step}>
                    <View style={styles.stepNo}>
                      <Text variant="caption" weight="semibold" tone="brand">
                        {i + 1}
                      </Text>
                    </View>
                    <Text variant="small" tone="muted" style={styles.flex}>
                      {t(`steps.${step}`)}
                    </Text>
                  </View>
                ))}
                <Button
                  label={t(target === "child" ? "findChild" : "findParent")}
                  icon={(c) => <Search size={18} color={c} aria-hidden />}
                  onPress={() => onFind(target)}
                />
              </View>
            ) : undefined
          }
        />
      )}
    </SectionCard>
  );
}

// ---- 家族のリンク ----

export function LinksCard({ links }: { links: FamilyLinkRow[] }) {
  const t = useTranslations("family");
  return (
    <SectionCard title={t("links.title")}>
      {links.map((l, i) => (
        <View
          key={l.id}
          style={[styles.link, i > 0 ? styles.linkBorder : null]}
        >
          <View style={styles.flex}>
            <Text>
              {t("links.row", { parent: l.parentName, child: l.childName })}
            </Text>
            <View style={styles.row}>
              <Badge
                tone={l.status === "confirmed" ? "green" : "amber"}
                label={
                  l.status === "pendingOther"
                    ? t("status.pendingOther", { name: l.pendingName ?? "—" })
                    : t(`status.${l.status}`)
                }
              />
            </View>
          </View>
          {l.status !== "confirmed" && l.cancellable ? (
            <CancelLink linkId={l.id} />
          ) : null}
        </View>
      ))}
    </SectionCard>
  );
}

function CancelLink({ linkId }: { linkId: string }) {
  const t = useTranslations("family");
  const tc = useTranslations("common");
  const remove = useRemoveLink();
  const onPress = async () => {
    const ok = await confirmAction({
      title: t("cancelConfirm"),
      confirm: t("cancel"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) remove.mutate(linkId);
  };
  return (
    <Button
      compact
      variant="ghost"
      label={t("cancel")}
      loading={remove.isPending}
      onPress={onPress}
    />
  );
}

// ---- 子どもを追加 / 保護者を追加 ----

/** Search form + results for claiming a child or parent (FamilySearch). */
export const FamilySearchForm = forwardRef<
  TextInput,
  { direction: "child" | "parent" }
>(function FamilySearchForm({ direction }, ref) {
  const t = useTranslations("family");
  const ns = direction === "child" ? "claimChild" : "claimParent";
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const results = useFamilySearch(direction, q);
  const open = useOpenMember();
  const submit = () => {
    const v = text.trim();
    if (v.length >= 2) setQ(v);
  };
  return (
    <View style={styles.search}>
      <TextField
        ref={ref}
        label={t(`${ns}.searchLabel`)}
        hint={direction === "child" ? t("claimChild.minorHint") : undefined}
        value={text}
        onChangeText={setText}
        maxLength={100}
        autoComplete="off"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={submit}
      />
      <Button
        variant="secondary"
        label={t("search")}
        icon={(c) => <Search size={18} color={c} aria-hidden />}
        loading={results.isFetching}
        disabled={text.trim().length < 2}
        onPress={submit}
        style={styles.start}
      />
      {!q || !results.data ? (
        results.isError ? (
          <Notice tone="error">{t("errors.notFound")}</Notice>
        ) : null
      ) : results.data.items.length === 0 ? (
        <Text variant="small" tone="muted" center>
          {t("noResults")}
        </Text>
      ) : (
        results.data.items.map((c) => (
          <MemberCardView
            key={c.member.id}
            member={c.member}
            onPress={c.limited ? undefined : () => open(c.member)}
            actions={
              <ClaimButton otherId={c.member.id} direction={direction} />
            }
          />
        ))
      )}
    </View>
  );
});

/** 「この人は私の子ども（保護者）です」 on a search result. */
function ClaimButton({
  otherId,
  direction,
}: {
  otherId: string;
  direction: "child" | "parent";
}) {
  const t = useTranslations("family");
  const claim = useClaimFamily();
  if (claim.isSuccess)
    return (
      <Text variant="small" tone="success" accessibilityLiveRegion="polite">
        {t(claim.data.message)}
      </Text>
    );
  return (
    <View style={styles.claim}>
      <Button
        compact
        variant="secondary"
        label={t(
          direction === "child" ? "claimChild.select" : "claimParent.select",
        )}
        loading={claim.isPending}
        onPress={() => claim.mutate({ direction, otherId })}
      />
      {claim.isError ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {t(`errors.${errorCode(claim.error, CLAIM_ERRORS, "invalid")}`)}
        </Text>
      ) : null}
    </View>
  );
}

/** Parent adds a child who has no account yet; an admin confirms (§8). */
export function ChildNameForm({ cohorts }: { cohorts: FamilyPage["cohorts"] }) {
  const t = useTranslations("family");
  const [childName, setChildName] = useState("");
  const [cohortNumber, setCohortNumber] = useState("");
  const [leftYear, setLeftYear] = useState("");
  const claim = useClaimChildByName();
  const submit = () =>
    claim.mutate(
      { childName, cohortNumber, leftYear },
      {
        onSuccess: () => {
          setChildName("");
          setCohortNumber("");
          setLeftYear("");
        },
      },
    );
  return (
    <View style={[styles.search, styles.divided]}>
      <Text weight="semibold" accessibilityRole="header">
        {t("claimChild.manualTitle")}
      </Text>
      <TextField
        label={t("claimChild.manualLabel")}
        hint={t("claimChild.manualHint")}
        value={childName}
        onChangeText={setChildName}
        maxLength={100}
        autoComplete="off"
      />
      <CohortPicker
        label={t("claimChild.cohort")}
        hint={t("claimChild.cohortHint")}
        placeholder={t("claimChild.chooseCohort")}
        cohorts={cohorts}
        value={cohortNumber}
        onChange={setCohortNumber}
      />
      <TextField
        label={t("claimChild.leftYear")}
        hint={t("claimChild.leftYearHint")}
        value={leftYear}
        onChangeText={(v) => setLeftYear(v.replace(/\D/g, ""))}
        keyboardType="number-pad"
        maxLength={4}
        style={styles.year}
      />
      <Button
        variant="secondary"
        label={t("claimChild.manualSubmit")}
        loading={claim.isPending}
        disabled={!childName.trim()}
        onPress={submit}
        style={styles.start}
      />
      {claim.isSuccess ? (
        <Notice tone="success">{t(claim.data.message)}</Notice>
      ) : claim.isError ? (
        <Notice tone="error">
          {t(`errors.${errorCode(claim.error, CLAIM_ERRORS, "invalid")}`)}
        </Notice>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", marginTop: space.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  managed: { gap: space.sm },
  panel: {
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    padding: space.md,
  },
  panelForm: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  pendingRow: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  empty: { gap: space.md, alignSelf: "stretch" },
  step: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  stepNo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand100,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
  },
  linkBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  search: { gap: space.md },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.lg,
  },
  claim: { gap: space.xs },
  start: { alignSelf: "flex-start" },
  year: { maxWidth: 160 },
});
