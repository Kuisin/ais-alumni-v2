import type { EvidenceUploaded } from "@contract/onboarding";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { FileText, ImageIcon } from "lucide-react-native";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ApiError, api } from "@/lib/api";
import {
  appendPicked,
  type PickedFile,
  toUploadable,
  UploadImageError,
} from "@/lib/upload-image";
import { Button, colors, radius, space, Text } from "@/ui";
import {
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_TYPES,
  type EvidenceItem,
  type EvidenceKindValue,
} from "./rules";

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | {
      kind: "error";
      code: "type" | "size" | "count" | "forbidden" | "generic" | "decode";
      name?: string;
    }
  | { kind: "done"; name: string };

/** A picked file, whichever picker it came from. */
type Picked = PickedFile;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Evidence files (§6.3): photos or PDFs, ≤10 MB each, ≤3 files — a photo
 * from the library or a file. Photos in any format the device reads (HEIC,
 * WebP…) are sent as JPEG (src/lib/upload-image.ts); the server takes
 * JPG/PNG/PDF only. Each is uploaded right away
 * (POST /onboarding/verify/evidence) and attached when the application is
 * sent; removing a not-yet-sent one deletes it on the server.
 */
export function EvidenceUploader({
  items,
  onChange,
  error,
  kind = "OTHER",
  max = EVIDENCE_MAX_FILES,
  label,
  hint,
}: {
  /** files of this kind only */
  items: EvidenceItem[];
  onChange: (items: EvidenceItem[]) => void;
  /** verify.errors.<code> text */
  error?: string | null;
  kind?: EvidenceKindValue;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const t = useTranslations("verify");
  const tm = useTranslations("mobile.verify");
  const tu = useTranslations("mobile.upload");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "uploading";
  const remaining = max - items.length;

  async function uploadOne(picked: Picked): Promise<EvidenceItem | null> {
    setStatus({ kind: "uploading", name: picked.name });
    let p: Picked;
    try {
      p = await toUploadable(picked);
    } catch (e) {
      setStatus({
        kind: "error",
        code: e instanceof UploadImageError ? "decode" : "generic",
        name: picked.name,
      });
      return null;
    }
    const type = p.mimeType ?? "";
    if (!(EVIDENCE_TYPES as readonly string[]).includes(type)) {
      setStatus({ kind: "error", code: "type", name: p.name });
      return null;
    }
    if (p.size !== null && (p.size > EVIDENCE_MAX_BYTES || p.size === 0)) {
      setStatus({ kind: "error", code: "size", name: p.name });
      return null;
    }
    const fd = new FormData();
    appendPicked(fd, "file", p);
    fd.append("kind", kind);
    try {
      const r = await api<EvidenceUploaded>("/onboarding/verify/evidence", {
        body: fd,
      });
      return r.item;
    } catch (e) {
      const code =
        e instanceof ApiError
          ? e.status === 413 || e.code === "size"
            ? "size"
            : e.code === "type"
              ? "type"
              : e.status === 401 || e.status === 403
                ? "forbidden"
                : "generic"
          : "generic";
      setStatus({ kind: "error", code, name: p.name });
      return null;
    }
  }

  async function add(list: Picked[]) {
    if (!list.length) return;
    if (list.length > remaining) {
      setStatus({ kind: "error", code: "count" });
      return;
    }
    let next = items;
    let last: string | null = null;
    for (const p of list) {
      const item = await uploadOne(p);
      if (!item) break;
      next = [...next, item];
      last = p.name;
      onChange(next);
    }
    if (last) setStatus({ kind: "done", name: last });
  }

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: max > 1,
      selectionLimit: remaining,
      // iOS: a JPEG rather than the HEIC original (converted below anyway).
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
      // Any image (converted before upload) or a PDF.
      type: ["image/*", "application/pdf"],
      multiple: max > 1,
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

  function remove(item: EvidenceItem) {
    onChange(items.filter((i) => i.key !== item.key));
    // Not-yet-sent uploads are deleted right away; files attached to an
    // earlier submission are removed by the server on resubmission.
    void api("/onboarding/verify/evidence/discard", {
      body: { key: item.key },
    }).catch(() => {});
  }

  return (
    <View style={styles.wrap}>
      <View>
        <Text variant="small" weight="semibold">
          {label ?? t("evidence.label")}
        </Text>
        <Text variant="small" tone="muted">
          {hint ?? t("evidence.hint", { max })}
        </Text>
      </View>

      {items.length ? (
        <View style={styles.list}>
          {items.map((item, i) => (
            <View
              key={item.key}
              style={[styles.item, i > 0 ? styles.divider : null]}
            >
              <Text variant="small" numberOfLines={1} style={styles.flex}>
                {item.fileName}{" "}
                <Text variant="small" tone="subtle">
                  ({formatSize(item.size)})
                </Text>
              </Text>
              <Button
                variant="ghost"
                compact
                label={t("evidence.removeShort")}
                accessibilityLabel={t("evidence.remove", {
                  name: item.fileName,
                })}
                disabled={busy}
                onPress={() => remove(item)}
              />
            </View>
          ))}
        </View>
      ) : null}

      {remaining > 0 ? (
        <View style={styles.buttons}>
          {Platform.OS === "web" ? null : (
            <Button
              variant="secondary"
              label={tm("pickPhoto")}
              disabled={busy}
              icon={(c) => <ImageIcon size={16} color={c} />}
              onPress={() => void pickPhoto()}
            />
          )}
          <Button
            variant="secondary"
            label={tm("pickFile")}
            disabled={busy}
            icon={(c) => <FileText size={16} color={c} />}
            onPress={() => void pickFile()}
          />
        </View>
      ) : (
        <Text variant="small" tone="muted">
          {t("evidence.full")}
        </Text>
      )}

      <View accessibilityLiveRegion="polite">
        {status.kind === "uploading" ? (
          <Text variant="small">
            {t("evidence.uploading", { name: status.name })}
          </Text>
        ) : status.kind === "done" ? (
          <Text variant="small" tone="success">
            {t("evidence.uploaded", { name: status.name })}
          </Text>
        ) : status.kind === "error" ? (
          <Text variant="small" tone="danger">
            {status.code === "decode"
              ? tu("errors.decode", { name: status.name ?? "" })
              : t(`evidence.errors.${status.code}`, {
                  name: status.name ?? "",
                })}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: space.md },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
