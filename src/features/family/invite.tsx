import type {
  CohortChoice,
  InviteCreated,
  InviteKind,
  InviteRow,
  InviteType,
} from "@contract/family";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Check, Copy, Link2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  Badge,
  Button,
  colors,
  radius,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";
import { errorCode, useCreateInvite, useRevokeInvite } from "./api";
import { CohortPicker, Notice, SectionCard } from "./parts";

const TYPES: InviteType[] = ["STUDENT", "PARENT", "TEACHER"];
const KINDS: InviteKind[] = ["INDIVIDUAL", "GRADE"];
const ERRORS = [
  "forbidden",
  "cohort",
  "tooMany",
  "invalid",
  "gradeOpen",
] as const;

/** Create invitations one after another (a fresh form each time). */
export function InviteCreator({ cohorts }: { cohorts: CohortChoice[] }) {
  const [round, setRound] = useState(0);
  return (
    <InviteForm
      key={round}
      cohorts={cohorts}
      onAnother={() => setRound((r) => r + 1)}
    />
  );
}

/** Create an invitation link (with who it's for) and share it. */
function InviteForm({
  cohorts,
  onAnother,
}: {
  cohorts: CohortChoice[];
  onAnother: () => void;
}) {
  const t = useTranslations("invites");
  const create = useCreateInvite();
  const [kind, setKind] = useState<InviteKind>("INDIVIDUAL");
  const [type, setType] = useState<InviteType>("STUDENT");
  const [cohortNumber, setCohortNumber] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  // 学年招待 is for students / parents of a 学年 (not teachers).
  const types = kind === "GRADE" ? TYPES.filter((x) => x !== "TEACHER") : TYPES;

  if (create.isSuccess)
    return <Created created={create.data} onAnother={onAnother} />;

  return (
    <View style={styles.form}>
      {create.isError ? (
        <Notice tone="error">
          {t(`errors.${errorCode(create.error, ERRORS, "invalid")}`)}
        </Notice>
      ) : null}
      <View style={styles.group} accessibilityRole="radiogroup">
        <Text variant="small" weight="semibold">
          {t("kind")}
        </Text>
        {KINDS.map((k) => (
          <ChoiceCard
            key={k}
            checked={kind === k}
            title={t(`kinds.${k}.title`)}
            hint={t(`kinds.${k}.hint`)}
            onPress={() => {
              setKind(k);
              if (k === "GRADE" && type === "TEACHER") setType("STUDENT");
            }}
          />
        ))}
      </View>
      <View style={styles.group} accessibilityRole="radiogroup">
        <Text variant="small" weight="semibold">
          {t("type")}
        </Text>
        {types.map((k) => (
          <ChoiceCard
            key={k}
            checked={type === k}
            title={t(`types.${k}`)}
            onPress={() => setType(k)}
          />
        ))}
      </View>
      {type !== "TEACHER" ? (
        <CohortPicker
          label={type === "PARENT" ? t("cohortChild") : t("cohort")}
          hint={t("cohortHint")}
          placeholder="—"
          cohorts={cohorts}
          value={cohortNumber}
          onChange={setCohortNumber}
        />
      ) : null}
      {kind === "INDIVIDUAL" ? (
        <TextField
          label={t("name")}
          hint={t("nameHint")}
          value={inviteeName}
          onChangeText={setInviteeName}
          maxLength={100}
        />
      ) : null}
      <Button
        label={t("create")}
        loading={create.isPending}
        onPress={() =>
          create.mutate({
            kind,
            type,
            cohortNumber: type === "TEACHER" ? "" : cohortNumber,
            inviteeName: kind === "INDIVIDUAL" ? inviteeName : "",
          })
        }
      />
    </View>
  );
}

