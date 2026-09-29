import type { MyProfile } from "@contract/account";
import type { NameFields } from "@contract/profile";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useProfile } from "@/features/me/api";
import { Button, QueryState, space, Text, TextField } from "@/ui";
import { profileApi, useProfileForm } from "./api";
import { FormMessage, FormScreen, Legend, SelectSheet } from "./form-parts";

/**
 * Requests to the committee for the locked fields (the website's
 * NameRequestForm, BirthDateRequestForm and GenderRequestForm, opened from
 * their cards on /app/profile). On success the card shows the pending
 * request.
 */

const EMPTY_NAME: NameFields = {
  lastNameRomaji: "",
  firstNameRomaji: "",
  middleNameRomaji: "",
  lastNameKanji: "",
  firstNameKanji: "",
  lastNameKana: "",
  firstNameKana: "",
};

export function NameRequestScreen() {
  const t = useTranslations("profile.nameRequest");
  const profile = useProfile();
  return (
    <>
      <Stack.Screen options={{ title: t("open") }} />
      <QueryState query={profile}>
        {(p) => <NameRequestForm profile={p} />}
      </QueryState>
    </>
  );
}

function NameRequestForm({ profile }: { profile: MyProfile }) {
  const t = useTranslations("profile");
  const tn = useTranslations("common.names");
  const tv = useTranslations("verify.errors");
  const router = useRouter();
  const [values, setValues] = useState<NameFields>(
    profile.names.parts ?? EMPTY_NAME,
  );
  const [nameAtAis, setNameAtAis] = useState(profile.names.nameAtAis ?? "");
  const [reason, setReason] = useState("");
  const { mutation, status, fieldError } = useProfileForm(
    profileApi.nameRequest,
    () => router.back(),
  );
  const err = (k: string) => {
    const code = fieldError(k);
    if (!code) return null;
    return ["kanaOnly", "kanaRequired", "required", "tooLong"].includes(code)
      ? tv(code)
      : t("errors.invalid");
  };
  const input = (
    name: keyof NameFields,
    opts: { required?: boolean; latin?: boolean } = {},
  ) => (
    <TextField
      key={name}
      label={opts.required ? `${tn(name)} *` : tn(name)}
      error={err(name)}
      value={values[name]}
      onChangeText={(v) => setValues((s) => ({ ...s, [name]: v }))}
      placeholder={tn(`placeholders.${name}`)}
      maxLength={50}
      autoCorrect={false}
      autoCapitalize={opts.latin ? "words" : "none"}
    />
  );

  return (
    <FormScreen>
      <Text variant="small" tone="muted">
        {t("nameRequest.intro")}
      </Text>
      <View style={styles.group}>
        <Legend title={tn("romaji")} />
        {input("lastNameRomaji", { required: true, latin: true })}
        {input("firstNameRomaji", { required: true, latin: true })}
        {input("middleNameRomaji", { latin: true })}
      </View>
      <View style={styles.group}>
        <Legend title={tn("kanji")} />
        {input("lastNameKanji")}
        {input("firstNameKanji")}
        {input("lastNameKana")}
        {input("firstNameKana")}
        <Text variant="small" tone="muted">
          {tn("kanaHint")}
        </Text>
      </View>
      <TextField
        label={t("fields.nameAtAis")}
        hint={t("hints.nameAtAis")}
        error={err("nameAtAis")}
        value={nameAtAis}
        onChangeText={setNameAtAis}
        maxLength={100}
      />
      <TextField
        label={`${t("nameRequest.reason")} *`}
        hint={t("nameRequest.reasonHint")}
        error={err("reason")}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={1000}
        style={styles.textarea}
        textAlignVertical="top"
      />
      <FormMessage status={status} t={t} />
      <Button
        label={t("nameRequest.submit")}
        loading={mutation.isPending}
        onPress={() => mutation.mutate({ ...values, nameAtAis, reason })}
      />
    </FormScreen>
  );
}

