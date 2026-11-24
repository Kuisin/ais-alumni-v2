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

/**
 * Most pixels an image may have to be decoded on the server (rounded photos,
 * /api/files?round=). A few hundred KB of PNG can declare 16000×16000 pixels
 * and take over a gigabyte to decode; a phone photo is 12–48 MP.
 */
export const IMAGE_MAX_PIXELS = 50_000_000;

/**
 * Width and height from a PNG's IHDR or a JPEG's SOF header, without
 * decoding; null if they can't be read.
 */
export function imageDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const type = detectAvatarType(bytes);
  if (!type) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type.ext === "png") {
    // signature (8), IHDR length (4) + type (4), then width, height
    if (bytes.length < 24) return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: walk the segments to the first start-of-frame marker.
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof)
      return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
    i += 2 + view.getUint16(i + 2);
  }
  return null;
}

/** Small enough to decode on the server (see IMAGE_MAX_PIXELS). */
export function decodableImage(bytes: Uint8Array): boolean {
  const d = imageDimensions(bytes);
  return Boolean(
    d && d.width > 0 && d.height > 0 && d.width * d.height <= IMAGE_MAX_PIXELS,
  );
}
