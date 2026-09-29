import type { AdminLine } from "@contract/admin-manage";
import {
  RICH_MENU_ITEMS,
  RICH_MENU_REPLIES,
  richMenuStatus,
} from "@/server/lib/line-richmenu";
import {
  richMenuImage,
  richMenuLabels,
} from "@/server/lib/line-richmenu-image";
import { lineQuota, lineSendsByCategory } from "@/server/lib/line-usage";

/**
 * LINE Official Account (the website's /app/admin/line; the caller checks
 * admin): this month's messages, the rich menu's state and its tiles.
 */
export async function loadAdminLine(): Promise<AdminLine> {
  const [status, ja, en, quota, byCategory] = await Promise.all([
    richMenuStatus(),
    richMenuLabels("ja"),
    richMenuLabels("en"),
    lineQuota(),
    lineSendsByCategory(new Date()),
  ]);
  const installed = Boolean(status.installed.ja);
  return {
    configured: status.configured,
    installed,
    isDefault: installed && status.defaultId === status.installed.ja,
    usage: { quota, byCategory },
    previews: (
      [
        ["ja", ja],
        ["en", en],
      ] as const
    ).map(([locale, l]) => ({
      locale,
      image: `/api/mobile/v1/admin/line/preview?locale=${locale}`,
      imageDots: `/api/mobile/v1/admin/line/preview?locale=${locale}&chats=1&news=1`,
      replies: RICH_MENU_REPLIES.map((i) => ({
        key: i.key,
        label: l.labels[i.key],
      })),
      items: RICH_MENU_ITEMS.map((i) => ({
        key: i.key,
        label: l.labels[i.key],
        path: `/${locale}${i.path}`,
      })),
    })),
  };
}

/** The menu image as uploaded (?chats=1 / ?news=1 show the unread dots). */
export async function richMenuPreview(
  params: Record<string, string>,
): Promise<Response> {
  const locale = params.locale === "en" ? "en" : "ja";
  const img = await richMenuImage(locale, {
    chats: params.chats === "1",
    news: params.news === "1",
  });
  return new Response(img.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
