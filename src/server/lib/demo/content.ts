import type {
  ChatInfo,
  ChatInfoMember,
  ChatKind,
  ChatList,
  ChatListRow,
  ChatMessage,
  ChatRoom,
  ChatRoomMember,
} from "@contract/chat";
import type { EventDetail, EventListItem, RsvpAnswer } from "@contract/events";
import type { HomeEvent, HomeNews } from "@contract/home";
import type {
  MessageDetail,
  MessageSummary,
  NewsDetail,
  NewsSummary,
} from "@contract/news";
import type { InboxItem } from "@contract/notifications";
import { toString as qrToString } from "qrcode";
import {
  DEMO_USER_ID,
  type DemoMember,
  demoAvatar,
  ME,
  member,
  otherName,
} from "./people";

/**
 * The demo's news, events, chats and notifications: static fictional
 * content, with dates relative to now so it never goes stale.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const ago = (ms: number): string =>
  new Date(Date.now() - ms).toISOString();

/** Japan time `hour`:`minute` on the day `days` from today. */
export function jstDay(days: number, hour: number, minute = 0): string {
  const jst = new Date(Date.now() + 9 * HOUR + days * DAY);
  return new Date(
    Date.UTC(
      jst.getUTCFullYear(),
      jst.getUTCMonth(),
      jst.getUTCDate(),
      hour - 9,
      minute,
    ),
  ).toISOString();
}

const COMMITTEE = "AIS Alumni Committee";

// ---- News ----

type DemoPost = Omit<NewsDetail, "publishedAt" | "deadline"> & {
  publishedAgo: number;
  /** days from now */
  deadlineIn: number | null;
  excerpt: string;
  unread: boolean;
  needsAnswer: boolean;
};

