/** Avatar upload rules (§10.2): JPG or PNG, at most 2 MB. */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type AvatarType = {
  ext: "jpg" | "png";
  mime: "image/jpeg" | "image/png";
};

/**
 * Identify the image by its magic bytes rather than trusting the browser's
 * declared MIME type.
 */
export function detectAvatarType(bytes: Uint8Array): AvatarType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((b, i) => bytes[i] === b)) {
    return { ext: "png", mime: "image/png" };
  }
  return null;
}
