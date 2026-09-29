import type { MyProfile, PersonalField } from "@contract/account";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useProfile } from "@/features/me/api";
import { ToggleRow } from "@/features/me/rows";
import { Button, ListGroup, QueryState, Separator, Text } from "@/ui";
import { profileApi, useProfileForm } from "./api";
import { FormMessage, FormScreen } from "./form-parts";

/** The website's PERSONAL_FIELDS, in its order. */
const PERSONAL_FIELDS: PersonalField[] = [
  "email",
  "phone",
  "lineDisplayName",
  "instagram",
  "linkedin",
  "facebook",
  "x",
  "website",
  "currentStageDetail",
];

/** 会員名簿への掲載 (parents; the website's DirectorySettingsForm). */
export function EditDirectoryScreen() {
  const t = useTranslations("profile.directory");
  const profile = useProfile();
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={profile}>
        {(p) => <DirectoryForm listed={p.directoryListed ?? true} />}
      </QueryState>
    </>
  );
}

function DirectoryForm({ listed: initial }: { listed: boolean }) {
  const t = useTranslations("profile.directory");
  const tp = useTranslations("profile");
  const router = useRouter();
  const [listed, setListed] = useState(initial);
  const { mutation, status } = useProfileForm(profileApi.directory, () =>
    router.back(),
  );
  return (
    <FormScreen>
      <ListGroup>
        <ToggleRow
          title={t("listed")}
          hint={t("hint")}
          value={listed}
          onChange={setListed}
        />
      </ListGroup>
      <FormMessage status={status} t={tp} />
      <Button
        label={mutation.isPending ? tp("saving") : tp("save")}
        loading={mutation.isPending}
        onPress={() => mutation.mutate(listed)}
      />
    </FormScreen>
  );
}

/** フォロワーに公開 (the website's FollowerFieldsForm). */
export function EditFollowerFieldsScreen() {
  const t = useTranslations("profile.followerFields");
  const profile = useProfile();
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={profile}>
        {(p) => <FollowerFieldsForm profile={p} />}
      </QueryState>
    </>
  );
}

/** Each field's current value, so members see what they'd share. */
function personalValues(p: MyProfile): Record<PersonalField, string | null> {
  const social = Object.fromEntries(p.about.social.map((s) => [s.key, s.url]));
  return {
    email: p.account.email,
    phone: p.about.phone,
    lineDisplayName: p.account.lineDisplayName,
    instagram: social.instagram ?? null,
    linkedin: social.linkedin ?? null,
    facebook: social.facebook ?? null,
    x: social.x ?? null,
    website: social.website ?? null,
    currentStageDetail: p.currentStage?.detail ?? null,
  };
}

function FollowerFieldsForm({ profile }: { profile: MyProfile }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const values = personalValues(profile);
  const [shared, setShared] = useState(
    () => new Set<PersonalField>(profile.sharedWithFollowers),
  );
  const { mutation, status } = useProfileForm(profileApi.followerFields, () =>
    router.back(),
  );
  const toggle = (f: PersonalField, on: boolean) =>
    setShared((s) => {
      const next = new Set(s);
      if (on) next.add(f);
      else next.delete(f);
      return next;
    });
  return (
    <FormScreen>
      <Text variant="small" tone="muted">
        {t("followerFields.hint")}
      </Text>
      <ListGroup>
        {PERSONAL_FIELDS.map((f, i) => (
          <PersonalRow
            key={f}
            first={i === 0}
            title={t(`followerFields.fields.${f}`)}
            hint={values[f] || t("followerFields.notSet")}
            value={shared.has(f)}
            onChange={(on) => toggle(f, on)}
          />
        ))}
      </ListGroup>
      <FormMessage status={status} t={t} />
      <Button
        label={mutation.isPending ? t("saving") : t("save")}
        loading={mutation.isPending}
        onPress={() =>
          mutation.mutate(PERSONAL_FIELDS.filter((f) => shared.has(f)))
        }
      />
    </FormScreen>
  );
}

function PersonalRow({
  first,
  ...props
}: {
  first: boolean;
  title: string;
  hint: string;
  value: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <>
      {first ? null : <Separator />}
      <ToggleRow {...props} />
    </>
  );
}
