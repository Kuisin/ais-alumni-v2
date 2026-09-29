import type {
  SupportDefaults,
  SupportFieldErrors,
  SupportSent,
} from "@contract/onboarding";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ApiError, publicRoute, readJson } from "@/server/lib/mobile/http";
import { getCurrentUser } from "@/server/lib/session";
import {
  isSupportTopic,
  SUPPORT_LIMITS,
  SUPPORT_TYPES,
} from "@/server/lib/support";
import {
  createSupportRequest,
  supportRateLimited,
} from "@/server/lib/support-db";

/**
 * お問い合わせ (the website's /support and its submitSupportAction). Public
 * — people who can't sign in need it most; with the app's session, the
 * member's name and email are filled in and the request is theirs.
 */
export const GET = publicRoute(async () => {
  const user = await getCurrentUser();
  const locale = await getLocale();
  return {
    name:
      (locale === "ja"
        ? (user?.nameKanji ?? user?.nameRomaji)
        : (user?.nameRomaji ?? user?.nameKanji)) ?? "",
    email: user?.primaryEmail ?? "",
  } satisfies SupportDefaults;
});

const str = z
  .string()
  .max(20_000)
  .catch("")
  .transform((v) => v.trim());
const Body = z.object({
  name: str,
  email: str,
  type: str,
  topic: str,
  subject: str,
  message: str,
  page: str.optional(),
  /** honeypot, as the website's form has */
  website: str.optional(),
});

/**
 * Send it: `{ ref }`, or 400 `{ error: "check", fieldErrors }` /
 * `{ error: "rate_limited", message }` with the website's texts.
 */
export const POST = publicRoute(async (request) => {
  const t = await getTranslations("support");
  const locale = (await getLocale()) === "en" ? "en" : "ja";
  const body = await readJson(request, Body);
  if (body.website) return { ref: "—" } satisfies SupportSent;

  const me = await getCurrentUser();
  const input = {
    name: body.name,
    email: body.email.toLowerCase(),
    type: body.type,
    topic: body.topic,
    subject: body.subject,
    message: body.message,
  };
  const fieldErrors: SupportFieldErrors = {};
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
    throw new ApiError(400, "check", {
      message: t("errors.check"),
      fieldErrors,
    });

  if (await supportRateLimited(input.email, me?.id ?? null))
    throw new ApiError(429, "rate_limited", {
      message: t("errors.rateLimited"),
    });

  const rawPage = body.page ?? "";
  const page =
    rawPage.startsWith("/") && rawPage.length <= 200 ? rawPage : null;
  const { ref } = await createSupportRequest({
    ...input,
    page,
    userId: me?.id ?? null,
    locale,
  });
  return { ref } satisfies SupportSent;
});
