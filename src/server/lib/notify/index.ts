import type { Locale } from "@/server/generated/prisma/enums";

import { db } from "@/server/lib/db";
import { sendEmail } from "@/server/lib/email";
import { linePush } from "@/server/lib/line";
import { badgeCountsFor } from "@/server/lib/push/badges";
import { type PushTarget, pushTargetsFor } from "@/server/lib/push/devices";
import { type PushOptions, pushMessageFor } from "@/server/lib/push/message";
import { deliverPushes } from "@/server/lib/push/send";
import { NOTIFY_KINDS, type NotifyKind, wantsKind } from "./catalog";
import { renderEmail } from "./email-template";
import {
  createNotificationLink,
  ensureLinkCode,
  findOrCreateNotificationLink,
  linkUrl,
  recipientUrl,
} from "./links";
import {
  lineText,
  type NotifyParams,
  type RenderedNotification,
  renderNotification,
} from "./render";
import {
  afterPushFailed,
  type Channel,
  channelsFor,
  deliverWithFallback,
  type RoutableUser,
  type RouteOptions,
} from "./route";

const LOCALES: Locale[] = ["ja", "en"];

export { NOTIFY_KINDS, type NotifyKind } from "./catalog";
export { channelsFor, chooseChannel } from "./route";

export type NotifyUser = RoutableUser & {
  id: string;
  locale: Locale;
  /** categories turned off (Settings → Notifications) */
  notifyOff?: string[];
  nameRomaji?: string | null;
  nameKanji?: string | null;
  /** short code for their notification links (created on first send) */
  linkCode?: string | null;
};

export type Notification = {
  kind: NotifyKind;
  refId?: string;
  /** Skip users who already have a log row for (kind, refId). */
  dedupe?: boolean;
  /** App page without the locale ("/app/news/x"); null = no link. */
  path: string | null;
  /** Template values; a function when they depend on the language. */
  params?:
    | NotifyParams
    | ((locale: Locale) => NotifyParams | Promise<NotifyParams>);
  /** Committee note etc. — email only, never on LINE or in the app. */
  note?: string | null;
  /**
   * Only to members who get notifications in the app, and only there
   * (immediate chat pushes; the chat-unread job covers everyone else).
   */
  pushOnly?: boolean;
  /**
   * false: no short link or read receipts (chat pushes — a link per
   * message would be noise); the app still opens `path`.
   */
  link?: boolean;
  /** App push extras (grouping, replacing, lifetime). */
  push?: PushOptions;
};

async function alreadySent(
  userIds: string[],
  n: Notification,
): Promise<Set<string>> {
  if (!n.dedupe) return new Set();
  const rows = await db.notificationLog.findMany({
    where: { userId: { in: userIds }, kind: n.kind, refId: n.refId ?? null },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/** Send one notification to one user via the routed channel(s). */
export async function notify(
  user: NotifyUser,
  n: Notification,
): Promise<Channel[]> {
  return (await notifyMany([user], n)).get(user.id) ?? [];
}

/** Run `fn` over `items`, at most `limit` at a time. */
async function inBatches<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn));
  }
}

/**
 * Send one notification to many users (src/lib/notify/catalog.ts rules):
 * members who turned the category off are skipped; texts are rendered once
 * per language with one short link for everyone, and every recipient gets
 * their own URL (/n/<their code>/<token>) so their open is recorded as a
 * read receipt. Members who turned on notifications in the app get an
 * app push instead (src/lib/push; email too for `alwaysEmail` kinds and
 * committee notes); if it reaches none of their devices, they get LINE /
 * email as usual. LINE pushes go one per member (the push quota counts
 * recipients either way). Failures are logged, not thrown; recurring tasks
 * use notifyBatch to retry them.
 */
export async function notifyMany(
  users: NotifyUser[],
  n: Notification,
): Promise<Map<string, Channel[]>> {
  return (await notifyBatch(users, n)).sent;
}