function posts(): DemoPost[] {
  return [
    {
      id: "demo-news-welcome",
      adminView: false,
      pinned: true,
      publishedAgo: 20 * DAY,
      sender: COMMITTEE,
      title: "Welcome to the new AIS Alumni app",
      titleFallback: null,
      excerpt:
        "The AIS Alumni app is here: news, events, the member directory and chats with your classmates — all in one place.",
      body: [
        "The **AIS Alumni app** is here! Everything from the website is now in your pocket:",
        "",
        "- **News** from the committee, teachers and class reps",
        "- **Events** — reply, and show your ticket at the door",
        "- The **member directory** to find classmates and teachers",
        "- **Chats** with your class and with friends who follow you back",
        "",
        "Turn on notifications in **Settings → App notifications** so you never miss an update.",
        "",
        "Questions or ideas? Use **Contact us** in the menu. — The AIS Alumni Committee",
      ].join("\n"),
      bodyFallback: null,
      cover: null,
      deadlineIn: null,
      closedAt: null,
      open: true,
      requireConfirm: false,
      confirmedAt: null,
      confirmCount: 0,
      polls: [],
      attachments: [],
      allowComments: true,
      reactions: [
        { emoji: "👏", count: 24, mine: true },
        { emoji: "🎉", count: 11, mine: false },
        { emoji: "❤️", count: 7, mine: false },
      ],
      comments: [
        {
          id: "demo-c-1",
          name: "Kenji Morimoto",
          body: "Great work, committee! Already found half of Class 3 in the directory.",
          createdAt: ago(19 * DAY),
          hidden: false,
          mine: false,
        },
        {
          id: "demo-c-2",
          name: "Sophie Laurent",
          body: "Lovely to see so many familiar names again. Bravo !",
          createdAt: ago(18 * DAY),
          hidden: false,
          mine: false,
        },
      ],
      isAdmin: false,
      maxCommentLength: 1000,
      unread: false,
      needsAnswer: false,
    },
    {
      id: "demo-news-reunion",
      adminView: false,
      pinned: false,
      publishedAgo: 5 * HOUR,
      sender: COMMITTEE,
      title: "Alumni Reunion: registration is open",
      titleFallback: null,
      excerpt:
        "Our autumn reunion is coming up! Reply on the event page and tell us what you'd like to do on the day.",
      body: [
        "Our **Alumni Reunion** is coming up, and registration is now open.",
        "",
        "Graduates, former students, teachers and families are all welcome. Reply on the event page (Events tab) — you can bring one guest.",
        "",
        "Help us plan the day: pick everything you'd enjoy in the poll below.",
      ].join("\n"),
      bodyFallback: null,
      cover: null,
      deadlineIn: 30,
      closedAt: null,
      open: true,
      requireConfirm: false,
      confirmedAt: null,
      confirmCount: 0,
      polls: [
        {
          id: "demo-poll-1",
          kind: "POLL",
          question: "What would you like at the reunion?",
          multiple: true,
          voters: 37,
          options: [
            {
              id: "demo-opt-1",
              label: "School tour",
              startsAt: null,
              counts: { YES: 25, MAYBE: 0, NO: 0 },
              mine: null,
              best: false,
              names: [],
            },
            {
              id: "demo-opt-2",
              label: "Class photos slideshow",
              startsAt: null,
              counts: { YES: 30, MAYBE: 0, NO: 0 },
              mine: null,
              best: false,
              names: [],
            },
            {
              id: "demo-opt-3",
              label: "Sports day rematch",
              startsAt: null,
              counts: { YES: 14, MAYBE: 0, NO: 0 },
              mine: null,
              best: false,
              names: [],
            },
          ],
        },
      ],
      attachments: [],
      allowComments: true,
      reactions: [{ emoji: "🎉", count: 9, mine: false }],
      comments: [],
      isAdmin: false,
      maxCommentLength: 1000,
      unread: true,
      needsAnswer: true,
    },
    {
      id: "demo-news-mentoring",
      adminView: false,
      pinned: false,
      publishedAgo: 4 * DAY,
      sender: "Alumni committee member",
      title: "Mentoring program: pick a kickoff date",
      titleFallback: null,
      excerpt:
        "We're starting a mentoring program where alumni share their university and career experience. Which date works for you?",
      body: [
        "We're starting a **mentoring program**: alumni share their experience of university, work and life abroad with younger graduates.",
        "",
        "The kickoff is an online session of about an hour. Mark every date that works for you.",
      ].join("\n"),
      bodyFallback: null,
      cover: null,
      deadlineIn: 10,
      closedAt: null,
      open: true,
      requireConfirm: false,
      confirmedAt: null,
      confirmCount: 0,
      polls: [
        {
          id: "demo-poll-2",
          kind: "SCHEDULE",
          question: "Kickoff session",
          multiple: false,
          voters: 3,
          options: [
            {
              id: "demo-slot-1",
              label: "",
              startsAt: jstDay(14, 19),
              counts: { YES: 3, MAYBE: 0, NO: 1 },
              mine: "YES",
              best: true,
              names: [
                { name: "Reviewer App", answer: "YES" },
                { name: "Emily Tanaka", answer: "YES" },
                { name: "Yui Hasegawa", answer: "YES" },
                { name: "Liam Carter", answer: "NO" },
              ],
            },
            {
              id: "demo-slot-2",
              label: "",
              startsAt: jstDay(16, 20),
              counts: { YES: 2, MAYBE: 1, NO: 1 },
              mine: "MAYBE",
              best: false,
              names: [
                { name: "Reviewer App", answer: "MAYBE" },
                { name: "Emily Tanaka", answer: "NO" },
                { name: "Yui Hasegawa", answer: "YES" },
                { name: "Liam Carter", answer: "YES" },
              ],
            },
          ],
        },
      ],
      attachments: [],
      allowComments: true,
      reactions: [{ emoji: "👍", count: 6, mine: false }],
      comments: [
        {
          id: "demo-c-3",
          name: "Yui Hasegawa",
          body: "Count me in! Happy to talk about studying marine biology.",
          createdAt: ago(3 * DAY),
          hidden: false,
          mine: false,
        },
      ],
      isAdmin: false,
      maxCommentLength: 1000,
      unread: false,
      needsAnswer: false,
    },
    {
      id: "demo-news-photos",
      adminView: false,
      pinned: false,
      publishedAgo: 9 * DAY,
      sender: "Class rep (Class 3)",
      title: "Class 3: help us collect old photos",
      titleFallback: null,
      excerpt:
        "We're putting together a slideshow of our AIS years for the reunion. Please confirm you've read this and share your photos in the class chat.",
      body: [
        "Hi Class 3!",
        "",
        "We're putting together a slideshow of our AIS years for the reunion — school trips, sports days, the winter concert…",
        "",
        "Please share any photos you have in the **Class 3** chat by the deadline, and tap **Confirm** below so we know you've seen this.",
        "",
        "— Kenji",
      ].join("\n"),
      bodyFallback: null,
      cover: null,
      deadlineIn: 21,
      closedAt: null,
      open: true,
      requireConfirm: true,
      confirmedAt: ago(8 * DAY),
      confirmCount: 14,
      polls: [],
      attachments: [],
      allowComments: false,
      reactions: [],
      comments: [],
      isAdmin: false,
      maxCommentLength: 1000,
      unread: false,
      needsAnswer: false,
    },
  ];
}

