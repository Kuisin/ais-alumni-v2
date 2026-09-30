import type {
  DeviceList,
  EmailChangeState,
  MyProfile,
  MySettings,
  NotifyVia,
  SchoolEmailResult,
  SettingsResult,
} from "@contract/account";
import type {
  ChatInfo,
  ChatList,
  ChatMessagesPage,
  ChatReads,
  ChatRoom,
  DirectCandidates,
  MuteResult,
  OkResult,
  ReportResult,
  SendMessageResult,
  StartDirectResult,
} from "@contract/chat";
import type { Locale, Me } from "@contract/core";
import type {
  EventDetail,
  EventList,
  RsvpAnswer,
  RsvpResult,
} from "@contract/events";
import type {
  CohortChoice,
  FamilyClaimResult,
  FamilyPage,
  FamilySearch,
  InviteCreated,
  InvitesPage,
} from "@contract/family";
import type { Home } from "@contract/home";
import type {
  MessageDetail,
  MessageList,
  NewsDetail,
  NewsHubOk,
  NewsList,
} from "@contract/news";
import type {
  ChatNotifyLevel,
  ChatNotifyResult,
  InboxOpenResult,
  InboxPage,
  InboxReadResult,
  PushState,
  PushTestResult,
} from "@contract/notifications";
import type { SupportDefaults, SupportSent } from "@contract/onboarding";
import type {
  AcceptResult,
  DirectoryOptions,
  DirectoryPage,
  FollowLists,
  FollowResult,
  MemberProfile,
  Ok,
} from "@contract/people";
import type {
  FormOk,
  HistoryEditor,
  OrgSearch,
  RecordPage,
} from "@contract/profile";
import { INDUSTRIES } from "@/server/lib/industries";
import { JOB_TYPES } from "@/server/lib/job-types";
import {
  ago,
  chatInfo,
  chatList,
  chatReads,
  chatRoom,
  directChatId,
  eventDetail,
  eventList,
  homeEvents,
  homeNews,
  inboxItems,
  messageDetail,
  messageSummaries,
  newsDetail,
  newsSummaries,
  sentMessage,
} from "./content";
import {
  DEMO_USER_ID,
  ME,
  MEMBERS,
  member,
  memberCard,
  memberProfile,
  myEmail,
  myProfileAs,
} from "./people";

/**
 * Fictional data for the App Review demo account (src/server/lib/demo/
 * session.ts): what each API route answers it. `undefined` = no fixture:
 * a GET then answers 404, a write a plain { ok: true } — never real data.
 *
 * Everything here is static and made up (people.ts, content.ts); nothing
 * reads the database or calls the real handlers, and writes change
 * nothing (a few answer with the change applied, so the screens react).
 */

export { DEMO_USER_ID };

/** The demo's language and push registration (per server instance). */
const state: {
  locale: Locale;
  push: PushState["device"];
} = { locale: "en", push: null };

export function demoMe(): Me {
  return {
    user: {
      id: DEMO_USER_ID,
      state: "ACTIVE",
      locale: state.locale,
      isAdmin: false,
      name: ME.name,
      otherName: null,
      email: myEmail(),
      avatar: ME.avatar,
      lineLinked: false,
    },
    onboardingPath: null,
    access: { admin: false, broadcast: false, teachers: false, news: false },
    badges: { news: 1, messages: 0, chat: 2, follows: 1, inbox: 2 },
    realtime: null,
    features: { messages: true },
  } satisfies Me;
}

const OK = { ok: true } as const;

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const b: unknown = await request.clone().json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// ---- Home ----

