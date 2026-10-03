import { getTranslatorFor } from "@/server/i18n/translator";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { lineReply, verifyLineSignature } from "@/server/lib/line";
import { syncLineMenuFor } from "@/server/lib/line-menu-sync";
import { lineReplyKind } from "@/server/lib/line-reply";
import { lineReplyFor } from "@/server/lib/line-reply-db";
import { welcomeMessages } from "@/server/lib/line-welcome";
import { publicUrl } from "@/server/lib/urls";

/**
 * POST /api/line/webhook — Messaging API webhook for the Official Account.
 * Tracks friendship (follow / unfollow) so notifications route to LINE only
 * for members who can actually receive pushes (§5.4), and replies to a
 * follow with the welcome message (src/lib/line-welcome.ts). The rich
 * menu's 未読のチャット / ニュース一覧 buttons (postbacks) and the same words
 * typed in the chat get the member's unread chats or news as a reply —
 * replies are free, unlike pushes (src/lib/line-reply.ts). Other messages get no reply.
 */

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { type?: string; userId?: string };
  follow?: { isUnblocked?: boolean };
  postback?: { data?: string };
  message?: { type?: string; text?: string };
};

async function sendWelcome(lineUserId: string, event: LineEvent) {
  if (!event.replyToken) return;
  const member = await db.user.findFirst({
    where: { lineUserId },
    select: { nameRomaji: true, nameKanji: true, locale: true },
  });
  const [ja, en] = await Promise.all(
    (["ja", "en"] as const).map(async (l) => {
      const t = await getTranslatorFor(l, "line");
      return (k: string, v?: Record<string, string>) => t(`welcome.${k}`, v);
    }),
  );
  const locale = member?.locale === "en" ? "en" : "ja";
  const hasName = Boolean(member?.nameRomaji || member?.nameKanji);
  await lineReply(
    event.replyToken,
    welcomeMessages(
      { ja, en },
      {
        member: member
          ? {
              name: hasName ? displayName(member, locale) : null,
              locale,
            }
          : null,
        isUnblocked: Boolean(event.follow?.isUnblocked),
        // Links in LINE always point at the production site.
        appUrl: publicUrl,
      },
    ),
  );
}

export async function POST(req: Request) {
  // The signature is computed over the exact raw body, so read it as text first.
  const raw = await req.text();
  if (!verifyLineSignature(raw, req.headers.get("x-line-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    const body = JSON.parse(raw) as { events?: LineEvent[] };
    events = Array.isArray(body.events) ? body.events : [];
  } catch {
    // Valid signature but unparsable body: acknowledge so LINE doesn't retry.
    return new Response(null, { status: 200 });
  }

  for (const event of events) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;
    if (event.type === "follow" || event.type === "unfollow") {
      try {
        // updateMany: the LINE user may not be linked to any member (no-op).
        await db.user.updateMany({
          where: { lineUserId },
          data: { lineFollowing: event.type === "follow" },
        });
      } catch (e) {
        console.error("[line-webhook] failed to update friendship", e);
      }
    }
    if (event.type === "follow") {
      // The menu in the member's language, with their unread dots.
      await syncLineMenuFor({ lineUserId });
      try {
        await sendWelcome(lineUserId, event);
      } catch (e) {
        // Never fail the webhook over the greeting (LINE would retry).
        console.error("[line-webhook] failed to send welcome", e);
      }
    }
    if (event.type === "postback" || event.type === "message")
      await replyFromMenu(lineUserId, event);
  }
  return new Response(null, { status: 200 });
}

/** 未読のチャット / ニュース一覧: reply with the member's chats or news (free). */
async function replyFromMenu(lineUserId: string, event: LineEvent) {
  if (!event.replyToken) return;
  const kind = lineReplyKind({
    postback: event.type === "postback" ? event.postback?.data : null,
    text:
      event.type === "message" && event.message?.type === "text"
        ? event.message.text
        : null,
  });
  if (!kind) return;
  try {
    await lineReply(event.replyToken, await lineReplyFor(lineUserId, kind));
  } catch (e) {
    // Acknowledge anyway: LINE would retry, and the reply token is spent.
    console.error("[line-webhook] news reply failed", e);
  }
}
