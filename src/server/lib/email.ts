import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  /** Optional call-to-action link appended to the body. */
  url?: string;
  /** Ready-made HTML (notification wrapper); otherwise built from text. */
  html?: string;
  /** Where replies go (e.g. the person who sent a support request). */
  replyTo?: string;
};

const FROM = process.env.EMAIL_FROM ?? "AIS Alumni <noreply@ais.kai-lab.net>";

let client: Resend | null = null;
function resend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** System emails (codes, links): same branded frame as notifications. */
function toHtml(msg: EmailMessage): string {
  const body = escapeHtml(msg.text).replaceAll("\n", "<br>");
  const cta = msg.url
    ? `<p style="margin:24px 0"><a href="${escapeHtml(msg.url)}" style="display:inline-block;padding:12px 22px;background:#1e3a8a;color:#ffffff;border-radius:10px;font-weight:600;text-decoration:none">${escapeHtml(msg.url)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',system-ui,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#1e3a8a;color:#ffffff;padding:16px 24px;font-weight:700;font-size:16px">🎓 AIS同窓会 · AIS Alumni</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.7">${body}${cta}</td></tr>
<tr><td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px">AIS同窓会委員会 · AIS Alumni Committee · ais.kai-lab.net</td></tr>
</table></td></tr></table></body></html>`;
}

/** Send a transactional email. Without RESEND_API_KEY it logs instead (dev). */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  const r = resend();
  const text = msg.url ? `${msg.text}\n\n${msg.url}` : msg.text;
  if (!r) {
    // EMAIL_DEV_MAILBOX=1 allows the file mailbox under `next start` (e2e tests).
    if (
      process.env.NODE_ENV === "production" &&
      process.env.EMAIL_DEV_MAILBOX !== "1"
    ) {
      throw new Error("RESEND_API_KEY is not set");
    }
    console.info(`[email:dev] to=${msg.to} subject=${msg.subject}\n${text}`);
    // Dev/test mailbox: the Playwright smoke tests read OTP codes from here.
    const dir = path.join(process.cwd(), ".data", "dev-mail");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${msg.to}.txt`), `${msg.subject}\n${text}`);
    return;
  }
  const { error } = await r.emails.send({
    from: FROM,
    to: msg.to,
    subject: msg.subject,
    text,
    html: msg.html ?? toHtml(msg),
    ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
