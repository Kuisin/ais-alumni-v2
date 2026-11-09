import type { AdminSanction, AdminSanctions } from "@contract/admin-members";
import type { MySanction } from "@contract/core";
import { cache } from "react";
import type { Sanction } from "@/server/generated/prisma/client";
import {
  BannedIdentityKind,
  SanctionLevel,
} from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { audit } from "@/server/lib/audit";
import { normalizeEmail } from "@/server/lib/auth/otp";
import { db } from "@/server/lib/db";
import { displayName, formatDate } from "@/server/lib/format";
import { ApiError, notFound } from "@/server/lib/mobile/http";
import { NOTIFY_USER_SELECT, notify } from "@/server/lib/notify";
import type { CurrentUser } from "@/server/lib/session";

/**
 * 処分 (sanctions): what the committee decides about a member's conduct.
 *
 *  - WARNING: no limits; the member sees it until they acknowledge it.
 *  - RESTRICTED: read-only — the routes in RESTRICTED_WRITES answer 403
 *    "restricted" (mobileRoute, src/server/lib/mobile/http.ts).
 *  - SUSPENDED: until `endsAt` (or until lifted), every route answers 403
 *    "suspended" except SUSPENDED_ALLOWED (the account, its data export
 *    and deletion); public routes (お問い合わせ, sign-out) are unaffected.
 *  - BANNED: as SUSPENDED, for good (403 "banned"), and the member's
 *    sign-in identities go into BannedIdentity: no new account is created
 *    for them (refuseBannedIdentity, in every sign-in that creates one).
 *
 * A sanction is in force while not lifted and `endsAt` is null or still
 * ahead — it ends by itself, no job needed. One at a time per member:
 * applying a new one lifts the one in force. Admins only; every change is
 * in 操作ログ (`member.sanctioned` / `member.sanction_lifted`).
 */

const USER = { type: "User" } as const;
/** WARNING and BANNED never end by date. */
const DATED: readonly SanctionLevel[] = [
  SanctionLevel.RESTRICTED,
  SanctionLevel.SUSPENDED,
];

const inForce = (now: Date) => ({
  liftedAt: null,
  OR: [{ endsAt: null }, { endsAt: { gt: now } }],
});

/** The member's sanction in force now, if any (newest). */
export async function activeSanction(
  userId: string,
  now: Date = new Date(),
): Promise<Sanction | null> {
  return db.sanction.findFirst({
    where: { userId, ...inForce(now) },
    orderBy: { createdAt: "desc" },
  });
}

/** activeSanction, loaded once per request (mobileRoute and /me share it). */
export const requestSanction = cache(
  (userId: string): Promise<Sanction | null> => activeSanction(userId),
);

/** What /me shows the member (WARNING only until acknowledged). */
export function mySanction(s: Sanction | null): MySanction | null {
  if (!s) return null;
  if (s.level === SanctionLevel.WARNING && s.acknowledgedAt) return null;
  return {
    id: s.id,
    level: s.level,
    reason: s.reason,
    endsAt: s.endsAt?.toISOString() ?? null,
    acknowledged: Boolean(s.acknowledgedAt),
  };
}

// ---- Enforcement (mobileRoute) ----

/**
 * RESTRICTED (投稿制限): writes that publish something to other members or
 * reach out to them. Only these methods are refused; reading, settings,
 * own profile requests, notifications, RSVPs, poll votes, confirmations,
 * reports, unfollowing / blocking, accepting follow requests, support,
 * export and deletion keep working.
 */
export const RESTRICTED_WRITES: readonly [
  pattern: string,
  methods: string[],
][] = [
  // チャット: starting a 1:1 talk, sending, reacting
  ["chat/direct", ["POST"]],
  ["chat/[id]/messages", ["POST"]],
  ["chat/[id]/messages/[messageId]/reactions", ["POST"]],
  // ニュース: comments and reactions
  ["news/[id]/comments", ["POST"]],
  ["news/[id]/reactions", ["POST"]],
  // 投稿 (news / events): writing, uploading, choosing the audience
  ["compose/news", ["POST"]],
  ["compose/events", ["POST"]],
  ["compose/files", ["POST"]],
  ["compose/audience", ["POST"]],
  // staff sending to members: お知らせ, a post's notification, LINE
  ["admin/notify", ["POST"]],
  ["admin/notify/[id]", ["PATCH"]],
  ["admin/news/[id]/notify", ["POST"]],
  ["admin/line/announce", ["POST"]],
  // フォロー: new follow requests (unfollowing is DELETE: allowed)
  ["members/[id]/follow", ["POST"]],
  // 招待 and 在籍確認 (vouching for an applicant)
  ["invites", ["POST"]],
  ["vouch/[id]", ["POST"]],
  // what other members see on the profile: 自己紹介 and the photo
  ["profile/about", ["PUT"]],
  ["profile/photo", ["POST"]],
];

