import type {
  EmailChangeRequest,
  EmailChangeState,
  SettingsResult,
  SignInMethodRow,
} from "@contract/account";
import {
  deactivateSelfAction,
  deleteAccountAction,
  emailChangeAction,
  removeSignInMethodAction,
} from "@/server/app/actions/settings";
import {
  canRemoveSignInMethod,
  OAUTH_PROVIDERS,
  signInMethods,
} from "@/server/lib/account";
import { db } from "@/server/lib/db";
import { bearerToken, hashMobileToken } from "@/server/lib/mobile/tokens";
import type { CurrentUser } from "@/server/lib/session";
import { ssoReady } from "@/server/lib/sso";

/**
 * 設定 in the app: sign-in methods, email, deactivating and deleting the
 * account — through the website's own settings actions
 * (src/server/app/actions/settings.ts), so every rule, audit entry and
 * notice is the same. Their messages are already in the member's language.
 */

function form(values: Record<string, string | undefined>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) if (v !== undefined) f.set(k, v);
  return f;
}

/** ログイン方法, as the settings page lists them. */
export async function signInMethodRows(
  user: CurrentUser,
): Promise<SignInMethodRow[]> {
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
  return [
    {
      method: "email",
      linked: methods.includes("email"),
      removable: false,
      ready: true,
      addable: false,
    },
    // The app signs in and links with LINE only; Google shows just for
    // members who linked it on the old website (so they can remove it).
    ...OAUTH_PROVIDERS.filter((p) => p === "line" || methods.includes(p)).map(
      (p) => ({
        method: p,
        ready: ssoReady(p),
        linked: methods.includes(p),
        removable: canRemoveSignInMethod(methods, p),
        addable: p === "line" && ssoReady(p),
      }),
    ),
  ];
}

export async function removeSignInMethod(
  provider: "google" | "line",
): Promise<SettingsResult> {
  return removeSignInMethodAction({}, form({ provider }));
}

/** The website's email-change form, one step per request. */
export async function changeEmail(
  req: EmailChangeRequest,
): Promise<EmailChangeState> {
  const prev = { step: "code" as const, email: req.email };
  const state = await emailChangeAction(
    req.intent === "send" ? { step: "email" } : prev,
    form({ intent: req.intent, email: req.email, code: req.code }),
  );
  return { ...state, step: state.step ?? "email" };
}

/** End this device's app session (the website signs the browser out). */
async function signOutThisDevice(request: Request): Promise<void> {
  const token = bearerToken(request.headers.get("authorization"));
  if (token)
    await db.mobileSession.deleteMany({
      where: { tokenHash: hashMobileToken(token) },
    });
}

export async function deactivate(request: Request): Promise<SettingsResult> {
  const result = await deactivateSelfAction({}, form({ confirm: "yes" }));
  if (result.error) return result;
  await signOutThisDevice(request);
  return { ok: true };
}

export async function deleteAccount(
  confirmWord: string,
): Promise<SettingsResult> {
  const result = await deleteAccountAction({}, form({ confirmWord }));
  // The account and its app sessions are gone.
  return result.error ? result : { ok: true };
}
