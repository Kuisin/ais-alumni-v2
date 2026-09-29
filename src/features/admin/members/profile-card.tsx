import type { AdminMemberDetail, AdminResult } from "@contract/admin-members";
import { UserRound } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button, space, Text, TextField } from "@/ui";
import {
  Actions,
  AdminCard,
  Facts,
  FailedNotice,
  Picker,
  ResultNotice,
} from "../parts";
import { useSaveProfile } from "./api";

type Values = AdminMemberDetail["profile"];

const ROMAJI = [
  "lastNameRomaji",
  "firstNameRomaji",
  "middleNameRomaji",
] as const;
const KANJI = [
  "lastNameKanji",
  "firstNameKanji",
  "lastNameKana",
  "firstNameKana",
] as const;

/**
 * プロフィール: the member's own fields, shown first; 編集 opens the
 * website's MemberProfileForm (names, AIS在籍時の氏名, 生年月日, 性別,
 * 電話番号, 自己紹介).
 */
export function ProfileCard({ m }: { m: AdminMemberDetail }) {
  const t = useTranslations("adminMembers.profile");
  const tc = useTranslations("common");
  const tg = useTranslations("profile.photo");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<AdminResult | null>(null);
  const p = m.profile;
  const gender = p.gender ? tg(`genders.${p.gender}`) : null;
  const nameRomaji = [p.firstNameRomaji, p.middleNameRomaji, p.lastNameRomaji]
    .filter(Boolean)
    .join(" ");
  const nameKanji = [p.lastNameKanji, p.firstNameKanji]
    .filter(Boolean)
    .join(" ");
  const nameKana = [p.lastNameKana, p.firstNameKana].filter(Boolean).join(" ");
  return (
    <AdminCard title={t("title")} icon={UserRound}>
      {editing ? (
        <ProfileForm
          m={m}
          onDone={(r) => {
            setSaved(r);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <ResultNotice result={saved} />
          <Facts
            rows={[
              [t("nameRomaji"), nameRomaji || null],
              [t("nameKanji"), nameKanji || null],
              [t("nameKana"), nameKana || null],
              [t("nameAtAis"), p.nameAtAis],
              [t("dateOfBirth"), p.dateOfBirth],
              [t("gender"), gender],
              [t("phone"), p.phone],
              [t("bio"), p.bio],
            ].map(([k, v]) => [k as string, v || tc("notSet")])}
          />
          <Actions>
            <Button
              label={tc("edit")}
              variant="secondary"
              compact
              onPress={() => {
                setSaved(null);
                setEditing(true);
              }}
            />
          </Actions>
        </>
      )}
    </AdminCard>
  );
}

function ProfileForm({
  m,
  onDone,
  onCancel,
}: {
  m: AdminMemberDetail;
  onDone: (r: AdminResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("adminMembers.profile");
  const tn = useTranslations("common.names");
  const tc = useTranslations("common");
  const tg = useTranslations("profile.photo");
  const [v, setV] = useState<Values>(m.profile);
  const save = useSaveProfile(m.id);
  const result = save.data;
  const err = (k: string) =>
    result?.fieldErrors?.[k] ? tc("errors.validation") : null;
  const field = (k: keyof Values) => ({
    value: v[k],
    onChangeText: (text: string) => setV((x) => ({ ...x, [k]: text })),
    error: err(k),
  });
  const submit = async () => {
    const r = await save.mutateAsync(v).catch(() => null);
    if (r?.ok) onDone(r);
  };
  return (
    <View style={styles.form}>
      <Text variant="small" weight="semibold">
        {tn("romaji")}
      </Text>
      {ROMAJI.map((k) => (
        <TextField
          key={k}
          label={tn(k)}
          placeholder={tn(`placeholders.${k}`)}
          maxLength={50}
          autoCapitalize="words"
          autoCorrect={false}
          {...field(k)}
        />
      ))}
      <Text variant="small" weight="semibold">
        {tn("kanji")}
      </Text>
      {KANJI.map((k) => (
        <TextField
          key={k}
          label={tn(k)}
          placeholder={tn(`placeholders.${k}`)}
          maxLength={50}
          autoCorrect={false}
          {...field(k)}
        />
      ))}
      <Text variant="caption" tone="subtle">
        {tn("kanaHint")}
      </Text>
      <TextField
        label={t("nameAtAis")}
        autoCorrect={false}
        {...field("nameAtAis")}
      />
      <TextField
        label={t("dateOfBirth")}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        {...field("dateOfBirth")}
      />
      <Picker
        label={t("gender")}
        choices={[
          { value: "", label: tg("genders.none") },
          ...(["MALE", "FEMALE", "OTHER"] as const).map((g) => ({
            value: g,
            label: tg(`genders.${g}`),
          })),
        ]}
        value={v.gender}
        onChange={(gender) => setV((x) => ({ ...x, gender }))}
      />
      <TextField
        label={t("phone")}
        keyboardType="phone-pad"
        maxLength={40}
        {...field("phone")}
      />
      <TextField
        label={t("bio")}
        multiline
        maxLength={2000}
        style={styles.bio}
        {...field("bio")}
      />
      <ResultNotice result={result} />
      <FailedNotice error={save.error} />
      <Actions>
        <Button
          label={save.isPending ? tc("saving") : t("save")}
          loading={save.isPending}
          onPress={submit}
        />
        <Button label={tc("cancel")} variant="secondary" onPress={onCancel} />
      </Actions>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  bio: { minHeight: 120, textAlignVertical: "top" },
});
