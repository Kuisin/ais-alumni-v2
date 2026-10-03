import { hrefPath, nativeHref, splitSitePath } from "@/lib/site-paths";
import { getTranslatorFor } from "@/server/i18n/translator";
import { db } from "@/server/lib/db";
import { isLinkToken, isUserCode, linkText } from "./links";

/** Link-preview fetchers (LINE, Slack, …) — not people opening the link. */
const PREVIEW_BOT =
  /facebookexternalhit|line-poker|Twitterbot|Slackbot|Discordbot|WhatsApp|TelegramBot|LinkedInBot|Googlebot|bingbot|\bbot\b|crawler|spider/i;

const redirect = (to: URL) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: to.toString(),
      "Cache-Control": "private, no-store",
      Vary: "User-Agent",
    },
  });

/**
 * Where a notification's website path ("/app/news/<id>") opens in this web
 * app: the matching screen (src/lib/site-paths.ts, the same map the app
 * uses for links in content), else Home.
 */
export function appPathFor(websitePath: string): string {
  const site = splitSitePath(websitePath);
  const href = nativeHref(site.path, site.query);
  return href ? hrefPath(href) : "/";
}

const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Open a notification link (/n/<user code>/<token>, or /n/<token> without a
 * member). People are sent to the matching screen of this web app (sign-in
 * if needed; Home when there is none — the website's own pages are gone); the open is
 * counted and, with a member code, recorded as that member's read receipt.
 * Link-preview bots get a tiny page with Open Graph tags and the generated
 * card image (title and body only — the notification's own text) and count
 * as nothing. Texts and the page follow the member's current language
 * (Japanese without a member).
 */
export async function openNotificationLink(
  request: Request,
  token: string,
  userCode: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const link = isLinkToken(token)
    ? await db.notificationLink.findUnique({ where: { token } })
    : null;
  if (!link || link.expiresAt < new Date())
    return redirect(new URL("/", url.origin));

  // The member this link was made for (their code): previews and the
  // redirect use their current language.
  const user =
    userCode && isUserCode(userCode)
      ? await db.user.findUnique({
          where: { linkCode: userCode },
          select: { id: true, locale: true },
        })
      : null;
  const locale = user?.locale ?? link.locale ?? "ja";
  const text = linkText(link, locale);

  const target = new URL(appPathFor(link.path), url.origin);
  const ua = request.headers.get("user-agent") ?? "";
  // ?go=1: the preview page's own redirect (a person, whatever the UA says).
  const go = url.searchParams.get("go") === "1";
  if (!go && PREVIEW_BOT.test(ua)) {
    const goUrl = new URL(url.pathname, url.origin);
    goUrl.searchParams.set("go", "1");
    const t = await getTranslatorFor(locale, "notifications");
    const image = new URL(`/n/${token}/og?l=${locale}`, url.origin).toString();
    const title = `${text.title} | ${t("preview.brand")}`;
    const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(t("preview.brand"))}">
<meta property="og:title" content="${esc(text.title)}">
<meta property="og:description" content="${esc(text.body)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(url.toString())}">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
<script>location.replace(${JSON.stringify(goUrl.toString()).replaceAll("<", "\\u003c")})</script>
</head><body><a href="${esc(goUrl.toString())}">${esc(t("preview.open"))}</a></body></html>`;
    // Never cached: a cached preview page must not be served to the person
    // who then taps the link (LINE fetches the preview first). If a person
    // does get this page, the script sends them on (crawlers don't run it).
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        Vary: "User-Agent",
      },
    });
  }

  const now = new Date();
  await db.notificationLink.update({
    where: { id: link.id },
    data: { opens: { increment: 1 }, lastOpenedAt: now },
  });
  // Only members the link was sent to (a receipt exists) are recorded.
  if (user) {
    const where = { linkId_userId: { linkId: link.id, userId: user.id } };
    await db.notificationReceipt
      .update({
        where,
        data: { opens: { increment: 1 }, lastOpenedAt: now },
      })
      .then(() =>
        db.notificationReceipt.updateMany({
          where: { linkId: link.id, userId: user.id, openedAt: null },
          data: { openedAt: now },
        }),
      )
      .catch(() => undefined);
  }
  return redirect(target);
}
