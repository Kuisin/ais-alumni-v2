// From the website's server actions; here plain functions the API calls.

import { refresh } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { signIn, signOut } from "@/server/auth";
import {
  AccountState,
  NotifyChannel,
  OtpPurpose,
} from "@/server/generated/prisma/enums";
import { redirect } from "@/server/i18n/navigation";
import { getTranslatorFor } from "@/server/i18n/translator";
import {
  canRemoveSignInMethod,
  deleteUserAccount,
  isOAuthProvider,
  signInMethods,
} from "@/server/lib/account";
import { audit } from "@/server/lib/audit";
import { issueOtp, normalizeEmail, verifyOtp } from "@/server/lib/auth/otp";
import { syncChatMembership } from "@/server/lib/chat-db";
import { db } from "@/server/lib/db";
import { sendEmail } from "@/server/lib/email";
import { syncLineMenuFor } from "@/server/lib/line-menu-sync";
import { NOTIFY_USER_SELECT, notify } from "@/server/lib/notify";
import { OPTIONAL_CATEGORIES } from "@/server/lib/notify/catalog";
import {
  AuthError,
  actionActive,
  type CurrentUser,
} from "@/server/lib/session";
import { ssoReady } from "@/server/lib/sso";
import { assertTransition } from "@/server/lib/state-machine";
import { publicUrl } from "@/server/lib/urls";

/** Result shape for useActionState forms on /settings. Messages are pre-translated. */
export type SettingsFormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  /** email-change flow: which step the form is on */
  step?: "email" | "code";
  email?: string;
};

async function errorText(e: unknown): Promise<string> {
  const t = await getTranslations("common");
  if (e instanceof AuthError) {
    return e.message === "unauthenticated"
      ? t("errors.unauthenticated")
      : t("errors.forbidden");
  }
  console.error("[settings]", e);
  return t("errors.generic");
}

async function guard(): Promise<CurrentUser> {
  return actionActive();
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

const localeSchema = z.object({ locale: z.enum(["ja", "en"]) });

export async function updateLanguageAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  let locale: "ja" | "en";
  try {
    const user = await guard();
    const parsed = localeSchema.safeParse({ locale: formData.get("locale") });
    if (!parsed.success)
      return { error: (await getTranslations("common"))("errors.validation") };
    locale = parsed.data.locale;
    if (user.locale !== locale) {
      await db.user.update({ where: { id: user.id }, data: { locale } });
      // LINE menu in the new language.
      await syncLineMenuFor({ id: user.id });
    }
  } catch (e) {
    return { error: await errorText(e) };
  }
  // Navigate to the same page in the new locale (outside try: redirect throws).
  redirect({ href: "/app/settings?saved=language", locale });
  return {};
}

// ---------------------------------------------------------------------------
// Notification channel (§11)
// ---------------------------------------------------------------------------

const notifySchema = z.object({
  notifyVia: z.enum([NotifyChannel.AUTO, NotifyChannel.EMAIL_ONLY]),
});

export async function updateNotifyViaAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  try {
    const user = await guard();
    const parsed = notifySchema.safeParse({
      notifyVia: formData.get("notifyVia"),
    });
    if (!parsed.success)
      return { error: (await getTranslations("common"))("errors.validation") };
    await db.user.update({
      where: { id: user.id },
      data: { notifyVia: parsed.data.notifyVia },
    });
    refresh();
    return { ok: true, message: (await getTranslations("common"))("saved") };
  } catch (e) {
    return { error: await errorText(e) };
  }
}

/** Which notification categories to receive (account ones always come). */
export async function updateNotifyCategoriesAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  try {
    const user = await guard();
    const on = new Set(formData.getAll("on").map(String));
    const off = OPTIONAL_CATEGORIES.filter((c) => !on.has(c));
    await db.user.update({
      where: { id: user.id },
      data: { notifyOff: off },
    });
    refresh();
    return { ok: true, message: (await getTranslations("common"))("saved") };
  } catch (e) {
    return { error: await errorText(e) };
  }
}

// ---------------------------------------------------------------------------
// Sign-in methods (§4.3)
// ---------------------------------------------------------------------------

/**
 * Start Google OAuth while signed in: Auth.js links the Google account to the
 * current user and returns here.
 */
export async function linkGoogleAction(): Promise<void> {
  await guard();
  if (!ssoReady("google")) return;
  const locale = await getLocale();
  await signIn("google", {
    redirectTo: `/${locale}/app/settings?google=linked`,
  });
}