/** SUSPENDED / BANNED: the signed-in routes that still work. */
export const SUSPENDED_ALLOWED: readonly string[] = [
  "me",
  "me/sanction/ack",
  "me/export",
  "settings/delete",
  // registering / removing this device's push token, so the member hears
  // when it ends (and sign-out can unregister)
  "push",
  // the read receipt of a tapped notification (the sanction's own)
  "notifications/open",
];

/** "/api/mobile/v1/chat/abc/messages" → matches "chat/[id]/messages". */
function matches(pattern: string, segments: string[]): boolean {
  const parts = pattern.split("/");
  if (parts.length !== segments.length) return false;
  return parts.every(
    (p, i) => (p.startsWith("[") && p.endsWith("]")) || p === segments[i],
  );
}

function routeSegments(request: Request): string[] {
  const { pathname } = new URL(request.url);
  const i = pathname.indexOf("/api/mobile/v1/");
  const rest = i < 0 ? "" : pathname.slice(i + "/api/mobile/v1/".length);
  return rest.replace(/\/+$/, "").split("/");
}

/**
 * Refuse what the member's sanction doesn't allow (403 "suspended" /
 * "banned" / "restricted", with the sanction for the app to show).
 */
export async function enforceSanction(
  request: Request,
  userId: string,
): Promise<void> {
  const s = await requestSanction(userId);
  if (!s || s.level === SanctionLevel.WARNING) return;
  const segments = routeSegments(request);
  const extra = { sanction: mySanction(s) };
  if (s.level === SanctionLevel.SUSPENDED || s.level === SanctionLevel.BANNED) {
    if (SUSPENDED_ALLOWED.some((p) => matches(p, segments))) return;
    throw new ApiError(
      403,
      s.level === SanctionLevel.BANNED ? "banned" : "suspended",
      extra,
    );
  }
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return;
  if (
    RESTRICTED_WRITES.some(
      ([p, methods]) => methods.includes(method) && matches(p, segments),
    )
  )
    throw new ApiError(403, "restricted", extra);
}

// ---- Banned identities (sign-in) ----

export async function isBannedIdentity(
  kind: BannedIdentityKind,
  value: string,
): Promise<boolean> {
  const row = await db.bannedIdentity.findUnique({
    where: { kind_value: { kind, value } },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * Before creating an account: 403 "banned" when any of these identities
 * belonged to a banned member. Existing accounts still sign in (and see
 * only their sanction).
 */
export async function refuseBannedIdentity(ids: {
  email?: string | null;
  line?: string | null;
  apple?: string | null;
}): Promise<void> {
  const checks: [BannedIdentityKind, string][] = [];
  if (ids.email)
    checks.push([BannedIdentityKind.EMAIL, normalizeEmail(ids.email)]);
  if (ids.line) checks.push([BannedIdentityKind.LINE, ids.line]);
  if (ids.apple) checks.push([BannedIdentityKind.APPLE, ids.apple]);
  if (!checks.length) return;
  const found = await db.bannedIdentity.findFirst({
    where: { OR: checks.map(([kind, value]) => ({ kind, value })) },
    select: { id: true },
  });
  if (found) throw new ApiError(403, "banned");
}

/** The member's email, LINE and Apple identities, for BannedIdentity. */
async function identitiesOf(
  userId: string,
): Promise<{ kind: BannedIdentityKind; value: string }[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      primaryEmail: true,
      lineUserId: true,
      accounts: {
        where: { provider: { in: ["line", "apple"] } },
        select: { provider: true, providerAccountId: true },
      },
    },
  });
  if (!user) return [];
  const out: { kind: BannedIdentityKind; value: string }[] = [];
  if (user.primaryEmail)
    out.push({
      kind: BannedIdentityKind.EMAIL,
      value: normalizeEmail(user.primaryEmail),
    });
  if (user.lineUserId)
    out.push({ kind: BannedIdentityKind.LINE, value: user.lineUserId });
  for (const a of user.accounts)
    out.push({
      kind:
        a.provider === "apple"
          ? BannedIdentityKind.APPLE
          : BannedIdentityKind.LINE,
      value: a.providerAccountId,
    });
  return out;
}

// ---- Admin: apply / lift ----

export type ApplyInput = {
  level: SanctionLevel;
  reason: string;
  endsAt: Date | null;
};