/** A radio option as a bordered card (the website's CHOICE_CARD). */
function ChoiceCard({
  checked,
  title,
  hint,
  onPress,
}: {
  checked: boolean;
  title: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={hint ? `${title}. ${hint}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        checked ? styles.choiceOn : null,
        pressed ? styles.choicePressed : null,
      ]}
    >
      <View style={[styles.radio, checked ? styles.radioOn : null]}>
        {checked ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.flex}>
        <Text variant="small" weight="medium">
          {title}
        </Text>
        {hint ? (
          <Text variant="small" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** The new link, shown once: copy it or send it by LINE. */
function Created({
  created,
  onAnother,
}: {
  created: InviteCreated;
  onAnother: () => void;
}) {
  const t = useTranslations("invites");
  const [copied, setCopied] = useState(false);
  const grade = created.kind === "GRADE";
  const text = `${grade ? t("shareTextGrade") : t("shareText")}\n${created.url}`;
  return (
    <View style={styles.form}>
      <Notice tone="success">{grade ? t("createdGrade") : t("created")}</Notice>
      <TextField
        label={t("link")}
        value={created.url}
        editable={false}
        selectTextOnFocus
      />
      <Text variant="small" tone="muted">
        {t("linkHint")}
      </Text>
      <View style={styles.buttons}>
        <Button
          label={copied ? t("copied") : t("copy")}
          icon={(c) =>
            copied ? (
              <Check size={18} color={c} aria-hidden />
            ) : (
              <Copy size={18} color={c} aria-hidden />
            )
          }
          onPress={async () => {
            await Clipboard.setStringAsync(created.url).catch(() => {});
            setCopied(true);
          }}
        />
        <Button
          variant="line"
          label={t("shareLine")}
          onPress={() =>
            void Linking.openURL(
              `https://line.me/R/msg/text/?${encodeURIComponent(text)}`,
            ).catch(() => {})
          }
        />
        <Button
          variant="ghost"
          label={t("another")}
          icon={(c) => <Link2 size={18} color={c} aria-hidden />}
          onPress={onAnother}
        />
      </View>
    </View>
  );
}

/** 「作成した招待」 */
export function SentInvites({ invites }: { invites: InviteRow[] }) {
  const t = useTranslations("invites");
  return (
    <SectionCard title={t("sent")}>
      {invites.map((i, n) => (
        <SentRow key={i.id} invite={i} first={n === 0} />
      ))}
    </SectionCard>
  );
}

function SentRow({ invite: i, first }: { invite: InviteRow; first: boolean }) {
  const t = useTranslations("invites");
  const { locale } = useAuth();
  const revoke = useRevokeInvite();
  const grade = i.kind === "GRADE";
  const meta = [
    t(`types.${i.type}`),
    i.cohortLabel,
    formatDate(i.createdAt, locale),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={[styles.row, first ? null : styles.rowBorder]}>
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Badge
            tone={grade ? "slate" : "brand"}
            label={t(`kinds.${i.kind}.badge`)}
          />
          <Text variant="small" weight="medium" style={styles.flex}>
            {i.inviteeName || t(`types.${i.type}`)}
          </Text>
        </View>
        <Text variant="small" tone="muted">
          {meta}
        </Text>
        {i.usedByName ? (
          <Text variant="small" tone="muted">
            {t("usedBy", { name: i.usedByName })}
          </Text>
        ) : null}
        {grade ? (
          <Text variant="small" tone="muted">
            {t("uses", { count: i.uses, max: i.maxUses })}
            {i.usedByNames.length
              ? ` · ${t("usedByList", { names: i.usedByNames.join("、") })}`
              : ""}
          </Text>
        ) : null}
      </View>
      <View style={styles.status}>
        <Badge
          tone={
            i.status === "used" || i.status === "full"
              ? "green"
              : i.status === "open"
                ? "brand"
                : "slate"
          }
          label={t(`status.${i.status}`)}
        />
        {i.status === "open" ? (
          <Button
            compact
            variant="ghost"
            label={t("revoke")}
            loading={revoke.isPending}
            onPress={() => revoke.mutate(i.id)}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: space.lg },
  group: { gap: space.sm },
  choice: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  choiceOn: { borderColor: colors.brand700, backgroundColor: colors.brand50 },
  choicePressed: { backgroundColor: colors.slate100 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.slate400,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.brand700 },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand700,
  },
  buttons: { gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  status: { alignItems: "flex-end", gap: space.xs },
});