export function newsSummaries(): NewsSummary[] {
  return posts()
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || a.publishedAgo - b.publishedAgo,
    )
    .map((p) => ({
      id: p.id,
      title: p.title,
      titleFallback: p.titleFallback,
      excerpt: p.excerpt,
      pinned: p.pinned,
      publishedAt: ago(p.publishedAgo),
      sender: p.sender,
      unread: p.unread,
      needsAnswer: p.needsAnswer,
      adminView: false,
    }));
}

export function homeNews(): HomeNews[] {
  return newsSummaries()
    .slice(0, 3)
    .map(({ excerpt: _e, adminView: _a, ...n }) => n);
}

export function newsDetail(id: string): NewsDetail | undefined {
  const p = posts().find((x) => x.id === id);
  if (!p) return undefined;
  const {
    publishedAgo,
    deadlineIn,
    excerpt: _e,
    unread: _u,
    needsAnswer: _n,
    ...rest
  } = p;
  return {
    ...rest,
    publishedAt: ago(publishedAgo),
    deadline: deadlineIn === null ? null : jstDay(deadlineIn, 23, 59),
  };
}

// ---- あなた宛ての連絡 (Broadcast messages) ----

const MESSAGES = [
  {
    id: "demo-msg-1",
    title: "Thank you for joining AIS Alumni",
    sender: COMMITTEE,
    sentAgo: 20 * DAY,
    sentTo: "Everyone",
    body: "Thank you for joining the AIS Alumni network!\n\nPlease take a moment to complete your profile — a photo and a short bio help your classmates recognise you.\n\nThe AIS Alumni Committee",
  },
  {
    id: "demo-msg-2",
    title: "Class 3 get-together planning",
    sender: "Kenji Morimoto (Class rep)",
    sentAgo: 6 * DAY,
    sentTo: "Class 3",
    body: "Hi everyone,\n\nWe're planning a small Class 3 dinner in Nagoya the evening after the reunion. Details will follow in the class chat.\n\nKenji",
  },
];

export function messageSummaries(): MessageSummary[] {
  return MESSAGES.map((x) => ({
    id: x.id,
    title: x.title,
    sender: x.sender,
    sentAt: ago(x.sentAgo),
    edited: false,
    unread: false,
  })).reverse();
}

export function messageDetail(id: string): MessageDetail | undefined {
  const x = MESSAGES.find((y) => y.id === id);
  if (!x) return undefined;
  return {
    id: x.id,
    title: x.title,
    body: x.body,
    sender: x.sender,
    sentAt: ago(x.sentAgo),
    edited: false,
    sentTo: x.sentTo,
    isRecipient: true,
  };
}

// ---- Events ----

type DemoEvent = {
  id: string;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  mapUrl: string | null;
  sender: string;
  capacity: number | null;
  going: number;
  maxGuests: number;
  mine: { answer: RsvpAnswer; guests: number } | null;
  closesAt: string;
  past: boolean;
};