function home(): Home {
  const setup: Home["setup"]["items"] = [
    {
      key: "email",
      done: true,
      href: null,
      optional: false,
      recommended: false,
    },
    {
      key: "apply",
      done: true,
      href: "/app/onboarding/verify",
      optional: false,
      recommended: false,
    },
    {
      key: "approval",
      done: true,
      href: null,
      optional: false,
      recommended: false,
    },
    {
      key: "names",
      done: false,
      href: "/app/profile#edit-name",
      optional: true,
      recommended: true,
    },
    {
      key: "photo",
      done: true,
      href: "/app/profile#edit-photo",
      optional: false,
      recommended: false,
    },
    {
      key: "bio",
      done: true,
      href: "/app/profile#edit-about",
      optional: false,
      recommended: false,
    },
    {
      key: "history",
      done: true,
      href: "/app/profile/history",
      optional: false,
      recommended: false,
    },
    {
      key: "follow",
      done: true,
      href: "/app/directory",
      optional: false,
      recommended: false,
    },
    {
      key: "family",
      done: false,
      href: "/app/family",
      optional: true,
      recommended: false,
    },
  ];
  const required = setup.filter((i) => !i.optional);
  return {
    todo: { followRequests: 1, vouches: [], family: [] },
    setup: {
      items: setup,
      done: required.filter((i) => i.done).length,
      total: required.length,
      complete: true,
    },
    line: null,
    unreadMessages: 0,
    events: homeEvents().slice(0, 3),
    news: homeNews(),
  } satisfies Home;
}

// ---- People ----

const COHORTS = Array.from({ length: 12 }, (_, i) => {
  const n = 12 - i;
  return { n, label: `Class ${n} (graduated ${2011 + n})` };
});

function directoryOptions(): DirectoryOptions {
  return {
    roles: [
      "TEACHER",
      "CURRENT_STUDENT",
      "CURRENT_PARENT",
      "GRADUATE",
      "FORMER_STUDENT",
      "FORMER_PARENT",
    ],
    defaultRole: "FORMER_STUDENT",
    allRoles: "all",
    divisions: ["KINDERGARTEN", "ELEMENTARY"],
    stages: [
      "ELEMENTARY",
      "JUNIOR_HIGH",
      "HIGH_SCHOOL",
      "UNIVERSITY_COLLEGE",
      "WORKING",
    ],
    cohorts: [...COHORTS]
      .reverse()
      .map((c) => ({ id: `demo-cohort-${c.n}`, label: c.label })),
    minYear: 1950,
    maxYear: 2100,
  } satisfies DirectoryOptions;
}

function directory(q: URLSearchParams): DirectoryPage {
  const text = q.get("q")?.trim().slice(0, 100) || null;
  const role = q.get("role") || "FORMER_STUDENT";
  const year = (k: string) => {
    const n = Number(q.get(k));
    return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : null;
  };
  const from = year("from");
  const to = year("to");
  const division = q.get("division") || null;
  const stage = q.get("stage") || null;
  const cohort = q.get("cohort") || null;
  const items = MEMBERS.filter((x) => {
    if (role === "FORMER_STUDENT" && x.role !== "FORMER_STUDENT") return false;
    if (role === "GRADUATE" && !(x.role === "FORMER_STUDENT" && x.graduated))
      return false;
    if (role === "TEACHER" && x.role !== "TEACHER") return false;
    if (role === "FORMER_PARENT" && x.role !== "FORMER_PARENT") return false;
    if (role === "CURRENT_STUDENT" || role === "CURRENT_PARENT") return false;
    if (text) {
      const hay = `${x.name} ${x.kanji ?? ""} ${x.kana ?? ""}`.toLowerCase();
      if (!hay.includes(text.toLowerCase())) return false;
    }
    if (
      (from || to) &&
      (x.year === null || (from && x.year < from) || (to && x.year > to))
    )
      return false;
    if (division && !(division === "ELEMENTARY" && x.role === "FORMER_STUDENT"))
      return false;
    if (stage && x.stage !== stage) return false;
    if (cohort && `demo-cohort-${x.cohort}` !== cohort) return false;
    return true;
  })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(memberCard);
  return {
    items,
    nextCursor: null,
    total: items.length,
    filters: { q: text, role, from, to, division, stage, cohort },
    filtered: Boolean(
      text ||
        from ||
        to ||
        division ||
        stage ||
        cohort ||
        role !== "FORMER_STUDENT",
    ),
  } satisfies DirectoryPage;
}

