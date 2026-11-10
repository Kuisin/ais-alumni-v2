import { File as FsFile } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

/**
 * Picked images → files the server accepts (JPEG / PNG; it can't decode
 * HEIC). An iPhone photo is HEIC, others WebP, GIF, AVIF…: each is decoded
 * on the device (expo-image-manipulator — native, or the browser's own
 * decoder on the web), its longest side kept to MAX_SIDE px and saved as a
 * JPEG (a PNG stays a PNG, so transparency survives). Re-encoding also
 * drops the photo's metadata (location). PDFs and other files pass through
 * unchanged; the caller checks the type as before.
 *
 * A browser that can't decode the image (HEIC in desktop Chrome / Firefox)
 * throws UploadImageError("decode") — mobile.upload.errors.decode explains
 * what to do instead.
 */

/** Longest side sent, in pixels. */
export const MAX_SIDE = 2400;
const QUALITY = 0.85;

/** A picked file (ImagePicker asset or DocumentPicker file). */
export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  /** web: the browser's File */
  file?: File;
};

export class UploadImageError extends Error {
  constructor(readonly code: "decode") {
    super(code);
  }
}

const IMAGE_EXTS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

const extOf = (name: string) =>
  name.includes(".") ? (name.split(".").pop()?.toLowerCase() ?? "") : "";

/** The file's type: its own, else from the name's extension. */
export function typeOfPicked(p: Pick<PickedFile, "name" | "mimeType">): string {
  const own = p.mimeType?.toLowerCase();
  if (own && own !== "application/octet-stream") return own;
  const ext = extOf(p.name);
  if (ext === "pdf") return "application/pdf";
  return IMAGE_EXTS[ext] ?? own ?? "";
}

export function isImageFile(p: Pick<PickedFile, "name" | "mimeType">) {
  return typeOfPicked(p).startsWith("image/");
}

function renamed(name: string, ext: "jpg" | "png"): string {
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  return `${base || "photo"}.${ext}`;
}

function sizeOf(uri: string): number | null {
  try {
    const n = new FsFile(uri).size;
    return typeof n === "number" && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * The file to upload: images converted (see above), anything else as it
 * is. Throws UploadImageError("decode") when the image can't be read here.
 */
export async function toUploadable(p: PickedFile): Promise<PickedFile> {
  const type = typeOfPicked(p);
  if (!type.startsWith("image/")) return { ...p, mimeType: type || null };
  const png = type === "image/png";
  const source =
    Platform.OS === "web" && p.file ? URL.createObjectURL(p.file) : p.uri;
  let uri: string;
  try {
    const first = await ImageManipulator.manipulate(source, {
      maxWidth: MAX_SIDE,
      maxHeight: MAX_SIDE,
    }).renderAsync();
    let image = first;
    // Bounded while decoding; resize too in case a platform didn't.
    if (Math.max(first.width, first.height) > MAX_SIDE) {
      const ctx = ImageManipulator.manipulate(first);
      ctx.resize(
        first.width >= first.height
          ? { width: MAX_SIDE }
          : { height: MAX_SIDE },
      );
      image = await ctx.renderAsync();
    }
    const saved = await image.saveAsync({
      compress: QUALITY,
      format: png ? SaveFormat.PNG : SaveFormat.JPEG,
    });
    uri = saved.uri;
  } catch {
    throw new UploadImageError("decode");
  } finally {
    if (source !== p.uri) URL.revokeObjectURL(source);
  }
  const name = renamed(p.name, png ? "png" : "jpg");
  const mimeType = png ? "image/png" : "image/jpeg";
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const file = new File([blob], name, { type: mimeType });
    return { uri, name, mimeType, size: file.size, file };
  }
  return { uri, name, mimeType, size: sizeOf(uri) };
}

/** Append a picked file to a multipart body (web: its File; native: its uri). */
export function appendPicked(fd: FormData, field: string, p: PickedFile) {
  if (p.file) fd.append(field, p.file, p.name);
  // React Native uploads a local file from its uri.
  else
    fd.append(field, {
      uri: p.uri,
      name: p.name,
      type: p.mimeType ?? "application/octet-stream",
    } as unknown as Blob);
}