/** Apply a sanction (lifting the one in force), record and notify. */
export async function applySanction(
  admin: CurrentUser,
  userId: string,
  input: ApplyInput,
): Promise<Sanction> {
  if (userId === admin.id) throw new ApiError(400, "not_self");
  const target = await db.user.findUnique({
    where: { id: userId },
    select: NOTIFY_USER_SELECT,
  });
  if (!target) throw notFound();
  const now = new Date();
  const endsAt = DATED.includes(input.level) ? input.endsAt : null;
  if (endsAt && endsAt <= now) throw new ApiError(400, "invalid");
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(400, "invalid");

  const identities =
    input.level === SanctionLevel.BANNED ? await identitiesOf(userId) : [];
  const [previous, created] = await db.$transaction(async (tx) => {
    const prev = await tx.sanction.findMany({
      where: { userId, ...inForce(now) },
      select: { id: true, level: true },
    });
    if (prev.length)
      await tx.sanction.updateMany({
        where: { id: { in: prev.map((p) => p.id) } },
        data: { liftedAt: now, liftedById: admin.id },
      });
    // A ban replaced by something milder lets them register again.
    if (
      prev.some((p) => p.level === SanctionLevel.BANNED) &&
      input.level !== SanctionLevel.BANNED
    )
      await tx.bannedIdentity.deleteMany({ where: { userId } });
    const s = await tx.sanction.create({
      data: {
        userId,
        level: input.level,
        reason,
        endsAt,
        createdById: admin.id,
      },
    });
    if (identities.length)
      await tx.bannedIdentity.createMany({
        data: identities.map((i) => ({ ...i, userId })),
        skipDuplicates: true,
      });
    return [prev, s] as const;
  });

  await audit(
    admin.id,
    "member.sanctioned",
    { ...USER, id: userId },
    {
      sanctionId: created.id,
      level: created.level,
      reason,
      endsAt: endsAt?.toISOString() ?? null,
      replaced: previous.map((p) => p.id),
      ...(identities.length ? { bannedIdentities: identities.length } : {}),
    },
  );
  await notify(target, {
    kind: "SANCTION_APPLIED",
    refId: created.id,
    path: "/app/dashboard",
    params: async (locale) => {
      const t = await getTranslatorFor(locale, "notifications");
      return {
        level: t(`sanctionLevels.${created.level}`),
        until: endsAt
          ? t("sanctionUntil", { date: formatDate(endsAt, locale) })
          : "",
      };
    },
    // The reason: in the email (and in the app), never on LINE.
    note: reason,
  }).catch((e) => console.error("[sanctions] notify failed", e));
  return created;
}

/** Lift a sanction (a lifted ban lets the identities register again). */
export async function liftSanction(
  admin: CurrentUser,
  sanctionId: string,
): Promise<Sanction> {
  const s = await db.sanction.findUnique({ where: { id: sanctionId } });
  if (!s) throw notFound();
  if (s.liftedAt) return s;
  const lifted = await db.$transaction(async (tx) => {
    const row = await tx.sanction.update({
      where: { id: s.id },
      data: { liftedAt: new Date(), liftedById: admin.id },
    });
    if (s.level === SanctionLevel.BANNED)
      await tx.bannedIdentity.deleteMany({ where: { userId: s.userId } });
    return row;
  });
  await audit(
    admin.id,
    "member.sanction_lifted",
    { ...USER, id: s.userId },
    { sanctionId: s.id, level: s.level },
  );
  return lifted;
}

/** The member tapped 「確認しました」 on a warning. */
export async function acknowledgeWarning(userId: string): Promise<void> {
  await db.sanction.updateMany({
    where: {
      userId,
      level: SanctionLevel.WARNING,
      liftedAt: null,
      acknowledgedAt: null,
    },
    data: { acknowledgedAt: new Date() },
  });
}

// ---- Admin: the member page ----

const PERSON = { select: { nameRomaji: true, nameKanji: true } } as const;

/** 処分 on the admin member page: the one in force and the history. */
export async function sanctionsFor(userId: string): Promise<AdminSanctions> {
  const exists = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!exists) throw notFound();
  const now = new Date();
  const rows = await db.sanction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { createdBy: PERSON, liftedBy: PERSON },
  });
  const name = (u: Parameters<typeof displayName>[0] | null) =>
    u ? displayName(u) : null;
  const history: AdminSanction[] = rows.map((r) => ({
    id: r.id,
    level: r.level,
    reason: r.reason,
    endsAt: r.endsAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    createdBy: name(r.createdBy),
    acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
    liftedAt: r.liftedAt?.toISOString() ?? null,
    liftedBy: name(r.liftedBy),
    active: !r.liftedAt && (!r.endsAt || r.endsAt > now),
  }));
  return { current: history.find((h) => h.active) ?? null, history };
}
