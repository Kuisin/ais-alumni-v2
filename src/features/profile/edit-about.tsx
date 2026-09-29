import type { MyProfile, SocialKey } from "@contract/account";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useProfile } from "@/features/me/api";
import { ToggleRow } from "@/features/me/rows";
import { Button, ListGroup, QueryState, space, Text, TextField } from "@/ui";
import { profileApi, useProfileForm } from "./api";
import { FormMessage, FormScreen, Legend } from "./form-parts";

const SOCIAL_KEYS: SocialKey[] = [
  "instagram",
  "linkedin",
  "facebook",
  "x",
  "website",
];

/** 自己紹介・連絡先・フォロー (the website's ProfileForm on /app/profile). */
export function EditAboutScreen() {
  const t = useTranslations("profile");
  const profile = useProfile();
  return (
    <>
      <Stack.Screen options={{ title: t("sections.about") }} />
      <QueryState query={profile}>
        {(p) => <AboutForm profile={p} />}
      </QueryState>
    </>
  );
}

function AboutForm({ profile }: { profile: MyProfile }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const { about } = profile;
  const [bio, setBio] = useState(about.bio ?? "");
  const [phone, setPhone] = useState(about.phone ?? "");
  const [auto, setAuto] = useState(about.autoAcceptSameYear ?? false);
  const [social, setSocial] = useState<Partial<Record<SocialKey, string>>>(() =>
    Object.fromEntries(about.social.map((s) => [s.key, s.url])),
  );
  const { mutation, status, fieldError } = useProfileForm(
    profileApi.about,
    () => router.back(),
  );
  const err = (f: string) => (fieldError(f) ? t("errors.invalid") : null);

  return (
    <FormScreen>
      <TextField
        label={t("fields.bio")}
        hint={t("hints.bio")}
        error={err("bio")}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={1000}
        style={styles.textarea}
        textAlignVertical="top"
      />

      <View style={styles.group}>
        <Legend title={t("sections.contact")} hint={t("hints.privateTier")} />
        <TextField
          label={t("fields.phone")}
          error={err("phone")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={40}
        />
        {SOCIAL_KEYS.map((k) => (
          <TextField
            key={k}
            label={t(`fields.${k}`)}
            error={err(k)}
            value={social[k] ?? ""}
            onChangeText={(v) => setSocial((s) => ({ ...s, [k]: v }))}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://"
            maxLength={300}
          />
        ))}
        <Text variant="small" tone="muted">
          {t("hints.socialUrl")}
        </Text>
      </View>

      {about.autoAcceptSameYear !== null ? (
        <View style={styles.group}>
          <Legend title={t("sections.follows")} />
          <ListGroup>
            <ToggleRow
              title={t("autoAccept.label")}
              hint={t("autoAccept.hint")}
              value={auto}
              onChange={setAuto}
            />
          </ListGroup>
        </View>
      ) : null}

      <FormMessage status={status} t={t} />
      <Button
        label={mutation.isPending ? t("saving") : t("save")}
        loading={mutation.isPending}
        onPress={() =>
          mutation.mutate({
            bio,
            phone,
            // Only former students have the switch; others keep theirs.
            autoAcceptSameYear:
              about.autoAcceptSameYear === null ? undefined : auto,
            social,
          })
        }
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.md },
  textarea: { minHeight: 120 },
});
