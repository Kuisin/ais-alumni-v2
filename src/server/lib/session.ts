import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import type { Prisma } from "@/server/generated/prisma/client";
import { AccountState } from "@/server/generated/prisma/enums";
import { redirect } from "@/server/i18n/navigation";
import { getNewsScope, getStaffAccess } from "@/server/lib/broadcasts";
import { db } from "@/server/lib/db";
import { bearerToken, mobileSessionUserId } from "@/server/lib/mobile/tokens";
import {
  NEXT_PATH_HEADER,
  safeNextPath,
  stripLocale,
} from "@/server/lib/next-path";
import type { NewsScope } from "@/server/lib/permissions";
import { homePathFor } from "@/server/lib/state-machine";

export type CurrentUser = Prisma.UserGetPayload<{ include: { roles: true } }>;

/**
 * The signed-in user, loaded fresh from the database once per request.
 * The API only knows the app's bearer tokens (src/server/lib/mobile/
 * tokens.ts); the website's cookie session stays on the website.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = bearerToken((await headers()).get("authorization"));
  const id = token ? await mobileSessionUserId(token) : null;
  if (!id) return null;
  return db.user.findUnique({ where: { id }, include: { roles: true } });
});

async function go(href: string): Promise<never> {
  const locale = await getLocale();
  return redirect({ href, locale });
}

/**
 * Any signed-in user, or redirect to the sign-in page — with ?next= so
 * signing in returns to the page that was asked for.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = safeNextPath((await headers()).get(NEXT_PATH_HEADER));
    return go(next ? `/app?next=${encodeURIComponent(next)}` : "/app");
  }
  await matchMemberLocale(user);
  return user;
}

/**
 * Members see the app in their own language (設定 → 言語), whatever the
 * URL, cookie or device says — e.g. the installed app (PWA) starts at /app
 * with its own cookies and would otherwise follow the phone's language.
 * The redirect also sets the locale cookie for the next launch. Only for
 * approved members: applicants choose their language in the application.
 */
async function matchMemberLocale(user: CurrentUser): Promise<void> {
  if (user.state !== AccountState.ACTIVE) return;
  if ((await getLocale()) === user.locale) return;
  const path = (await headers()).get(NEXT_PATH_HEADER);
  if (!path) return; // not a page request (e.g. a server action)
  redirect({ href: stripLocale(path), locale: user.locale });
}

/**
 * Signed-in user in one of the given states; others are sent to the screen
 * for their state. Use in onboarding pages.
 */
export async function requireState(
  ...states: AccountState[]
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!states.includes(user.state)) return go(homePathFor(user));
  return user;
}

/** ACTIVE members only (§3.3). */
export async function requireActive(): Promise<CurrentUser> {
  return requireState(AccountState.ACTIVE);
}

/** ACTIVE admins only (§3.2). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireActive();
  if (!user.isAdmin) return go("/app/dashboard");
  return user;
}

/** ACTIVE members with any admin-mode access (admin or a position). */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireActive();
  const a = await getStaffAccess(user);
  if (!(a.admin || a.broadcast || a.teachers || a.news))
    return go("/app/dashboard");
  return user;
}

/** Admins and 教職員登録担当 (TEACHER_REGISTRAR). */
export async function requireTeacherRegistrar(): Promise<CurrentUser> {
  const user = await requireActive();
  if (!(await getStaffAccess(user)).teachers) return go("/app/admin");
  return user;
}

/** Members who may post ニュース: admins, current teachers and 学年代表. */
export async function requireNewsAuthor(): Promise<{
  user: CurrentUser;
  scope: NewsScope;
}> {
  const user = await requireActive();
  const scope = await getNewsScope(user);
  if (!scope) return go("/app/news");
  return { user, scope };
}

/**
 * Server-action guards: same checks, but throw instead of redirecting so
 * actions return an error to the caller.
 */
export class AuthError extends Error {}

export async function actionUser(
  ...states: AccountState[]
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("unauthenticated");
  if (states.length && !states.includes(user.state))
    throw new AuthError("forbidden");
  return user;
}

export async function actionActive(): Promise<CurrentUser> {
  return actionUser(AccountState.ACTIVE);
}

export async function actionAdmin(): Promise<CurrentUser> {
  const user = await actionActive();
  if (!user.isAdmin) throw new AuthError("forbidden");
  return user;
}

export async function actionTeacherRegistrar(): Promise<CurrentUser> {
  const user = await actionActive();
  if (!(await getStaffAccess(user)).teachers) throw new AuthError("forbidden");
  return user;
}

export async function actionNewsAuthor(): Promise<{
  user: CurrentUser;
  scope: NewsScope;
}> {
  const user = await actionActive();
  const scope = await getNewsScope(user);
  if (!scope) throw new AuthError("forbidden");
  return { user, scope };
}