function events(): DemoEvent[] {
  return [
    {
      id: "demo-event-talk",
      title: "Online career talk: working abroad",
      body: "Three alumni talk about studying and working in Europe, North America and Southeast Asia, followed by Q&A.\n\nThe meeting link is sent to everyone who answers **Going**.",
      startsAt: jstDay(3, 20),
      endsAt: jstDay(3, 21, 30),
      location: "Online",
      mapUrl: null,
      sender: "Alumni committee member",
      capacity: null,
      going: 23,
      maxGuests: 0,
      mine: null,
      closesAt: jstDay(3, 12),
      past: false,
    },
    {
      id: "demo-event-reunion",
      title: "AIS Alumni Reunion",
      body: [
        "Our big get-together for graduates, former students, teachers and families.",
        "",
        "- **Afternoon:** school tour and class photos slideshow",
        "- **Evening:** buffet dinner and games",
        "",
        "Bring your ticket (shown on this page once you reply) — staff will scan it at the entrance.",
      ].join("\n"),
      startsAt: jstDay(45, 14),
      endsAt: jstDay(45, 19),
      location: "Community Hall, Nagoya",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Nagoya",
      sender: COMMITTEE,
      capacity: 120,
      going: 58,
      maxGuests: 1,
      mine: { answer: "GOING", guests: 1 },
      closesAt: jstDay(38, 23, 59),
      past: false,
    },
    {
      id: "demo-event-bbq",
      title: "Summer BBQ in the park",
      body: "An easygoing summer barbecue for alumni and families. Thanks to everyone who came!",
      startsAt: jstDay(-60, 11),
      endsAt: jstDay(-60, 15),
      location: "Riverside Park, Nagoya",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Nagoya",
      sender: "Class rep (Class 3)",
      capacity: 40,
      going: 36,
      maxGuests: 2,
      mine: { answer: "GOING", guests: 0 },
      closesAt: jstDay(-63, 23, 59),
      past: true,
    },
  ];
}

export function eventList(tab: "upcoming" | "past"): EventListItem[] {
  const list = events().filter((e) => e.past === (tab === "past"));
  if (tab === "past") list.reverse();
  return list.map((e) => ({
    id: e.id,
    title: { text: e.title, fallback: null },
    startsAt: e.startsAt,
    location: e.location,
    sender: e.sender,
    myAnswer: e.mine?.answer ?? null,
  }));
}

export function homeEvents(): HomeEvent[] {
  return eventList("upcoming").map((e) => ({
    id: e.id,
    title: e.title.text,
    titleFallback: null,
    startsAt: e.startsAt,
    location: e.location,
    sender: e.sender,
    myAnswer: e.myAnswer,
  }));
}

export async function eventDetail(
  id: string,
  answer?: { answer: RsvpAnswer; guests: number },
): Promise<EventDetail | undefined> {
  const e = events().find((x) => x.id === id);
  if (!e) return undefined;
  let going = e.going;
  let mine = e.mine;
  if (answer && !e.past) {
    if (mine?.answer === "GOING") going -= 1 + mine.guests;
    const guests =
      answer.answer === "NOT_GOING"
        ? 0
        : Math.max(0, Math.min(e.maxGuests, answer.guests));
    mine = { answer: answer.answer, guests };
    if (mine.answer === "GOING") going += 1 + guests;
  }
  const open = !e.past && Date.parse(e.closesAt) > Date.now();
  const leftMs = Date.parse(e.closesAt) - Date.now();
  const ticket =
    mine && mine.answer !== "NOT_GOING"
      ? {
          qrSvg: await qrToString(`AIS Alumni demo ticket ${e.id}`, {
            type: "svg",
            margin: 1,
            errorCorrectionLevel: "M",
          }),
          name: ME.name,
          kanji: null,
          checkedInAt: e.past ? jstDay(-60, 11, 5) : null,
        }
      : null;
  return {
    id: e.id,
    title: { text: e.title, fallback: null },
    body: { text: e.body, fallback: null },
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    location: e.location,
    mapUrl: e.mapUrl,
    sender: e.sender,
    capacity: e.capacity,
    going,
    remaining: e.capacity === null ? null : Math.max(0, e.capacity - going),
    rsvp: {
      open,
      closesAt: e.closesAt,
      closedByOrganizer: false,
      full: e.capacity !== null && going >= e.capacity,
      left: open
        ? leftMs >= DAY
          ? { unit: "days", count: Math.floor(leftMs / DAY) }
          : { unit: "hours", count: Math.max(1, Math.floor(leftMs / HOUR)) }
        : null,
      maxGuests: e.maxGuests,
      mine,
    },
    ticket,
    checkInPath: null,
  };
}

