import { createHash, timingSafeEqual } from "node:crypto";

/**
 * GET /api/cron: the Supabase pg_cron job sends `Authorization: Bearer
 * $CRON_SECRET` (the secret is kept in Supabase Vault).
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  // Compared as hashes in constant time: no timing hint about the secret.
  const hash = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(
    hash(request.headers.get("authorization") ?? ""),
    hash(`Bearer ${secret}`),
  );
}