export type NotifyBatchResult = {
  /** channels each user was reached on ([] = nothing to send them) */
  sent: Map<string, Channel[]>;
  /** users no channel could reach (every attempt failed) */
  failed: string[];
  /** users not tried because the deadline passed */
  remaining: string[];
};

/** Deliveries sent together; each chunk is logged as soon as it's done. */
const CHUNK = 16;

/**
 * notifyMany for recurring tasks: stops starting new chunks after `deadline`
 * (ms timestamp) and reports who failed or is left. With dedupe, calling
 * again with the same users sends only to those not yet logged, so a failed,
 * paused or killed send can simply be run again: every delivery is logged
 * right after its chunk, and the short link is shared across calls.
 */
export async function notifyBatch(
  users: NotifyUser[],
  n: Notification,
  opts: { deadline?: number } = {},
): Promise<NotifyBatchResult> {
  const skip = await alreadySent(
    users.map((u) => u.id),
    n,
  );
  const result: NotifyBatchResult = {
    sent: new Map(),
    failed: [],
    remaining: [],
  };
  const spec = NOTIFY_KINDS[n.kind];
  const route: RouteOptions = {
    line: "line" in spec,
    alwaysEmail: "alwaysEmail" in spec || Boolean(n.note),
    pushOnly: n.pushOnly,
  };
  const wanted = users.filter(
    (u) => !skip.has(u.id) && wantsKind(u.notifyOff, n.kind),
  );
  // App devices of everyone this could go to (members with none are absent).
  const devices = await pushTargetsFor(wanted.map((u) => u.id)).catch((e) => {
    console.error("[notify] push devices failed", e);
    return new Map<string, PushTarget[]>();
  });
  const recipients: { user: NotifyUser; channels: Channel[] }[] = [];
  for (const u of wanted) {
    const channels = channelsFor(
      { ...u, push: devices.has(u.id) },
      route,
    ).filter((ch) =>
      ch === "PUSH"
        ? true
        : ch === "LINE"
          ? Boolean(u.lineUserId)
          : Boolean(u.primaryEmail),
    );
    if (channels.length) recipients.push({ user: u, channels });
    else result.sent.set(u.id, []);
  }
  if (!recipients.length) return result;

  // Both languages: messages use each member's, and the one link keeps
  // both so its preview follows the opener's current language.
  const rendered = {} as Record<Locale, RenderedNotification>;
  for (const locale of LOCALES) {
    const params =
      typeof n.params === "function" ? await n.params(locale) : n.params;
    rendered[locale] = await renderNotification(n.kind, locale, params);
  }
  const link =
    n.path && n.link !== false
      ? await (n.dedupe
          ? findOrCreateNotificationLink
          : createNotificationLink)({
          kind: n.kind,
          category: spec.category,
          texts: {
            ja: { title: rendered.ja.title, body: rendered.ja.body },
            en: { title: rendered.en.title, body: rendered.en.body },
          },
          refId: n.refId,
          path: n.path,
        })
      : null;

  for (let i = 0; i < recipients.length; i += CHUNK) {
    if (opts.deadline !== undefined && Date.now() > opts.deadline) {
      result.remaining = recipients.slice(i).map((r) => r.user.id);
      break;
    }
    const chunk = recipients.slice(i, i + CHUNK);
    const logs: { userId: string; channel: Channel }[] = [];
    const receipts: { linkId: string; userId: string; channels: Channel[] }[] =
      [];

    // App pushes for the whole chunk in one request.
    const pushUsers = chunk
      .filter((r) => r.channels[0] === "PUSH")
      .map((r) => r.user);
    let pushed = new Set<string>();
    if (pushUsers.length) {
      const badges = await badgeCountsFor(pushUsers.map((u) => u.id)).catch(
        (e) => {
          console.error("[notify] badges failed", e);
          return new Map<string, number>();
        },
      );
      pushed = await deliverPushes(
        pushUsers.map((u) => {
          const text = rendered[u.locale];
          const { to: _to, ...message } = pushMessageFor({
            token: "",
            kind: n.kind,
            category: spec.category,
            emoji: text.emoji,
            title: text.title,
            body: text.body,
            path: n.path,
            receipt: link?.token,
            refId: n.refId,
            badge: badges.get(u.id),
            options: n.push,
          });
          return { userId: u.id, targets: devices.get(u.id) ?? [], message };
        }),
      );
    }

    await inBatches(chunk, 8, async ({ user: u, channels }) => {
      const sent: Channel[] = [];
      let rest = channels;
      if (channels[0] === "PUSH") {
        if (pushed.has(u.id)) {
          sent.push("PUSH");
          rest = channels.slice(1);
        } else {
          rest = afterPushFailed(u, channels, route);
        }
      }
      if (rest.length) {
        const text = rendered[u.locale];
        let url: string | null = null;
        if (link) {
          try {
            url = recipientUrl(link.token, await ensureLinkCode(u));
          } catch (e) {
            // Still deliver, without a read receipt.
            console.error(`[notify] link code for ${u.id} failed`, e);
            url = linkUrl(link.token);
          }
        }
        // A failed LINE push (e.g. the month's allowance is used up) falls
        // back to email.
        sent.push(
          ...(await deliverWithFallback(
            rest,
            Boolean(u.primaryEmail),
            async (ch) => {
              if (ch === "LINE" && u.lineUserId) {
                await linePush(u.lineUserId, [
                  { type: "text", text: lineText(text, url) },
                ]);
              } else if (ch === "EMAIL" && u.primaryEmail) {
                const mail = await renderEmail({
                  rendered: text,
                  locale: u.locale,
                  recipientName: u.nameRomaji ?? u.nameKanji ?? null,
                  url,
                  note: n.note,
                });
                await sendEmail({ to: u.primaryEmail, ...mail });
              }
            },
            (ch, e) => console.error(`[notify] ${ch} to ${u.id} failed`, e),
          )),
        );
      }
      for (const ch of sent) logs.push({ userId: u.id, channel: ch });
      if (link && sent.length)
        receipts.push({ linkId: link.id, userId: u.id, channels: sent });
      if (sent.length) result.sent.set(u.id, sent);
      else result.failed.push(u.id);
    });
    if (receipts.length) {
      await db.notificationReceipt.createMany({
        data: receipts,
        skipDuplicates: true,
      });
    }
    if (logs.length) {
      await db.notificationLog.createMany({
        data: logs.map((l) => ({
          userId: l.userId,
          channel: l.channel,
          kind: n.kind,
          refId: n.refId ?? null,
        })),
      });
    }
  }
  return result;
}

/**
 * Estimated LINE / email / app counts for sending `kind` to these users
 * (§11). `push`: members who get notifications in the app
 * (membersWithPush in src/lib/push/devices.ts) — they use no LINE message.
 */
export function estimateLinePushes(
  users: (RoutableUser & { id?: string })[],
  kind: NotifyKind,
  push: ReadonlySet<string> = new Set(),
): {
  line: number;
  email: number;
  app: number;
} {
  let line = 0;
  let email = 0;
  let app = 0;
  const lineOk = "line" in NOTIFY_KINDS[kind];
  for (const u of users) {
    const ch = channelsFor(
      { ...u, push: Boolean(u.id && push.has(u.id)) },
      { line: lineOk },
    )[0];
    if (ch === "PUSH") app++;
    else if (ch === "LINE") line++;
    else if (ch === "EMAIL") email++;
  }
  return { line, email, app };
}

export const NOTIFY_USER_SELECT = {
  id: true,
  locale: true,
  lineUserId: true,
  lineFollowing: true,
  notifyVia: true,
  primaryEmail: true,
  notifyOff: true,
  nameRomaji: true,
  nameKanji: true,
  linkCode: true,
} as const;