const removeSchema = z.object({ provider: z.enum(["google", "line"]) });

export async function removeSignInMethodAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const t = await getTranslations("settings");
  try {
    const user = await guard();
    const parsed = removeSchema.safeParse({
      provider: formData.get("provider"),
    });
    if (!parsed.success || !isOAuthProvider(parsed.data.provider)) {
      return { error: (await getTranslations("common"))("errors.validation") };
    }
    const provider = parsed.data.provider;
    const accounts = await db.account.findMany({
      where: { userId: user.id },
      select: { provider: true },
    });
    const methods = signInMethods({
      primaryEmail: user.primaryEmail,
      emailVerifiedAt: user.emailVerifiedAt,
      // LINE counts as linked if either an Account row or lineUserId exists.
      providers: [
        ...accounts.map((a) => a.provider),
        ...(user.lineUserId ? ["line"] : []),
      ],
    });
    if (!canRemoveSignInMethod(methods, provider))
      return { error: t("methods.cannotRemoveLast") };

    await db.$transaction(async (tx) => {
      await tx.account.deleteMany({ where: { userId: user.id, provider } });
      if (provider === "line") {
        await tx.user.update({
          where: { id: user.id },
          data: {
            lineUserId: null,
            lineFollowing: false,
            lineDisplayName: null,
          },
        });
      }
    });
    await audit(
      user.id,
      "self.signin_method_removed",
      { type: "User", id: user.id },
      { provider },
    );

    const fresh = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: NOTIFY_USER_SELECT,
    });
    await notify(fresh, {
      kind: "SECURITY_METHOD_REMOVED",
      path: "/app/settings",
      params: async (locale) => {
        const tr = await getTranslatorFor(locale, "settings");
        return { method: tr(`methods.${provider}`) };
      },
    }).catch((e) => console.error("[settings] notify failed", e));

    refresh();
    return { ok: true, message: t("methods.removed") };
  } catch (e) {
    return { error: await errorText(e) };
  }
}

// ---------------------------------------------------------------------------
// Primary email change (§4.3)
// ---------------------------------------------------------------------------