export function BirthDateRequestScreen() {
  const t = useTranslations("profile.birthDate");
  const profile = useProfile();
  return (
    <>
      <Stack.Screen
        options={{
          title: profile.data?.birthDate.value ? t("open") : t("openAdd"),
        }}
      />
      <QueryState query={profile}>
        {(p) => <BirthDateRequestForm current={p.birthDate.value ?? ""} />}
      </QueryState>
    </>
  );
}

function BirthDateRequestForm({ current }: { current: string }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [date, setDate] = useState(current);
  const [reason, setReason] = useState("");
  const adding = !current;
  const { mutation, status, fieldError } = useProfileForm(
    profileApi.birthDateRequest,
    () => router.back(),
  );
  const err = (k: string) => {
    const code = fieldError(k);
    return code ? t(`birthDate.fieldErrors.${code}`) : null;
  };
  return (
    <FormScreen>
      <Text variant="small" tone="muted">
        {t("birthDate.intro")}
      </Text>
      <TextField
        label={`${t("birthDate.field")} *`}
        hint="YYYY-MM-DD"
        error={err("dateOfBirth")}
        value={date}
        onChangeText={setDate}
        placeholder="2000-04-01"
        keyboardType="numbers-and-punctuation"
        autoComplete="birthdate-full"
        maxLength={10}
      />
      <TextField
        label={
          adding ? t("birthDate.reasonOptional") : `${t("birthDate.reason")} *`
        }
        hint={t("birthDate.reasonHint")}
        error={err("reason")}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={1000}
        style={styles.textareaSmall}
        textAlignVertical="top"
      />
      <FormMessage status={status} t={t} showFieldErrors={false} />
      <Button
        label={t("birthDate.submit")}
        loading={mutation.isPending}
        onPress={() => mutation.mutate({ dateOfBirth: date.trim(), reason })}
      />
    </FormScreen>
  );
}

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export function GenderRequestScreen() {
  const t = useTranslations("profile.gender");
  const profile = useProfile();
  return (
    <>
      <Stack.Screen
        options={{
          title:
            profile.data && !profile.data.gender.value ? t("title") : t("open"),
        }}
      />
      <QueryState query={profile}>
        {(p) => <GenderRequestForm current={p.gender.value} />}
      </QueryState>
    </>
  );
}

function GenderRequestForm({ current }: { current: string | null }) {
  const t = useTranslations("profile");
  const tg = useTranslations("profile.photo.genders");
  const router = useRouter();
  const setOnce = current === null;
  const [gender, setGender] = useState("");
  const [reason, setReason] = useState("");
  const { mutation, status, fieldError } = useProfileForm(
    (input: { gender: string; reason: string }) =>
      setOnce
        ? profileApi.setGender(input.gender)
        : profileApi.genderRequest(input),
    () => router.back(),
  );
  const err = (k: string) => {
    const code = fieldError(k);
    return code ? t(`gender.fieldErrors.${code}`) : null;
  };
  return (
    <FormScreen>
      {!setOnce ? (
        <Text variant="small" tone="muted">
          {t("gender.intro")}
        </Text>
      ) : null}
      <SelectSheet
        label={`${t("gender.field")} *`}
        placeholder={tg("none")}
        choices={GENDERS.filter((g) => g !== current).map((g) => ({
          value: g,
          label: tg(g),
        }))}
        value={gender}
        onChange={setGender}
        error={err("gender")}
      />
      {!setOnce ? (
        <TextField
          label={`${t("gender.reason")} *`}
          hint={t("gender.reasonHint")}
          error={err("reason")}
          value={reason}
          onChangeText={setReason}
          multiline
          maxLength={1000}
          style={styles.textareaSmall}
          textAlignVertical="top"
        />
      ) : null}
      <FormMessage status={status} t={t} showFieldErrors={false} />
      <Button
        label={setOnce ? t("gender.setOnce") : t("gender.submit")}
        loading={mutation.isPending}
        onPress={() => mutation.mutate({ gender, reason })}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.md },
  textarea: { minHeight: 96 },
  textareaSmall: { minHeight: 72 },
});
