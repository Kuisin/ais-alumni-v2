import type { NotifyCategory, NotifyKind } from "@/server/lib/notify/catalog";
import type { ExpoMessage } from "./expo";

/**
 * What an app push carries (pure; src/lib/push/message.test.ts). The app
 * (the app's src/lib/push.tsx) opens `path` — natively where it can — and
 * reports `receipt` (the notification's short-link token) so the open counts
 * as a read receipt, like opening the LINE / email link.
 *
 * Texts follow the catalog rules (src/lib/notify/catalog.ts): title and one
 * sentence, never private content (message text, post bodies, notes).
 */

/** Push payload `data` (keep additive: installed apps read it). */
export type PushData = {
  v: 1;
  kind: string;
  category: string;
  /** app page without the locale, e.g. /app/news/<id>; null = none */
  path: string | null;
  /** short-link token of the notification (read receipts) */
  receipt?: string;
  /** what it's about (a news post, chat, follow request id …) */
  refId?: string;
};

export type PushOptions = {
  /** replace the previous notification about the same thing (chats) */
  collapseId?: string;
  /** stack with others on iOS (default: the category) */
  threadId?: string;
  /** seconds to keep trying (default: Expo's 4 weeks) */
  ttl?: number;
};

/** Interactive actions the app registers (the app's src/lib/push.tsx). */
export const PUSH_CATEGORY_IDS = {
  chat: "chat_message",
  followRequest: "follow_request",
} as const;

const CHAT_KINDS = new Set<string>([
  "CHAT_DIRECT",
  "CHAT_MENTION",
  "CHAT_GROUP",
]);

export function actionCategoryFor(kind: string): string | undefined {
  if (CHAT_KINDS.has(kind)) return PUSH_CATEGORY_IDS.chat;
  if (kind === "FOLLOW_REQUEST") return PUSH_CATEGORY_IDS.followRequest;
  return undefined;
}

export function pushMessageFor(input: {
  token: string;
  kind: NotifyKind | string;
  category: NotifyCategory | string;
  emoji: string;
  title: string;
  body: string;
  path: string | null;
  receipt?: string | null;
  refId?: string | null;
  badge?: number | null;
  options?: PushOptions;
}): ExpoMessage {
  const chat = CHAT_KINDS.has(input.kind);
  const data: PushData = {
    v: 1,
    kind: input.kind,
    category: input.category,
    path: input.path,
    ...(input.receipt ? { receipt: input.receipt } : {}),
    ...(input.refId ? { refId: input.refId } : {}),
  };
  const o = input.options ?? {};
  return {
    to: input.token,
    title: `${input.emoji} ${input.title}`,
    body: input.body,
    data,
    sound: "default",
    ...(typeof input.badge === "number" && input.badge >= 0
      ? { badge: input.badge }
      : {}),
    // Android channels are the notification categories (the app creates
    // one per category, named in the member's language).
    channelId: input.category,
    ...(actionCategoryFor(input.kind)
      ? { categoryId: actionCategoryFor(input.kind) }
      : {}),
    threadId: o.threadId ?? input.category,
    ...(o.collapseId ? { collapseId: o.collapseId, tag: o.collapseId } : {}),
    priority: chat || input.category === "account" ? "high" : "default",
    ...(o.ttl !== undefined ? { ttl: o.ttl } : {}),
  };
}