const emailSchema = z.object({ email: z.email().max(254) });
const codeSchema = z.object({
  email: z.email().max(254),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

async function emailTakenByOther(
  email: string,
  userId: string,
): Promise<boolean> {
  const other = await db.user.findUnique({
    where: { primaryEmail: email },
    select: { id: true },
  });
  return Boolean(other && other.id !== userId);
}

export async function emailChangeAction(
  prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const intent = formData.get("intent");
  try {
    const user = await guard();

    if (intent === "restart") return { step: "email" };

    if (intent === "send" || intent === "resend") {
      const parsed = emailSchema.safeParse({
        email: intent === "resend" ? prev.email : formData.get("email"),
      });
      if (!parsed.success)
        return { step: "email", error: t("email.errors.invalid") };
      const email = normalizeEmail(parsed.data.email);
      if (email === user.primaryEmail)
        return { step: "email", email, error: t("email.errors.same") };
      if (await emailTakenByOther(email, user.id)) {
        return { step: "email", email, error: t("email.errors.taken") };
      }
      const res = await issueOtp({
        email,
        purpose: OtpPurpose.CHANGE_EMAIL,
        locale: user.locale,
        userId: user.id,
      });
      if (!res.ok)
        return {
          step: intent === "resend" ? "code" : "email",
          email,
          error:
            res.error === "send_failed"
              ? tc("errors.emailSendFailed")
              : tc("errors.rateLimited"),
        };
      return { step: "code", email, message: t("email.codeSent", { email }) };
    }

    if (intent === "verify") {
      const parsed = codeSchema.safeParse({
        email: prev.email,
        code: formData.get("code"),
      });
      if (!parsed.success)
        return { ...prev, step: "code", error: t("email.errors.invalidCode") };
      const email = normalizeEmail(parsed.data.email);
      const result = await verifyOtp({
        email,
        purpose: OtpPurpose.CHANGE_EMAIL,
        code: parsed.data.code,
        userId: user.id,
      });
      if (!result.ok) {
        const key =
          result.error === "expired"
            ? "expired"
            : result.error === "too_many_attempts"
              ? "tooMany"
              : "invalidCode";
        return { step: "code", email, error: t(`email.errors.${key}`) };
      }
      // Re-check after the code: someone may have taken the address meanwhile.
      if (await emailTakenByOther(email, user.id))
        return { step: "email", error: t("email.errors.taken") };

      const oldEmail = user.primaryEmail;
      try {
        await db.user.update({
          where: { id: user.id },
          data: { primaryEmail: email, emailVerifiedAt: new Date() },
        });
      } catch {
        // Unique constraint race.
        return { step: "email", error: t("email.errors.taken") };
      }
      await audit(
        user.id,
        "self.email_changed",
        { type: "User", id: user.id },
        { from: oldEmail, to: email },
      );

      const tr = await getTranslatorFor(user.locale, "settings");
      const settingsUrl = publicUrl(`/${user.locale}/app/settings`);
      const sends: Promise<void>[] = [
        sendEmail({
          to: email,
          subject: tr("notify.emailChangedNew.subject"),
          text: tr("notify.emailChangedNew.text", { email }),
          url: settingsUrl,
        }),
      ];
      if (oldEmail) {
        sends.push(
          sendEmail({
            to: oldEmail,
            subject: tr("notify.emailChangedOld.subject"),
            text: tr("notify.emailChangedOld.text", {
              email: maskEmail(email),
            }),
          }),
        );
      }
      const results = await Promise.allSettled(sends);
      for (const r of results)
        if (r.status === "rejected")
          console.error("[settings] email notice failed", r.reason);

      refresh();
      return {
        ok: true,
        step: "email",
        message: t("email.changed", { email }),
      };
    }

    return { ...prev, error: tc("errors.validation") };
  } catch (e) {
    return { ...prev, error: await errorText(e) };
  }
}

/** a***@example.com — the old address is told *that* it changed, not the full new address. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

// ---------------------------------------------------------------------------
// Deactivate (self)
// ---------------------------------------------------------------------------

export async function deactivateSelfAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  let locale: string;
  try {
    const user = await guard();
    if (formData.get("confirm") !== "yes") {
      return { error: (await getTranslations("common"))("errors.validation") };
    }
    assertTransition(user.state, AccountState.DEACTIVATED);
    await db.user.update({
      where: { id: user.id },
      data: { state: AccountState.DEACTIVATED, deactivatedAt: new Date() },
    });
    await syncChatMembership(user.id).catch((e) =>
      console.error("[settings] chat sync failed", e),
    );
    await audit(user.id, "self.deactivated", { type: "User", id: user.id });
    await notify(user, {
      kind: "ACCOUNT_DEACTIVATED_SELF",
      path: null,
    }).catch((e) => console.error("[settings] notify failed", e));
    locale = await getLocale();
  } catch (e) {
    return { error: await errorText(e) };
  }
  await signOut({ redirectTo: `/${locale}` });
  return {};
}

// ---------------------------------------------------------------------------
// Delete account (APPI)
// ---------------------------------------------------------------------------

export async function deleteAccountAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const t = await getTranslations("settings");
  let locale: string;
  try {
    const user = await guard();
    const word = String(formData.get("confirmWord") ?? "").trim();
    // Accept the confirmation word of either UI language.
    const [ja, en] = await Promise.all([
      getTranslatorFor("ja", "settings"),
      getTranslatorFor("en", "settings"),
    ]);
    const accepted = [ja("delete.confirmWord"), en("delete.confirmWord")].map(
      (w) => w.toLowerCase(),
    );
    if (!accepted.includes(word.toLowerCase()))
      return { error: t("delete.wordMismatch") };

    const email = user.primaryEmail;
    const userLocale = user.locale;
    const result = await deleteUserAccount(user.id);
    if (!result.ok) {
      return {
        error:
          result.error === "sole_admin_content"
            ? t("delete.soleAdminContent")
            : t("delete.failed"),
      };
    }
    // The account row is gone, so there is no actor to reference; log anonymously.
    await audit(
      null,
      "self.account_deleted",
      { type: "User", id: user.id },
      {
        filesDeleted: result.filesDeleted,
        filesFailed: result.filesFailed,
      },
    );
    if (email) {
      const tr = await getTranslatorFor(userLocale, "settings");
      await sendEmail({
        to: email,
        subject: tr("notify.deleted.subject"),
        text: tr("notify.deleted.text"),
      }).catch((e) => console.error("[settings] deletion email failed", e));
    }
    locale = await getLocale();
  } catch (e) {
    return { error: await errorText(e) };
  }
  await signOut({ redirectTo: `/${locale}` });
  return {};
}