function follows(q: URLSearchParams): FollowLists {
  const card = (id: string) => memberCard(member(id) ?? MEMBERS[0]);
  const acceptedId = q.get("accepted");
  return {
    incoming: [
      {
        followId: "demo-follow-daniel",
        requestedAt: ago(2 * 3_600_000),
        member: card("demo-m-daniel"),
      },
    ],
    outgoing: [
      {
        followId: "demo-follow-marco",
        requestedAt: ago(3 * 86_400_000),
        member: card("demo-m-marco"),
      },
    ],
    followers: [
      {
        followId: "demo-follower-emily",
        member: card("demo-m-emily"),
        followState: "following",
      },
      {
        followId: "demo-follower-kenji",
        member: card("demo-m-kenji"),
        followState: "following",
      },
      {
        followId: "demo-follower-sophie",
        member: card("demo-m-sophie"),
        followState: "followBack",
      },
    ],
    following: [
      { followId: "demo-following-emily", member: card("demo-m-emily") },
      { followId: "demo-following-kenji", member: card("demo-m-kenji") },
      { followId: "demo-following-yui", member: card("demo-m-yui") },
    ],
    blocked: [],
    accepted:
      acceptedId === "demo-follow-daniel"
        ? { member: card("demo-m-daniel"), followState: "followBack" }
        : null,
  } satisfies FollowLists;
}

// ---- Account ----

function myProfile(): MyProfile {
  return {
    id: DEMO_USER_ID,
    name: ME.name,
    otherName: null,
    nameAtAis: null,
    avatar: ME.avatar,
    roles: [
      {
        role: "FORMER_STUDENT",
        label: "Former student / Alumni",
        facts: ["Class 3", "Class of 2014", "Elementary"],
        subjects: null,
      },
    ],
    follows: { followers: 3, following: 3, requests: 1 },
    about: {
      bio: ME.bio,
      phone: null,
      phoneReach: "self",
      social: [],
      autoAcceptSameYear: true,
    },
    directoryListed: null,
    photo: { public: true, reach: "members", uploaded: false },
    sharedWithFollowers: ["currentStageDetail"],
    history: {
      education: [
        {
          id: "demo-me-edu-0",
          school: "Lakeside University",
          level: "UNIVERSITY",
          field: "Computer Science",
          startYear: 2020,
          endYear: 2024,
          ongoing: false,
          reach: "members",
        },
      ],
      work: [
        {
          id: "demo-me-work-0",
          company: "Example Apps Inc.",
          title: "Software Engineer",
          industry: "Software & telecommunications › Software",
          jobType: "IT & web › Programmer & software development",
          startYear: 2024,
          endYear: null,
          ongoing: true,
          reach: "members",
        },
      ],
    },
    currentStage: {
      stage: "WORKING",
      detail: ME.stageDetail,
      detailReach: "followers",
    },
    names: {
      romaji: ME.name,
      kanji: null,
      kana: null,
      nameAtAis: null,
      request: null,
      parts: {
        lastNameRomaji: "App",
        firstNameRomaji: "Reviewer",
        middleNameRomaji: "",
        lastNameKanji: "",
        firstNameKanji: "",
        lastNameKana: "",
        firstNameKana: "",
      },
    },
    birthDate: { value: null, request: null },
    gender: { value: null, request: null },
    account: {
      email: myEmail(),
      emailReach: "self",
      lineDisplayName: null,
      lineReach: "self",
    },
  } satisfies MyProfile;
}

const CATEGORIES = [
  "account",
  "news",
  "events",
  "chat",
  "social",
  "family",
  "profile",
  "admin",
];
let notifyOff: string[] = [];
let notifyVia: NotifyVia = "AUTO";

function settings(): MySettings {
  return {
    locale: state.locale,
    email: myEmail(),
    notify: {
      via: notifyVia,
      route: state.push?.enabled ? "PUSH" : "EMAIL",
      categories: CATEGORIES.map((key) => ({
        key,
        on: key === "account" || !notifyOff.includes(key),
        locked: key === "account",
      })),
    },
    line: {
      linked: false,
      following: false,
      displayName: null,
      addFriendUrl: null,
      linkReady: false,
    },
    adminMode: [],
    schoolEmail: null,
    signInMethods: [
      {
        method: "email",
        linked: true,
        removable: false,
        ready: true,
        addable: false,
      },
      {
        method: "line",
        linked: false,
        removable: false,
        ready: false,
        addable: false,
      },
    ],
  } satisfies MySettings;
}

function devices(): DeviceList {
  return {
    devices: [
      {
        id: "demo-device-current",
        platform: "ios",
        deviceName: "iPhone",
        createdAt: ago(3_600_000),
        lastUsedAt: new Date().toISOString(),
        current: true,
      },
    ],
  } satisfies DeviceList;
}

