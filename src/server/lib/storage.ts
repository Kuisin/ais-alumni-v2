import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

/**
 * Private file storage (§2, §6.3). Uses Vercel Blob with `access: "private"`
 * when BLOB_READ_WRITE_TOKEN is set; otherwise a local directory (dev only).
 * Files are served only through /api/files with a short-lived HMAC signature
 * that the server issues after its own authorization check.
 */

export const SIGNED_URL_TTL_MS = 15 * 60 * 1000; // §15

const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function localPath(key: string): string {
  const resolved = path.resolve(LOCAL_DIR, key);
  if (!resolved.startsWith(LOCAL_DIR + path.sep))
    throw new Error("Invalid key");
  return resolved;
}

export async function putPrivate(
  key: string,
  body: Buffer | Blob,
  contentType: string,
): Promise<string> {
  if (isBlobConfigured()) {
    const res = await put(key, body, {
      access: "private",
      contentType,
      addRandomSuffix: true,
    });
    return res.pathname;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  const buf =
    body instanceof Blob ? Buffer.from(await body.arrayBuffer()) : body;
  await writeFile(file, buf);
  await writeFile(`${file}.type`, contentType);
  return key;
}

export async function getPrivate(
  key: string,
): Promise<{ body: ReadableStream | Buffer; contentType: string } | null> {
  if (isBlobConfigured()) {
    const res = await get(key, { access: "private" });
    if (!res) return null;
    return {
      body: res.stream as ReadableStream,
      contentType: res.blob.contentType ?? "application/octet-stream",
    };
  }
  try {
    const file = localPath(key);
    const [body, contentType] = await Promise.all([
      readFile(file),
      readFile(`${file}.type`, "utf8").catch(() => "application/octet-stream"),
    ]);
    return { body, contentType };
  } catch {
    return null;
  }
}

export async function deletePrivate(key: string): Promise<void> {
  if (isBlobConfigured()) {
    await del(key);
    return;
  }
  const file = localPath(key);
  await rm(file, { force: true });
  await rm(`${file}.type`, { force: true });
}

function sign(key: string, exp: number): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret)
    .update(`${key}\n${exp}`)
    .digest("base64url");
}

/** Short-lived URL for a private file. Call only after authorizing the viewer. */
export function signedFileUrl(
  key: string,
  ttlMs = SIGNED_URL_TTL_MS,
  fileName?: string,
): string {
  const exp = Date.now() + ttlMs;
  const qs = new URLSearchParams({
    key,
    exp: String(exp),
    sig: sign(key, exp),
    ...(fileName ? { name: fileName.slice(0, 200) } : {}),
  });
  return `/api/files?${qs}`;
}

export function verifySignedFile(
  key: string | null,
  exp: string | null,
  sig: string | null,
): key is string {
  if (!key || !exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  const expected = Buffer.from(sign(key, expNum));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
