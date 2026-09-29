import { head } from "@vercel/blob";
import { getPrivate, isBlobConfigured } from "@/server/lib/storage";
import { EVIDENCE_MAX_BYTES, EVIDENCE_TYPES } from "./schema";

export { safeFileName } from "./schema";

/**
 * Evidence storage helpers (§6.3). Server only.
 * Every evidence object lives under `evidence/<userId>/`, which is how the
 * server checks that submitted keys belong to the submitting user.
 */

export const EVIDENCE_RETENTION_DAYS = 30;

export function evidencePrefix(userId: string): string {
  return `evidence/${userId}/`;
}

export function isOwnEvidenceKey(userId: string, key: string): boolean {
  return (
    key.startsWith(evidencePrefix(userId)) &&
    !key.includes("..") &&
    !key.includes("\\") &&
    key.length <= 500
  );
}

export function isEvidenceType(
  t: string,
): t is (typeof EVIDENCE_TYPES)[number] {
  return (EVIDENCE_TYPES as readonly string[]).includes(t);
}

/** Magic-byte check so a renamed file cannot pose as an image/PDF. */
export function sniffMatches(bytes: Uint8Array, mimeType: string): boolean {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  switch (mimeType) {
    case "image/jpeg":
      return starts([0xff, 0xd8, 0xff]);
    case "image/png":
      return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "application/pdf":
      return starts([0x25, 0x50, 0x44, 0x46]); // %PDF
    default:
      return false;
  }
}

/** Confirm a stored object exists and read its real size/type. */
export async function statEvidence(
  key: string,
): Promise<{ size: number; contentType: string } | null> {
  try {
    if (isBlobConfigured()) {
      const h = await head(key);
      return { size: h.size, contentType: h.contentType };
    }
    const file = await getPrivate(key);
    if (!file) return null;
    const size = Buffer.isBuffer(file.body) ? file.body.length : 0;
    return { size, contentType: file.contentType };
  } catch {
    return null;
  }
}

export function evidenceAcceptable(stat: {
  size: number;
  contentType: string;
}): boolean {
  return (
    stat.size > 0 &&
    stat.size <= EVIDENCE_MAX_BYTES &&
    isEvidenceType(stat.contentType)
  );
}

export function deleteAfterFrom(decidedAt: Date): Date {
  return new Date(
    decidedAt.getTime() + EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
}
