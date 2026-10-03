import { getTranslatorFor } from "@/server/i18n/translator";
import { db } from "@/server/lib/db";
import { NOTIFY_KINDS, type NotifyKind } from "@/server/lib/notify/catalog";
import { isLinkToken, linkText } from "@/server/lib/notify/links";
import { loadNotoSansJp } from "@/server/lib/og/font";
import { imageResponse } from "@/server/lib/og/image-response";

/**
 * Preview card for a notification link (1200×630): brand, category, the
 * notification's headline and sentence. No sign-in needed; nothing beyond
 * what the notification itself says, in the opener's language.
 */
export async function notificationCard(
  request: Request,
  token: string,
): Promise<Response> {
  const link = isLinkToken(token)
    ? await db.notificationLink.findUnique({ where: { token } })
    : null;
  if (!link) return new Response("Not found", { status: 404 });
  // ?l= is the opener's language (set by the preview page).
  const l = new URL(request.url).searchParams.get("l");
  const locale = l === "en" || l === "ja" ? l : (link.locale ?? "ja");
  const { title, body } = linkText(link, locale);
  const t = await getTranslatorFor(locale, "notifications");
  const spec = NOTIFY_KINDS[link.kind as NotifyKind];
  const category = t(`categories.${link.category}`);
  const brand = t("preview.brand");
  const site = t("preview.site");
  const font = await loadNotoSansJp(
    `${brand}${category}${title}${body}${site}🎓`,
  );

  // Without the font (Google Fonts unreachable) there is no text: let the
  // fetcher try again later rather than cache an empty card.
  if (!font)
    return new Response("Unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  const img = await imageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f1f5f9",
        fontFamily: "NotoSansJP",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          background: "#1e3a8a",
          color: "#ffffff",
          padding: "28px 56px",
          fontSize: 40,
          fontWeight: 700,
        }}
      >
        <span>🎓</span>
        <span>{brand}</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          margin: 40,
          padding: 48,
          background: "#ffffff",
          borderRadius: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#1e3a8a",
            fontWeight: 700,
          }}
        >
          {category}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 64,
            fontWeight: 700,
            color: "#0f172a",
            lineHeight: 1.25,
          }}
        >
          {`${spec?.emoji ?? "🔔"} ${title}`}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 36,
            color: "#334155",
            lineHeight: 1.45,
          }}
        >
          {body}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontSize: 26,
            color: "#64748b",
          }}
        >
          {site}
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "NotoSansJP", data: font, weight: 700, style: "normal" }],
    },
  );
  img.headers.set("Cache-Control", "public, max-age=86400, immutable");
  return img;
}
