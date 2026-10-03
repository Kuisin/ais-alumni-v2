import { webPathFor } from "@/lib/site-paths";
import { AccountState, type Locale } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { db } from "@/server/lib/db";
import { sendEmail } from "@/server/lib/email";
import { publicUrl } from "@/server/lib/urls";
import { SUPPORT_LIMITS, supportRef } from "./support";

export type SupportInput = {
  userId: string | null;
  name: string;
  email: string;
  type: string;
  topic: string;
  subject: string;
  message: string;
  locale: Locale;
  /** page the form was sent from */
  page?: string | null;
};

/** Too many requests from this sender in the last hour? */
export async function supportRateLimited(
  email: string,
  userId: string | null,
): Promise<boolean> {
  const n = await db.supportRequest.count({
    where: {
      createdAt: { gt: new Date(Date.now() - 3_600_000) },
      OR: [{ email }, ...(userId ? [{ userId }] : [])],
    },
  });
  return n >= SUPPORT_LIMITS.perHour;
}

/**
 * Where admin mail goes: every active admin with an email, plus
 * SUPPORT_EMAIL (comma-separated), without duplicates.
 */
export async function adminInboxes(): Promise<
  { primaryEmail: string; locale: Locale }[]
> {
  const admins = await db.user.findMany({
    where: {
      isAdmin: true,
      state: AccountState.ACTIVE,
      primaryEmail: { not: null },
    },
    select: { primaryEmail: true, locale: true },
  });
  const extra = (process.env.SUPPORT_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((e) => ({ primaryEmail: e, locale: "ja" as Locale }));
  const seen = new Set<string>();
  const out: { primaryEmail: string; locale: Locale }[] = [];
  for (const a of [...admins, ...extra]) {
    const e = a.primaryEmail?.toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push({ primaryEmail: a.primaryEmail as string, locale: a.locale });
  }
  return out;
}

/**
 * Save a support request and email it: every admin gets the full request
 * (Reply-To the sender, so answering is one click); the sender gets a copy
 * with the reference number. SUPPORT_EMAIL (comma-separated) adds inboxes.
 */
export async function createSupportRequest(input: SupportInput) {
  const req = await db.supportRequest.create({ data: input });
  const ref = supportRef(req.id);

  const sends = (await adminInboxes()).map(async (a) => {
    const t = await getTranslatorFor(a.locale, "support");
    const type = t(`types.${input.type}.label`);
    const topic = t(`types.${input.type}.topics.${input.topic}`);
    await sendEmail({
      to: a.primaryEmail,
      replyTo: input.email,
      subject: t("email.admin.subject", { ref, type, subject: input.subject }),
      text: [
        t("email.admin.intro"),
        "",
        `${t("form.type")}: ${type} › ${topic}`,
        `${t("form.subject")}: ${input.subject}`,
        `${t("form.name")}: ${input.name}${input.userId ? ` (${t("email.admin.member")})` : ` (${t("email.admin.visitor")})`}`,
        `${t("form.email")}: ${input.email}`,
        `${t("email.ref")}: ${ref}`,
        ...(input.page ? [`${t("admin.page")}: ${input.page}`] : []),
        "",
        input.message,
        "",
        t("email.admin.reply"),
      ].join("\n"),
      url: publicUrl(webPathFor(`/app/admin/support#${req.id}`)),
    });
  });
  const receipt = (async () => {
    const t = await getTranslatorFor(input.locale, "support");
    await sendEmail({
      to: input.email,
      subject: t("email.copy.subject", { ref }),
      text: [
        t("email.copy.greeting", { name: input.name }),
        "",
        t("email.copy.intro"),
        "",
        `${t("email.ref")}: ${ref}`,
        `${t("form.type")}: ${t(`types.${input.type}.label`)} › ${t(`types.${input.type}.topics.${input.topic}`)}`,
        `${t("form.subject")}: ${input.subject}`,
        "",
        input.message,
      ].join("\n"),
    });
  })();
  const results = await Promise.allSettled([...sends, receipt]);
  for (const r of results)
    if (r.status === "rejected")
      console.error("[support] email failed", r.reason);
  return { id: req.id, ref };
}