// ---- Chats ----

type DemoChat = {
  id: string;
  kind: ChatKind;
  title: string;
  hint: string;
  direct: boolean;
  /** other members (the demo user is always in it) */
  others: DemoMember[];
  /** members beyond `others` counted in memberCount */
  extraCount: number;
  messages: {
    id: string;
    from: string;
    body: string;
    ago: number;
    mentionAll?: boolean;
  }[];
  unread: number;
  mentioned: boolean;
};

function knownMembers(ids: string[]): DemoMember[] {
  return ids.map(member).filter((x): x is DemoMember => Boolean(x));
}

function chats(): DemoChat[] {
  return [
    {
      id: "demo-chat-emily",
      kind: "DIRECT",
      title: "Emily Tanaka",
      hint: "One-to-one chat",
      direct: true,
      others: knownMembers(["demo-m-emily"]),
      extraCount: 0,
      messages: [
        {
          id: "demo-cm-1",
          from: "demo-m-emily",
          body: "Hey! So good to find you on here 😊",
          ago: 2 * DAY,
        },
        {
          id: "demo-cm-2",
          from: DEMO_USER_ID,
          body: "Emily! It's been years. How is Tokyo?",
          ago: 2 * DAY - 20 * MIN,
        },
        {
          id: "demo-cm-3",
          from: "demo-m-emily",
          body: "Busy but fun. Are you coming to the reunion?",
          ago: DAY + 3 * HOUR,
        },
        {
          id: "demo-cm-4",
          from: DEMO_USER_ID,
          body: "Yes, I already replied — bringing a friend too.",
          ago: DAY + 2 * HOUR,
        },
        {
          id: "demo-cm-5",
          from: "demo-m-emily",
          body: "Perfect, let's sit together at dinner!",
          ago: 40 * MIN,
        },
      ],
      unread: 1,
      mentioned: false,
    },
    {
      id: "demo-chat-class3",
      kind: "COHORT",
      title: "Class 3",
      hint: "Students and graduates of this class",
      direct: false,
      others: knownMembers(["demo-m-emily", "demo-m-kenji", "demo-m-marco"]),
      extraCount: 18,
      messages: [
        {
          id: "demo-cm-10",
          from: "demo-m-kenji",
          body: "@all Reminder: please share your old AIS photos here for the reunion slideshow!",
          ago: 8 * DAY,
          mentionAll: true,
        },
        {
          id: "demo-cm-11",
          from: "demo-m-marco",
          body: "Found a picture of our 2nd grade school trip, will upload tonight.",
          ago: 7 * DAY,
        },
        {
          id: "demo-cm-12",
          from: DEMO_USER_ID,
          body: "I have some from sports day. Sending them this weekend.",
          ago: 6 * DAY,
        },
        {
          id: "demo-cm-13",
          from: "demo-m-emily",
          body: "Can't believe how small we all were 😂",
          ago: 5 * DAY,
        },
        {
          id: "demo-cm-14",
          from: "demo-m-kenji",
          body: "Class dinner after the reunion is booked — details coming soon.",
          ago: 3 * HOUR,
        },
      ],
      unread: 1,
      mentioned: false,
    },
    {
      id: "demo-chat-former",
      kind: "FORMER_STUDENTS",
      title: "Former students",
      hint: "Everyone who attended AIS (graduates included)",
      direct: false,
      others: knownMembers([
        "demo-m-emily",
        "demo-m-kenji",
        "demo-m-yui",
        "demo-m-daniel",
        "demo-m-marco",
      ]),
      extraCount: 142,
      messages: [
        {
          id: "demo-cm-20",
          from: "demo-m-yui",
          body: "Anyone else studying in Okinawa? Would love to meet up.",
          ago: 12 * DAY,
        },
        {
          id: "demo-cm-21",
          from: "demo-m-daniel",
          body: "Not Okinawa, but I'm in Fukuoka if anyone is around!",
          ago: 11 * DAY,
        },
        {
          id: "demo-cm-22",
          from: "demo-m-emily",
          body: "The career talk next week looks great — see you there.",
          ago: 2 * DAY,
        },
      ],
      unread: 0,
      mentioned: false,
    },
  ];
}

