import { z } from "zod";
import type { Prisma } from "@/server/generated/prisma/client";
import { db } from "@/server/lib/db";
import { ApiError } from "@/server/lib/mobile/http";
import { signedFileUrl } from "@/server/lib/storage";
import {
  evidenceAcceptable,
  isEvidenceType,
  isOwnEvidenceKey,
  statEvidence,
} from "@/server/lib/verification/evidence";

/**
 * 「やりとり」 attachments: photos / PDFs sent with a message, by the
 * applicant, the parent managing a child's account, or the committee.
 * Each is uploaded first (storeUpload, under the uploader's own
 * `evidence/<id>/` prefix) and named by its key when the message is sent.
 * They're VerificationEvidence rows with messageId set — the same private
 * storage, short signed links and 30-day deletion after the final decision
 * (admin-verify sets deleteAfter on every row of the request; the
 * cleanup-evidence job deletes them) — but never the application's
 * evidence: every evidence read filters `messageId: null`.
 */

type Tx = Prisma.TransactionClient;

export const ATTACHMENTS_MAX = 3;

/** In a message's JSON body: an uploaded file to attach. */
export const AttachmentRefs = z
  .array(
    z.object({
      key: z.string().min(1).max(500),
      fileName: z.string().max(200),
    }),
  )
  .max(ATTACHMENTS_MAX)
  .optional();

export type AttachmentRef = { key: string; fileName: string };

export type AttachmentRow = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
};

/**
 * The files to attach: the author's own uploads, stored, acceptable and
 * not attached anywhere yet. Throws 400 "attachments" otherwise.
 */
export async function checkAttachments(
  authorId: string,
  refs: AttachmentRef[],
): Promise<AttachmentRow[]> {
  const bad = () => new ApiError(400, "attachments");
  const unique = [...new Map(refs.map((r) => [r.key, r])).values()];
  if (unique.length > ATTACHMENTS_MAX) throw bad();
  if (!unique.length) return [];
  if (unique.some((r) => !isOwnEvidenceKey(authorId, r.key))) throw bad();
  const used = await db.verificationEvidence.count({
    where: { storageKey: { in: unique.map((r) => r.key) } },
  });
  if (used) throw bad();
  const rows: AttachmentRow[] = [];
  for (const r of unique) {
    const stat = await statEvidence(r.key);
    if (!stat || !evidenceAcceptable(stat) || !isEvidenceType(stat.contentType))
      throw bad();
    rows.push({
      storageKey: r.key,
      fileName:
        r.fileName.trim().slice(0, 200) ||
        r.key.slice(r.key.lastIndexOf("/") + 1),
      mimeType: stat.contentType,
      size: stat.size,
    });
  }
  return rows;
}

export async function saveAttachments(
  tx: Tx,
  requestId: string,
  messageId: string,
  rows: AttachmentRow[],
): Promise<void> {
  if (!rows.length) return;
  // deleteAfter stays null: messages only go to open applications, and the
  // final decision dates every file of the request.
  await tx.verificationEvidence.createMany({
    data: rows.map((r) => ({ ...r, requestId, messageId })),
  });
}

/** A message's attachment as the apps show it (signed link, 15 minutes). */
export function attachmentView(e: {
  id: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
}) {
  return {
    id: e.id,
    fileName: e.fileName,
    mimeType: e.mimeType,
    size: e.size,
    url: signedFileUrl(e.storageKey, undefined, e.fileName),
  };
}

/** Notification text for a message without words: its files' names. */
export function attachmentsNote(rows: { fileName: string }[]): string {
  return rows.map((r) => r.fileName).join(", ");
}