function pushState(): PushState {
  return {
    devTokens: false,
    device: state.push,
    otherDevices: 0,
  } satisfies PushState;
}

function historyEditor(): HistoryEditor {
  const label = (x: { ja: string; en: string }) =>
    state.locale === "en" ? x.en : x.ja;
  const twoLevel = (list: typeof INDUSTRIES) =>
    list.map((g) => ({
      code: g.code,
      label: label(g),
      children: g.children.map((c) => ({ code: c.code, label: label(c) })),
    }));
  return {
    education: [
      {
        id: "demo-me-edu-0",
        level: "UNIVERSITY",
        school: { id: "demo-org-lakeside", name: "Lakeside University" },
        field: "Computer Science",
        startYear: 2020,
        endYear: 2024,
        visibility: "MEMBERS",
        current: false,
      },
    ],
    work: [
      {
        id: "demo-me-work-0",
        company: { id: "demo-org-example-apps", name: "Example Apps Inc." },
        title: "Software Engineer",
        industry: "ICT-01",
        jobType: "IT-02",
        industryLabel: "Software & telecommunications › Software",
        jobTypeLabel: "IT & web › Programmer & software development",
        startYear: 2024,
        endYear: null,
        visibility: "MEMBERS",
        current: true,
      },
    ],
    multipleCurrent: null,
    industries: twoLevel(INDUSTRIES),
    jobTypes: twoLevel(JOB_TYPES),
  } satisfies HistoryEditor;
}

function recordPage(): RecordPage {
  return {
    roles: [
      {
        role: "FORMER_STUDENT",
        label: "Former student / Alumni",
        rows: [
          { field: "cohort", value: "Class 3", stillTeaching: false },
          { field: "yearsFrom", value: "2008", stillTeaching: false },
          { field: "yearsTo", value: "2014", stillTeaching: false },
        ],
        fields: ["cohort", "yearsFrom", "yearsTo"],
        values: { cohort: "3", yearsFrom: "2008", yearsTo: "2014" },
        pending: null,
      },
    ],
    cohorts: COHORTS.map((c) => ({
      value: String(c.n),
      label: c.label,
      graduated: true,
    })),
    history: [],
  } satisfies RecordPage;
}

const cohortChoices = (): CohortChoice[] =>
  COHORTS.map((c) => ({ value: String(c.n), label: c.label }));

function family(): FamilyPage {
  return {
    canClaimChild: false,
    canClaimParent: true,
    toConfirm: [],
    managed: [],
    members: [],
    links: [],
    cohorts: cohortChoices(),
  } satisfies FamilyPage;
}

function invites(): InvitesPage {
  return {
    cohorts: cohortChoices(),
    invites: [
      {
        id: "demo-invite-1",
        kind: "INDIVIDUAL",
        type: "STUDENT",
        inviteeName: "Hana Sato",
        cohortLabel: "Class 3",
        createdAt: ago(2 * 86_400_000),
        usedByName: null,
        uses: 0,
        maxUses: 1,
        usedByNames: [],
        status: "open",
      },
      {
        id: "demo-invite-2",
        kind: "INDIVIDUAL",
        type: "STUDENT",
        inviteeName: "Yui Hasegawa",
        cohortLabel: "Class 4",
        createdAt: ago(15 * 86_400_000),
        usedByName: "Yui Hasegawa",
        uses: 1,
        maxUses: 1,
        usedByNames: ["Yui Hasegawa"],
        status: "used",
      },
    ],
  } satisfies InvitesPage;
}

/** GET /me/export: the demo account's own (fictional) data. */
function exportData() {
  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: DEMO_USER_ID,
      name: ME.name,
      email: myEmail(),
      state: "ACTIVE",
    },
    profile: myProfile(),
    settings: settings(),
  };
}

// ---- The router ----

type Handler = (ctx: {
  params: Record<string, string>;
  query: URLSearchParams;
  request: Request;
}) => unknown | Promise<unknown>;

