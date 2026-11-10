import { randomUUID } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { ApiError } from "@/server/lib/mobile/http";
import { putPrivate } from "@/server/lib/storage";
import {
  isEvidenceType,
  safeFileName,
  sniffMatches,
} from "@/server/lib/verification/evidence";
import { EVIDENCE_MAX_BYTES, type EVIDENCE_TYPES } from "./schema";

/**
 * One uploaded file for the committee — application evidence (§6.3) or a
 * 「やりとり」 attachment: JPG/PNG/PDF (magic bytes checked), ≤10 MB,
 * stored privately under `evidence/<uploader id>/`. The app converts
 * photos in other formats (HEIC, WebP…) to JPEG first
 * (src/lib/upload-image.ts); this server can't decode them, so it refuses
 * them with `type` — the code every app version shows — plus `format` (what
 * the file looks like) and `message` (a localized explanation).
 */

export type StoredUpload = {
  key: string;
  fileName: string;
  mimeType: (typeof EVIDENCE_TYPES)[number];
  size: number;
};

/** What a refused file looks like (for the error body and logs). */
export function sniffFormat(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12).toLowerCase();
    if (brand.startsWith("avi")) return "avif";
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1)/.test(brand)) return "heic";
    return "mp4";
  }
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(0, 2) === "BM") return "bmp";
  if (ascii(0, 4) === "II*\0" || ascii(0, 4) === "MM\0*") return "tiff";
  return null;
}

async function refused(
  file: File,
  bytes: Uint8Array | null,
  locale: "ja" | "en",
): Promise<ApiError> {
  const t = await getTranslations({ locale, namespace: "verify" });
  return new ApiError(400, "type", {
    format: (bytes && sniffFormat(bytes)) || file.type || null,
    message: t("evidence.errors.type", { name: file.name || "file" }),
  });
}

export async function storeUpload(
  ownerId: string,
  file: File,
  locale: "ja" | "en",
): Promise<StoredUpload> {
  if (!isEvidenceType(file.type)) throw await refused(file, null, locale);
  if (file.size <= 0 || file.size > EVIDENCE_MAX_BYTES)
    throw new ApiError(400, "size");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffMatches(buf.subarray(0, 8), file.type))
    throw await refused(file, buf.subarray(0, 16), locale);
  const name = file.name || "file";
  const key = await putPrivate(
    `evidence/${ownerId}/${randomUUID()}-${safeFileName(name)}`,
    buf,
    file.type,
  );
  return {
    key,
    fileName: name.slice(0, 200),
    mimeType: file.type,
    size: file.size,
  };
}

/** Read the multipart body's `file` (the web FormData). */
export async function formFile(
  request: Request,
): Promise<{ file: File; form: { get(name: string): unknown } } | null> {
  let form: { get(name: string): unknown };
  try {
    // React Native's global FormData type has no get().
    form = (await request.formData()) as unknown as typeof form;
  } catch {
    return null;
  }
  const file = form.get("file");
  return file instanceof File ? { file, form } : null;
}