/** A 1:1 talk with a member who has none yet (POST /chat/direct). */
function directChat(id: string): DemoChat | undefined {
  const known = chats().find((c) => c.id === id);
  if (known) return known;
  const prefix = "demo-chat-dm-";
  if (!id.startsWith(prefix)) return undefined;
  const other = member(id.slice(prefix.length));
  if (!other) return undefined;
  return {
    id,
    kind: "DIRECT",
    title: other.name,
    hint: "One-to-one chat",
    direct: true,
    others: [other],
    extraCount: 0,
    messages: [],
    unread: 0,
    mentioned: false,
  };
}

export function directChatId(userId: string): string | undefined {
  if (!member(userId)) return undefined;
  return userId === "demo-m-emily"
    ? "demo-chat-emily"
    : `demo-chat-dm-${userId}`;
}

function cohortOf(x: DemoMember | null): number | null {
  return x?.role === "FORMER_STUDENT" ? x.cohort : null;
}

function chatMessage(msg: DemoChat["messages"][number]): ChatMessage {
  const from = msg.from === DEMO_USER_ID ? null : (member(msg.from) ?? null);
  return {
    id: msg.id,
    userId: msg.from,
    name: from?.name ?? ME.name,
    avatar: from ? demoAvatar(from.gender) : ME.avatar,
    cohort: from ? cohortOf(from) : ME.cohort,
    rep: from?.rep ?? false,
    body: msg.body,
    createdAt: ago(msg.ago),
    deleted: false,
    mentionUserIds: [],
    mentionAll: Boolean(msg.mentionAll),
  };
}

function roomMember(x: DemoMember): ChatRoomMember {
  return {
    id: x.id,
    name: x.name,
    avatar: demoAvatar(x.gender),
    cohort: cohortOf(x),
    rep: x.rep,
  };
}

const meRoomMember: ChatRoomMember = {
  id: DEMO_USER_ID,
  name: ME.name,
  avatar: ME.avatar,
  cohort: ME.cohort,
  rep: false,
};

export function chatList(): ChatList {
  const rows: ChatListRow[] = chats().map((c) => {
    const last = c.messages.at(-1);
    let preview = `${c.others.length + 1 + c.extraCount} members`;
    if (last) {
      const who =
        last.from === DEMO_USER_ID ? "You" : (member(last.from)?.name ?? "");
      preview =
        c.direct && last.from !== DEMO_USER_ID
          ? last.body
          : `${who}: ${last.body}`;
    }
    return {
      id: c.id,
      direct: c.direct,
      joined: true,
      name: c.title,
      avatar: c.direct && c.others[0] ? demoAvatar(c.others[0].gender) : null,
      memberCount: c.others.length + 1 + c.extraCount,
      preview,
      lastAt: last ? ago(last.ago) : null,
      unread: c.unread,
      mentioned: c.mentioned,
    };
  });
  rows.sort(
    (a, b) => Date.parse(b.lastAt ?? "0") - Date.parse(a.lastAt ?? "0"),
  );
  return { rows, canStartDirect: true };
}

