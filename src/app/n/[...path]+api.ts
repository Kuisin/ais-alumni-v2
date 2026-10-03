import { notificationCard } from "@/server/lib/notify/og";
import { openNotificationLink } from "@/server/lib/notify/open";

/**
 * Notification short links (src/server/lib/notify/links.ts), one route for
 * all three forms so they share one server bundle:
 * - /n/<token>: a link without a member (no read receipt);
 * - /n/<member code>/<token>: one member's link (read receipt);
 * - /n/<token>/og: the link's preview card image.
 */
export async function GET(request: Request): Promise<Response> {
  const parts = new URL(request.url).pathname
    .replace(/^\/n\//, "")
    .replace(/\/+$/, "")
    .split("/"); // tokens and member codes are plain letters and digits
  const [a = "", b] = parts;
  if (parts.length === 1) return openNotificationLink(request, a, null);
  if (parts.length === 2 && b === "og") return notificationCard(request, a);
  if (parts.length === 2 && b) return openNotificationLink(request, b, a);
  return new Response("Not found", { status: 404 });
}
