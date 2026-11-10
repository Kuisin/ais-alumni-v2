import type { ApplicationAttachment } from "@contract/onboarding";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { FileText, ImageIcon, X } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ApiError } from "@/lib/api";
import { absoluteUrl } from "@/lib/config";
import {
  type PickedFile,
  toUploadable,
  UploadImageError,
} from "@/lib/upload-image";
import { Button, colors, radius, space, Text, TOUCH } from "@/ui";

/**
 * 「やりとり」 attachments: up to 3 photos / PDFs per message. Photos in any
 * format the device reads are sent as JPEG (src/lib/upload-image.ts); each
 * file is uploaded when picked and attached when the message is sent.
 * Shown under the message: images as thumbnails, PDFs as a file row; a tap
 * opens the file (a signed link, valid 15 minutes) in the in-app browser.
 */

export const ATTACHMENTS_MAX = 3;
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "application/pdf"];

/** An uploaded file waiting to be sent. */
export type PendingAttachment = {
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
};

/** How a thread uploads (and drops) the files for its next message. */
export type AttachConfig = {
  upload: (f: PickedFile) => Promise<PendingAttachment>;
  discard: (key: string) => void;
};

const isImage = (mimeType: string) => mimeType.startsWith("image/");

function openFile(url: string) {
  void WebBrowser.openBrowserAsync(absoluteUrl(url)).catch(() => {});
}

/** A sent message's files. */
export function MessageAttachments({
  items,
  align,
}: {
  items: ApplicationAttachment[];
  align: "start" | "end";
}) {
  if (!items.length) return null;
  return (
    <View
      style={[styles.sent, align === "end" ? styles.end : null]}
      accessibilityRole="list"
    >
      {items.map((a) =>
        isImage(a.mimeType) ? (
          <Pressable
            key={a.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={a.fileName}
            onPress={() => openFile(a.url)}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Image
              source={{ uri: absoluteUrl(a.url) }}
              style={styles.thumb}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        ) : (
          <Pressable
            key={a.id}
            accessibilityRole="link"
            accessibilityLabel={a.fileName}
            onPress={() => openFile(a.url)}
            style={({ pressed }) => [
              styles.fileRow,
              pressed ? styles.pressed : null,
            ]}
          >
            <FileText size={18} color={colors.brand700} aria-hidden />
            <Text
              variant="small"
              tone="brand"
              numberOfLines={1}
              style={styles.fileName}
            >
              {a.fileName}
            </Text>
          </Pressable>
        ),
      )}
    </View>
  );
}

type Failure = {
  code: "type" | "size" | "count" | "generic" | "decode";
  name: string;
};

/** The composer's part: pick, upload, list and remove files. */
export function AttachmentPicker({
  config,
  items,
  onChange,
  disabled,
}: {
  config: AttachConfig;
  items: PendingAttachment[];
  onChange: (items: PendingAttachment[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("mobile.applicationMessages");
  const tv = useTranslations("mobile.verify");
  const tu = useTranslations("mobile.upload");
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<Failure | null>(null);
  const remaining = ATTACHMENTS_MAX - items.length;

  async function uploadOne(picked: PickedFile) {
    setBusy(picked.name);
    try {
      const f = await toUploadable(picked);
      const type = f.mimeType ?? "";
      if (!TYPES.includes(type)) {
        setFailed({ code: "type", name: picked.name });
        return null;
      }
      if (f.size !== null && (f.size <= 0 || f.size > MAX_BYTES)) {
        setFailed({ code: "size", name: picked.name });
        return null;
      }
      return await config.upload(f);
    } catch (e) {
      setFailed({
        name: picked.name,
        code:
          e instanceof UploadImageError
            ? "decode"
            : e instanceof ApiError && (e.code === "size" || e.status === 413)
              ? "size"
              : e instanceof ApiError && e.code === "type"
                ? "type"
                : "generic",
      });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function add(list: PickedFile[]) {
    if (!list.length) return;
    setFailed(null);
    if (list.length > remaining) {
      setFailed({ code: "count", name: "" });
      return;
    }
    let next = items;
    for (const p of list) {
      const item = await uploadOne(p);
      if (!item) break;
      next = [...next, item];
      onChange(next);
    }
  }

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      // iOS: a JPEG rather than the HEIC original (converted anyway).
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 1,
    });
    if (r.canceled) return;
    await add(
      r.assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName ?? `photo-${i + 1}.jpg`,
        mimeType: a.mimeType ?? null,
        size: a.fileSize ?? null,
        file: a.file,
      })),
    );
  }

  async function pickFile() {
    const r = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      multiple: remaining > 1,
      copyToCacheDirectory: true,
    });
    if (r.canceled) return;
    await add(
      r.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType ?? null,
        size: a.size ?? null,
        file: a.file,
      })),
    );
  }

  function remove(item: PendingAttachment) {
    onChange(items.filter((i) => i.key !== item.key));
    config.discard(item.key);
  }

  const off = disabled || Boolean(busy);
  return (
    <View style={styles.picker}>
      {items.length ? (
        <View style={styles.pending} accessibilityRole="list">
          {items.map((a) => (
            <View key={a.key} style={styles.pendingRow}>
              {isImage(a.mimeType) ? (
                <ImageIcon size={16} color={colors.slate500} aria-hidden />
              ) : (
                <FileText size={16} color={colors.slate500} aria-hidden />
              )}
              <Text variant="small" numberOfLines={1} style={styles.fileName}>
                {a.fileName}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("attachRemove", { name: a.fileName })}
                onPress={() => remove(a)}
                disabled={off}
                style={({ pressed }) => [
                  styles.remove,
                  pressed ? styles.pressed : null,
                ]}
              >
                <X size={18} color={colors.slate600} aria-hidden />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {remaining > 0 ? (
        <View style={styles.buttons}>
          {Platform.OS === "web" ? null : (
            <Button
              variant="secondary"
              compact
              label={tv("pickPhoto")}
              disabled={off}
              icon={(c) => <ImageIcon size={16} color={c} aria-hidden />}
              onPress={() => void pickPhoto()}
            />
          )}
          <Button
            variant="secondary"
            compact
            label={Platform.OS === "web" ? t("attach") : tv("pickFile")}
            disabled={off}
            icon={(c) => <FileText size={16} color={c} aria-hidden />}
            onPress={() => void pickFile()}
          />
        </View>
      ) : null}
      <View accessibilityLiveRegion="polite">
        {busy ? (
          <Text variant="small" tone="muted">
            {t("preparing", { name: busy })}
          </Text>
        ) : failed ? (
          <Text variant="small" tone="danger" accessibilityRole="alert">
            {failed.code === "decode"
              ? tu("errors.decode", { name: failed.name })
              : t(`attachErrors.${failed.code}`, {
                  name: failed.name,
                  max: ATTACHMENTS_MAX,
                })}
          </Text>
        ) : (
          <Text variant="caption" tone="subtle">
            {t("attachHint", { max: ATTACHMENTS_MAX })}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sent: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  end: { justifyContent: "flex-end" },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
  },
  fileRow: {
    minHeight: TOUCH,
    maxWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  fileName: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  picker: { gap: space.sm },
  pending: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.md,
  },
  remove: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
