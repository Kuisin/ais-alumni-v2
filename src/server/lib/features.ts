/**
 * Feature switches.
 *
 * MESSAGES_ENABLED: "お知らせを送る" (Broadcast messages from admins, teacher
 * managers and class representatives, with an inbox and read receipts). Off
 * for now: announcements go out as ニュース only. The code and data are kept
 * so it can be switched back on.
 */
export const MESSAGES_ENABLED = false;

/**
 * Chat v2: the 「18歳以上」 group and 1:1 DMs, which use new ChatGroupKind
 * values (ADULTS, DIRECT). On since those values reached main (release #48);
 * dev and main share the database, and a Prisma client can't read an enum
 * value it doesn't know, so new kinds must reach main before being used.
 */
const CHAT_V2_RELEASED = true;
export const CHAT_V2_ENABLED = CHAT_V2_RELEASED || process.env.CHAT_V2 === "1";
export const ADULTS_CHAT_ENABLED = CHAT_V2_ENABLED;
export const DIRECT_CHAT_ENABLED = CHAT_V2_ENABLED;

/**
 * The 「学年代表」 group chat (ChatGroupKind.CLASS_REPS). On since CLASS_REPS
 * reached main (release #60); new kinds must reach main before being used.
 */
const CLASS_REPS_CHAT_RELEASED = true;
export const CLASS_REPS_CHAT_ENABLED =
  CLASS_REPS_CHAT_RELEASED || process.env.CHAT_V3 === "1";

/**
 * The 「卒業生」 and 「卒業生（成人）」 group chats (ChatGroupKind.GRADUATES,
 * GRADUATES_ADULTS). On since those enum values reached main (release with
 * #133); dev and main share the database, and main's Prisma client can't
 * read unknown kinds, so new kinds must reach main before being used.
 */
const GRADUATE_CHATS_RELEASED = true;
export const GRADUATE_CHATS_ENABLED =
  GRADUATE_CHATS_RELEASED || process.env.CHAT_V4 === "1";

/**
 * The 「同窓会委員」 group chat (ChatGroupKind.ALUMNI_COMMITTEE): members with
 * the 同窓会委員 position, and admins. On since the enum value reached main
 * (release with #134).
 */
const COMMITTEE_CHAT_RELEASED = true;
export const COMMITTEE_CHAT_ENABLED =
  COMMITTEE_CHAT_RELEASED || process.env.CHAT_V5 === "1";