export function chatRoom(id: string): ChatRoom | undefined {
  const c = directChat(id);
  if (!c) return undefined;
  const members = [meRoomMember, ...c.others.map(roomMember)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const unreadFrom = c.unread
    ? c.messages[c.messages.length - c.unread]
    : undefined;
  return {
    id: c.id,
    kind: c.kind,
    topic: `demo:chat:${c.id}`,
    title: c.title,
    direct: c.direct,
    member: true,
    moderator: false,
    memberCount: c.others.length + 1 + c.extraCount,
    members,
    partner: c.direct && c.others[0] ? roomMember(c.others[0]) : null,
    messages: c.messages.map(chatMessage),
    hasOlder: false,
    reads: chatReads(id),
    lastReadAt: unreadFrom
      ? new Date(Date.parse(ago(unreadFrom.ago)) - MIN).toISOString()
      : ago(0),
    muted: false,
    notifyLevel: c.direct ? "all" : "mentions",
    stopped: null,
  };
}

/** When the other members last read (既読 marks). */
export function chatReads(id: string): string[] {
  const c = directChat(id);
  if (!c) return [];
  return c.others.slice(0, 3).map((_, i) => ago((i + 1) * 30 * MIN));
}

export function chatInfo(id: string): ChatInfo | undefined {
  const c = directChat(id);
  if (!c) return undefined;
  const info = (x: DemoMember): ChatInfoMember => ({
    ...roomMember(x),
    otherNames: otherName(x),
    self: false,
    linked: true,
  });
  const self: ChatInfoMember = {
    ...meRoomMember,
    otherNames: null,
    self: true,
    linked: false,
  };
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    direct: c.direct,
    hint: c.hint,
    memberCount: c.others.length + 1 + c.extraCount,
    partner: c.direct && c.others[0] ? info(c.others[0]) : null,
    members: [
      self,
      ...c.others.map(info).sort((a, b) => a.name.localeCompare(b.name)),
    ],
    member: true,
    muted: false,
    notifyLevel: c.direct ? "all" : "mentions",
  };
}

export function sentMessage(body: string): ChatMessage {
  return {
    id: `demo-cm-${Date.now()}`,
    userId: DEMO_USER_ID,
    name: ME.name,
    avatar: ME.avatar,
    cohort: ME.cohort,
    rep: false,
    body,
    createdAt: new Date().toISOString(),
    deleted: false,
    mentionUserIds: [],
    mentionAll: /@(all|全員)\b/i.test(body),
  };
}

// ---- Notifications (お知らせ) ----

export function inboxItems(): InboxItem[] {
  return [
    {
      id: "demo-n-follow",
      kind: "follow_request",
      category: "social",
      emoji: "👋",
      title: "New follow request",
      body: "Daniel Okafor would like to follow you.",
      path: "/app/follows",
      sentAt: ago(2 * HOUR),
      read: false,
      channels: ["EMAIL"],
    },
    {
      id: "demo-n-news",
      kind: "news_published",
      category: "news",
      emoji: "📰",
      title: "New post: Alumni Reunion: registration is open",
      body: "From: AIS Alumni Committee",
      path: "/app/news/demo-news-reunion",
      sentAt: ago(5 * HOUR),
      read: false,
      channels: ["EMAIL"],
    },
    {
      id: "demo-n-event",
      kind: "event_reminder",
      category: "events",
      emoji: "📅",
      title: "Coming up: Online career talk: working abroad",
      body: "Reply by the deadline if you'd like to join.",
      path: "/app/events/demo-event-talk",
      sentAt: ago(DAY),
      read: true,
      channels: ["EMAIL"],
    },
    {
      id: "demo-n-welcome",
      kind: "account_approved",
      category: "account",
      emoji: "✅",
      title: "Your account has been approved",
      body: "Welcome to AIS Alumni! You can now use every feature of the app.",
      path: "/app/dashboard",
      sentAt: ago(21 * DAY),
      read: true,
      channels: ["EMAIL"],
    },
  ];
}
