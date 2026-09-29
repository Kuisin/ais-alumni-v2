import type { MyProfile } from "@contract/account";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Stack } from "expo-router";
import { Camera, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useProfile } from "@/features/me/api";
import { confirmAction } from "@/features/me/confirm";
import { ToggleRow } from "@/features/me/rows";
import { Avatar, Button, Card, ListGroup, QueryState, space, Text } from "@/ui";
import { profileApi, useProfileForm } from "./api";
import { FormMessage, FormScreen } from "./form-parts";

const PHOTO = 120;
/** Longest side sent: well under the website's 2 MB limit as a JPEG. */
const MAX_SIDE = 1024;

type Picked = { uri: string; file?: File };

/**
 * プロフィール写真 (the website's AvatarForm + AvatarSettingsForm): choose a
 * photo (square crop in the system picker), upload it, remove it, and
 * whether every member may see it.
 */
export function EditPhotoScreen() {
  const t = useTranslations("profile");
  const profile = useProfile();
  return (
    <>
      <Stack.Screen options={{ title: t("sections.photo") }} />
      <QueryState query={profile}>
        {(p) => <PhotoForm profile={p} />}
      </QueryState>
    </>
  );
}

/** Square-cropped, resized JPEG of the chosen image. */
async function prepare(asset: ImagePicker.ImagePickerAsset): Promise<Picked> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIDE)
    context.resize(
      asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE },
    );
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  if (Platform.OS === "web") {
    const blob = await (await fetch(saved.uri)).blob();
    return {
      uri: saved.uri,
      file: new File([blob], "avatar.jpg", { type: "image/jpeg" }),
    };
  }
  return { uri: saved.uri };
}

function PhotoForm({ profile }: { profile: MyProfile }) {
  const t = useTranslations("profile");
  const tp = useTranslations("profile.photo");
  const tc = useTranslations("common");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [isPublic, setIsPublic] = useState(profile.photo.public);
  const hasPhoto = profile.photo.uploaded ?? false;

  const upload = useProfileForm(profileApi.uploadPhoto, () => setPicked(null));
  const remove = useProfileForm(profileApi.removePhoto);
  const settings = useProfileForm(profileApi.photoVisibility);

  const choose = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setPreparing(true);
    upload.setStatus(null);
    try {
      setPicked(await prepare(asset));
    } catch {
      upload.setStatus({
        ok: false,
        error: { error: "form", message: "errors.fileType" },
        offline: false,
      });
    } finally {
      setPreparing(false);
    }
  };

  const send = () => {
    if (!picked) return;
    const body = new FormData();
    if (picked.file) body.append("avatar", picked.file);
    // React Native uploads a local file from its uri.
    else
      body.append("avatar", {
        uri: picked.uri,
        name: "avatar.jpg",
        type: "image/jpeg",
      } as unknown as Blob);
    upload.mutation.mutate(body);
  };

  const onRemove = async () => {
    const ok = await confirmAction({
      title: t("photoRemoveConfirm"),
      confirm: t("photoRemove"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) remove.mutation.mutate(undefined);
  };

  return (
    <FormScreen>
      <Card style={styles.card}>
        <Avatar uri={picked?.uri ?? profile.avatar} size={PHOTO} />
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={t("photoChoose")}
            loading={preparing}
            icon={(c) => <Camera color={c} size={18} aria-hidden />}
            onPress={choose}
          />
          {picked ? (
            <Button
              label={
                upload.mutation.isPending ? t("uploading") : t("photoUpload")
              }
              loading={upload.mutation.isPending}
              onPress={send}
            />
          ) : null}
          {hasPhoto && !picked ? (
            <Button
              variant="ghost"
              label={t("photoRemove")}
              loading={remove.mutation.isPending}
              icon={(c) => <Trash2 color={c} size={18} aria-hidden />}
              onPress={onRemove}
            />
          ) : null}
        </View>
        <Text variant="small" tone="muted" center>
          {t("hints.avatar")}
        </Text>
        <FormMessage status={upload.status} t={t} />
        <FormMessage status={remove.status} t={t} />
      </Card>

      <ListGroup>
        <ToggleRow
          title={tp("public")}
          hint={tp("publicHint")}
          value={isPublic}
          onChange={setIsPublic}
        />
      </ListGroup>
      <FormMessage status={settings.status} t={t} />
      <Button
        label={settings.mutation.isPending ? t("saving") : t("save")}
        loading={settings.mutation.isPending}
        onPress={() => settings.mutation.mutate(isPublic)}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: space.md },
  actions: { alignSelf: "stretch", gap: space.sm },
});