const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  me: { GET: () => demoMe() },
  "me/export": { GET: () => exportData() },
  home: {
    GET: () => home(),
    // no-ops: nothing to dismiss / link
  },
  support: {
    GET: () => ({ name: ME.name, email: myEmail() }) satisfies SupportDefaults,
    POST: () => ({ ref: "DEMO-0001" }) satisfies SupportSent,
  },

  // News
  news: {
    GET: ({ query }) => {
      const page = Math.max(1, Number(query.get("page")) || 1);
      return {
        page,
        posts: page === 1 ? newsSummaries() : [],
        hasNext: false,
        canCreate: false,
      } satisfies NewsList;
    },
  },
  "news/[id]": {
    GET: ({ params }) => newsDetail(params.id) satisfies NewsDetail | undefined,
  },
  "news/[id]/confirm": { POST: () => OK satisfies NewsHubOk },
  "news/[id]/vote": { POST: () => OK satisfies NewsHubOk },
  "news/[id]/reactions": { POST: () => OK satisfies NewsHubOk },
  "news/[id]/comments": { POST: () => OK satisfies NewsHubOk },
  "news/[id]/comments/[commentId]": { DELETE: () => OK satisfies NewsHubOk },
  "news/messages": {
    GET: ({ query }) => {
      const page = Math.max(1, Number(query.get("page")) || 1);
      return {
        page,
        hasNext: false,
        messages: page === 1 ? messageSummaries() : [],
      } satisfies MessageList;
    },
  },
  "news/messages/[id]": {
    GET: ({ params }) =>
      messageDetail(params.id) satisfies MessageDetail | undefined,
  },

  // Events
  events: {
    GET: ({ query }) => {
      const tab = query.get("tab") === "past" ? "past" : "upcoming";
      const page = Math.max(1, Number(query.get("page")) || 1);
      return {
        tab,
        page,
        hasNext: false,
        events: page === 1 ? eventList(tab) : [],
        canCreate: false,
      } satisfies EventList;
    },
  },
  "events/[id]": {
    GET: async ({ params }) =>
      (await eventDetail(params.id)) satisfies EventDetail | undefined,
  },
  "events/[id]/rsvp": {
    POST: async ({ params, request }) => {
      const b = await readBody(request);
      const answers: RsvpAnswer[] = ["GOING", "MAYBE", "NOT_GOING"];
      const answer = answers.find((a) => a === b.answer) ?? "GOING";
      const guests = typeof b.guests === "number" ? b.guests : 0;
      const event = await eventDetail(params.id, { answer, guests });
      return event ? ({ ok: true, event } satisfies RsvpResult) : undefined;
    },
  },

  // People
  directory: { GET: ({ query }) => directory(query) },
  "directory/options": { GET: () => directoryOptions() },
  "members/[id]": {
    GET: ({ params, query }) => {
      if (params.id === DEMO_USER_ID) {
        const as = query.get("as");
        return as === "members" || as === "followers" || as === "family"
          ? myProfileAs(as)
          : undefined;
      }
      const x = member(params.id);
      return x ? (memberProfile(x) satisfies MemberProfile) : undefined;
    },
  },
  "members/[id]/follow": {
    POST: ({ params }) => {
      const x = member(params.id);
      if (!x) return undefined;
      return {
        status: x.followsYou ? "ACCEPTED" : "REQUESTED",
      } satisfies FollowResult;
    },
    DELETE: () => OK satisfies Ok,
  },
  "members/[id]/block": {
    POST: () => OK satisfies Ok,
    DELETE: () => OK satisfies Ok,
  },
  follows: { GET: ({ query }) => follows(query) },
  "follows/requests/[followId]/accept": {
    POST: () => ({ accepted: true }) satisfies AcceptResult,
  },
  "follows/requests/[followId]/decline": { POST: () => OK satisfies Ok },
  "follows/followers/[userId]": { DELETE: () => OK satisfies Ok },

  // Chat
  chat: { GET: () => chatList() satisfies ChatList },
  "chat/direct": {
    GET: () =>
      ({
        available: true,
        people: MEMBERS.filter(
          (x) => x.follow === "following" && x.followsYou,
        ).map((x) => ({
          id: x.id,
          name: x.name,
          kanji: x.kanji,
          avatar: memberCard(x).avatar,
        })),
      }) satisfies DirectCandidates,
    POST: async ({ request }) => {
      const groupId = directChatId(str((await readBody(request)).userId));
      return groupId ? ({ groupId } satisfies StartDirectResult) : undefined;
    },
  },
  "chat/[id]": {
    GET: ({ params }) => chatRoom(params.id) satisfies ChatRoom | undefined,
  },
  "chat/[id]/info": {
    GET: ({ params }) => chatInfo(params.id) satisfies ChatInfo | undefined,
  },
  "chat/[id]/messages": {
    GET: ({ params }) =>
      chatRoom(params.id)
        ? ({ messages: [], hasMore: false } satisfies ChatMessagesPage)
        : undefined,
    POST: async ({ params, request }) => {
      if (!chatRoom(params.id)) return undefined;
      const body = str((await readBody(request)).body)
        .trim()
        .slice(0, 2000);
      return { message: sentMessage(body) } satisfies SendMessageResult;
    },
  },
  "chat/[id]/messages/[messageId]": { DELETE: () => OK satisfies OkResult },
  "chat/[id]/read": {
    GET: ({ params }) => ({ reads: chatReads(params.id) }) satisfies ChatReads,
    POST: () => OK satisfies OkResult,
  },
  "chat/[id]/mute": {
    PUT: async ({ request }) =>
      ({
        muted: (await readBody(request)).muted === true,
      }) satisfies MuteResult,
  },
  "chat/[id]/notifications": {
    PUT: async ({ request }) => {
      const level = (await readBody(request)).level;
      const levels: ChatNotifyLevel[] = ["all", "mentions", "off"];
      return {
        level: levels.find((l) => l === level) ?? "mentions",
      } satisfies ChatNotifyResult;
    },
  },
  "chat/[id]/report": {
    POST: () => ({ ref: "DEMO-R-0001" }) satisfies ReportResult,
  },

  // Notifications and push
  notifications: {
    GET: ({ query }) => {
      const items = query.get("cursor") ? [] : inboxItems();
      return {
        items,
        nextCursor: null,
        unread: items.filter((i) => !i.read).length,
      } satisfies InboxPage;
    },
  },
  "notifications/read": {
    POST: () => ({ unread: 0 }) satisfies InboxReadResult,
  },
  "notifications/open": {
    POST: async ({ request }) => {
      const id = str((await readBody(request)).id);
      return {
        path: inboxItems().find((i) => i.id === id)?.path ?? null,
      } satisfies InboxOpenResult;
    },
  },
  push: {
    GET: () => pushState(),
    PUT: async ({ request }) => {
      const b = await readBody(request);
      state.push = {
        enabled: b.enabled !== false,
        platform: b.platform === "android" ? "android" : "ios",
        failed: false,
        since: state.push?.since ?? new Date().toISOString(),
      };
      return pushState();
    },
    DELETE: () => {
      state.push = null;
      return pushState();
    },
  },
  "push/test": { POST: () => OK satisfies PushTestResult },

  // Settings
  settings: { GET: () => settings() },
  "settings/language": {
    PUT: async ({ request }) => {
      const locale = (await readBody(request)).locale;
      if (locale === "ja" || locale === "en") state.locale = locale;
      return settings();
    },
  },
  "settings/notifications": {
    PATCH: async ({ request }) => {
      const b = await readBody(request);
      if (b.via === "AUTO" || b.via === "EMAIL_ONLY") notifyVia = b.via;
      if (Array.isArray(b.on)) {
        const on = new Set(b.on.map(str));
        notifyOff = CATEGORIES.filter((c) => c !== "account" && !on.has(c));
      }
      return settings();
    },
  },
  "settings/devices": {
    GET: () => devices(),
    DELETE: () => ({ removed: 0 }),
  },
  "settings/devices/[id]": { DELETE: () => OK },
  "settings/email": {
    POST: async ({ request }) =>
      ({
        ok: false,
        error: "The email address of the demo account can't be changed.",
        step: "email",
        email: str((await readBody(request)).email),
      }) satisfies EmailChangeState,
  },
  "settings/school-email": {
    POST: () => ({ ok: false, error: "forbidden" }) satisfies SchoolEmailResult,
  },
  "settings/school-email/verify": {
    POST: () => ({ ok: false, error: "forbidden" }) satisfies SchoolEmailResult,
  },
  "settings/sign-in/[provider]": {
    DELETE: () =>
      ({
        error: "Sign-in methods of the demo account can't be changed.",
      }) satisfies SettingsResult,
  },
  "settings/deactivate": { POST: () => OK satisfies SettingsResult },
  "settings/delete": { POST: () => OK satisfies SettingsResult },

  // My profile
  profile: { GET: () => myProfile() },
  "profile/about": { PUT: () => ({ message: "saved" }) satisfies FormOk },
  "profile/directory": { PUT: () => ({ message: "saved" }) satisfies FormOk },
  "profile/follower-fields": {
    PUT: () => ({ message: "saved" }) satisfies FormOk,
  },
  "profile/photo": {
    POST: () => ({ message: "photoUploaded" }) satisfies FormOk,
    DELETE: () => OK satisfies Ok,
  },
  "profile/photo/visibility": {
    PUT: () => ({ message: "saved" }) satisfies FormOk,
  },
  "profile/history": {
    GET: () => historyEditor(),
    POST: async ({ request }) =>
      ({
        message: (await readBody(request)).id ? "saved" : "added",
      }) satisfies FormOk,
  },
  "profile/history/[kind]/[id]": { DELETE: () => OK satisfies Ok },
  "profile/orgs": {
    GET: ({ query }) => {
      const kind = query.get("kind") === "company" ? "company" : "school";
      const q = (query.get("q") ?? "").toLowerCase();
      const all =
        kind === "school"
          ? [
              {
                id: "demo-org-lakeside",
                name: "Lakeside University",
                count: 4,
              },
              {
                id: "demo-org-northfield",
                name: "Northfield University",
                count: 3,
              },
              {
                id: "demo-org-chubu-tech",
                name: "Chubu Institute of Technology",
                count: 2,
              },
            ]
          : [
              {
                id: "demo-org-example-apps",
                name: "Example Apps Inc.",
                count: 2,
              },
              {
                id: "demo-org-sakura",
                name: "Sakura Digital Studio",
                count: 1,
              },
              { id: "demo-org-aoba", name: "Aoba Motors", count: 3 },
            ];
      return {
        options: all.filter((o) => o.name.toLowerCase().includes(q)),
      } satisfies OrgSearch;
    },
  },
  "profile/record": {
    GET: () => recordPage(),
    POST: () => ({ message: "submitted" }) satisfies FormOk,
  },
  "profile/record/[id]": { DELETE: () => OK satisfies Ok },
  "profile/name-request": {
    POST: () => ({ message: "nameRequest.submitted" }) satisfies FormOk,
  },
  "profile/name-request/[id]": { DELETE: () => OK satisfies Ok },
  "profile/birth-date-request": {
    POST: () => ({ message: "birthDate.submitted" }) satisfies FormOk,
  },
  "profile/birth-date-request/[id]": { DELETE: () => OK satisfies Ok },
  "profile/gender-request": {
    POST: () => ({ message: "gender.submitted" }) satisfies FormOk,
  },
  "profile/gender-request/[id]": { DELETE: () => OK satisfies Ok },
  "profile/gender": {
    POST: () => ({ message: "gender.saved" }) satisfies FormOk,
  },

  // Family and invites
  family: { GET: () => family() },
  "family/search": { GET: () => ({ items: [] }) satisfies FamilySearch },
  "family/links": {
    POST: () =>
      ({ ok: true, message: "sentAdmin" }) satisfies FamilyClaimResult,
  },
  "family/children": {
    POST: () =>
      ({ ok: true, message: "sentAdmin" }) satisfies FamilyClaimResult,
  },
  invites: {
    GET: () => invites(),
    POST: async ({ request }) =>
      ({
        url: `${new URL(request.url).origin}/invite/demo-invitation`,
        kind:
          (await readBody(request)).kind === "GRADE" ? "GRADE" : "INDIVIDUAL",
      }) satisfies InviteCreated,
  },
  "invites/[id]/revoke": { POST: () => OK satisfies Ok },
};

export async function demoResponse(
  method: string,
  route: string,
  params: Record<string, string>,
  request: Request,
): Promise<unknown | undefined> {
  const handler = ROUTES[route]?.[method];
  if (!handler) return undefined;
  return handler({ params, query: new URL(request.url).searchParams, request });
}
