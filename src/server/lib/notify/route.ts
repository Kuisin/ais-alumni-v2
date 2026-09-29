import { NotifyChannel } from "@/server/generated/prisma/enums";

export type Channel = "LINE" | "EMAIL" | "PUSH";
/** The member's own channel when the app isn't used (§11). */
export type LineOrEmail = Exclude<Channel, "PUSH">;

export type RoutableUser = {
  lineUserId: string | null;
  lineFollowing: boolean;
  notifyVia: NotifyChannel;
  primaryEmail: string | null;
  /** app notifications are on for at least one of their devices */
  push?: boolean;
};

/**
 * Delivery rule (§11):
 *   lineLinked && lineFollowing && notifyVia != EMAIL_ONLY → LINE, else email.
 * Returns null if the user is unreachable (no LINE and no email).
 */
export function chooseChannel(user: RoutableUser): LineOrEmail | null {
  if (
    user.lineUserId &&
    user.lineFollowing &&
    user.notifyVia !== NotifyChannel.EMAIL_ONLY
  ) {
    return "LINE";
  }
  return user.primaryEmail ? "EMAIL" : null;
}

export type RouteOptions = {
  /** a LINE-enabled kind (ニュース, unread chat notices) */
  line?: boolean;
  /** also by email when it goes to the app (security, application results,
   *  anything with a committee note) */
  alwaysEmail?: boolean;
  /** only to the app (immediate chat pushes); nothing without it */
  pushOnly?: boolean;
};

/** The member's LINE / email channel for a kind (§11), without the app. */
export function lineOrEmail(
  user: RoutableUser,
  opts: RouteOptions,
): LineOrEmail[] {
  const channel = opts.line
    ? chooseChannel(user)
    : user.primaryEmail
      ? "EMAIL"
      : null;
  return channel ? [channel] : [];
}

/**
 * Channels to use. Members who turned on notifications in the app get
 * everything there (plus email for `alwaysEmail` kinds); everyone else as
 * before (§11): only LINE-enabled kinds (ニュース, unread chat notices)
 * follow the member's LINE / email choice; every other kind goes by email.
 */
export function channelsFor(
  user: RoutableUser,
  opts: RouteOptions = {},
): Channel[] {
  if (opts.pushOnly) return user.push ? ["PUSH"] : [];
  if (user.push)
    return opts.alwaysEmail && user.primaryEmail ? ["PUSH", "EMAIL"] : ["PUSH"];
  return lineOrEmail(user, opts);
}

/**
 * Send on each channel in turn. When LINE fails — for example once the
 * month's LINE message allowance is used up — and email wasn't already
 * routed, fall back to email so the member still gets the notification.
 * Returns the channels that were sent.
 */
export async function deliverWithFallback(
  channels: readonly Channel[],
  canEmail: boolean,
  send: (channel: Channel) => Promise<void>,
  onError: (channel: Channel, error: unknown) => void,
): Promise<Channel[]> {
  const queue = [...channels];
  const sent: Channel[] = [];
  for (let i = 0; i < queue.length; i++) {
    const channel = queue[i];
    try {
      await send(channel);
      sent.push(channel);
    } catch (e) {
      onError(channel, e);
      if (channel === "LINE" && canEmail && !queue.includes("EMAIL"))
        queue.push("EMAIL");
    }
  }
  return sent;
}

/**
 * After the app push reached none of the member's devices: their LINE /
 * email route instead (unless it was app-only), plus whatever else was
 * routed, without duplicates.
 */
export function afterPushFailed(
  user: RoutableUser,
  routed: readonly Channel[],
  opts: RouteOptions,
): Channel[] {
  if (opts.pushOnly) return [];
  const rest: Channel[] = routed.filter((c) => c !== "PUSH");
  for (const c of lineOrEmail(user, opts))
    if (!rest.includes(c)) rest.unshift(c);
  return rest;
}
