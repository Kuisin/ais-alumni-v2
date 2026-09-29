import { buildUserExport } from "@/server/lib/account";
import { mobileRoute, notFound } from "@/server/lib/mobile/http";

/**
 * APPI data export (the website's /api/me/export): a JSON download of the
 * member's own data. Any signed-in account may export — the right to
 * access one's data does not depend on account state.
 */
export const GET = mobileRoute(async ({ user }) => {
  const data = await buildUserExport(user.id);
  if (!data) throw notFound();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ais-alumni-my-data-${date}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}, "user");
