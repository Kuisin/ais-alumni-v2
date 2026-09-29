// From the website's server actions; here plain functions the API calls.

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import { actionAdmin, getCurrentUser } from "@/server/lib/session";
import {
  isSupportTopic,
  SUPPORT_LIMITS,
  SUPPORT_TYPES,
} from "@/server/lib/support";
import {
  createSupportRequest,
  supportRateLimited,
} from "@/server/lib/support-db";

export type SupportFormState = {
  ok?: boolean;
  ref?: string;
  error?: string;
  fieldErrors?: Partial<
    Record<"name" | "email" | "type" | "topic" | "subject" | "message", string>
  >;
};

/** お問い合わせ: members or visitors (e.g. can't sign in). */
export async function submitSupportAction(
  _prev: SupportFormState,
  fd: FormData,
): Promise<SupportFormState> {
  const t = await getTranslations("support");
  const locale = (await getLocale()) === "en" ? "en" : "ja";
  // Honeypot: people never see this field.
  if (String(fd.get("website") ?? "").trim()) return { ok: true, ref: "—" };

  const me = await getCurrentUser();
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const input = {
    name: str("name"),
    email: str("email").toLowerCase(),
    type: str("type"),
    topic: str("topic"),
    subject: str("subject"),
    message: str("message"),
  };
  const fieldErrors: SupportFormState["fieldErrors"] = {};
  if (!input.name || input.name.length > SUPPORT_LIMITS.name)
    fieldErrors.name = t("errors.name");
  if (
    !z.email().safeParse(input.email).success ||
    input.email.length > SUPPORT_LIMITS.email
  )
    fieldErrors.email = t("errors.email");
  if (!isSupportTopic(input.type, input.topic)) {
    if (!(input.type in SUPPORT_TYPES)) fieldErrors.type = t("errors.type");
    else fieldErrors.topic = t("errors.topic");
  }
  if (!input.subject || input.subject.length > SUPPORT_LIMITS.subject)
    fieldErrors.subject = t("errors.subject");
  if (input.message.length < 5 || input.message.length > SUPPORT_LIMITS.message)
    fieldErrors.message = t("errors.message");
  if (Object.keys(fieldErrors).length)
    return { error: t("errors.check"), fieldErrors };

  if (await supportRateLimited(input.email, me?.id ?? null))
    return { error: t("errors.rateLimited") };

  const rawPage = str("page");
  const page =
    rawPage.startsWith("/") && rawPage.length <= 200 ? rawPage : null;
  const { ref } = await createSupportRequest({
    ...input,
    page,
    userId: me?.id ?? null,
    locale,
  });
  revalidatePath("/[locale]/app/admin/support", "page");
  return { ok: true, ref };
}

/** Admin: mark a request done, or open it again. */
export async function setSupportClosedAction(fd: FormData): Promise<void> {
  const me = await actionAdmin();
  const id = z.string().min(1).max(64).parse(fd.get("id"));
  const close = fd.get("close") === "1";
  const req = await db.supportRequest.update({
    where: { id },
    data: close
      ? { closedAt: new Date(), closedById: me.id }
      : { closedAt: null, closedById: null },
    select: { id: true },
  });
  await audit(me.id, close ? "support.close" : "support.reopen", {
    type: "SupportRequest",
    id: req.id,
  });
  revalidatePath("/[locale]/app/admin/support", "page");
}
