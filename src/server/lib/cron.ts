/**
 * GET /api/cron: the Supabase pg_cron job sends `Authorization: Bearer
 * $CRON_SECRET` (the secret is kept in Supabase Vault).
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
