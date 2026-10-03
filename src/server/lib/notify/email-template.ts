import type { Locale } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { publicUrl } from "@/server/lib/urls";
import type { RenderedNotification } from "./render";

const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Email version of a notification: more than the LINE push (the detail and
 * the committee note), in the AIS Alumni wrapper with a button and a footer
 * explaining why it was sent and where to change settings.
 */
export async function renderEmail(input: {
  rendered: RenderedNotification;
  locale: Locale;
  recipientName: string | null;
  url: string | null;
  note?: string | null;
}): Promise<{ subject: string; text: string; html: string }> {
  const { rendered: r, locale, url, note } = input;
  const t = await getTranslatorFor(locale, "notifications");
  const greeting = input.recipientName
    ? t("email.greeting", { name: input.recipientName })
    : t("email.greetingNoName");
  const settingsUrl = publicUrl("/settings#notifications");
  const why = t("email.why", { category: r.categoryLabel });

  const text = [
    greeting,
    "",
    `${r.emoji} ${r.title}`,
    r.body,
    r.detail,
    note ? `\n${t("email.note")}:\n${note}` : "",
    url ? `\n${r.cta || url}: ${url}` : "",
    "",
    "—",
    why,
    `${t("email.settings")}: ${settingsUrl}`,
    t("email.footer"),
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");

  const button = url
    ? `<p style="margin:24px 0"><a href="${esc(url)}" style="display:inline-block;padding:12px 22px;background:#1e3a8a;color:#ffffff;border-radius:10px;font-weight:600;text-decoration:none">${esc(r.cta || url)}</a></p>
       <p style="margin:0;color:#64748b;font-size:12px">${esc(t("email.linkNote"))}<br><a href="${esc(url)}" style="color:#1e3a8a">${esc(url)}</a></p>`
    : "";
  const noteBlock = note
    ? `<div style="margin:16px 0;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px"><p style="margin:0 0 4px;font-weight:600;color:#92400e">${esc(t("email.note"))}</p><p style="margin:0;white-space:pre-line">${esc(note)}</p></div>`
    : "";
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',system-ui,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#1e3a8a;color:#ffffff;padding:16px 24px;font-weight:700;font-size:16px">🎓 ${esc(t("preview.brand"))}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.7">
<p style="margin:0 0 12px;color:#475569">${esc(greeting)}</p>
<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#1e3a8a">${esc(r.categoryLabel)}</p>
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.4">${esc(r.emoji)} ${esc(r.title)}</h1>
<p style="margin:0 0 8px">${esc(r.body)}</p>
${r.detail ? `<p style="margin:0;color:#334155">${esc(r.detail)}</p>` : ""}
${noteBlock}${button}
</td></tr>
<tr><td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6">
${esc(why)}<br><a href="${esc(settingsUrl)}" style="color:#1e3a8a">${esc(t("email.settings"))}</a><br>${esc(t("email.footer"))}
</td></tr></table></td></tr></table></body></html>`;
  return { subject: r.subject, text, html };
}
