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
  ChatReactionsResult,
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
  chatInfo,
  chatList,
  chatReads,
  chatRoom,
  demoMessageReactions,
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
  toggleDemoReaction,
} from "./content";
import { demoData, derive, isoAgo } from "./data";
import {
  DEMO_USER_ID,
  type DemoMember,
  me,
  member,
  memberCard,
  memberProfile,
  members,
  myEmail,
  myProfileAs,
  personName,
} from "./people";

/**
 * Fictional data for the App Review demo account (src/server/lib/demo/
 * session.ts): what each API route answers it. `undefined` = no fixture:
 * a GET then answers 404, a write a plain { ok: true } — never real data.
 *
 * The content is in data/*.json (see data/README.md), all made up; nothing
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
      name: me().name,
      otherName: null,
      email: myEmail(),
      avatar: me().avatar,
      lineLinked: false,
    },
    onboardingPath: null,
    access: { admin: false, broadcast: false, teachers: false, news: false },
    badges: demoData().me.badges,
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

/** Where each checklist task is done, and how it counts (src/server/lib/setup.ts). */
const SETUP_ITEMS: Record<
  Home["setup"]["items"][number]["key"],
  { href: string | null; optional?: boolean; recommended?: boolean }
> = {
  email: { href: null },
  apply: { href: "/app/onboarding/verify" },
  approval: { href: null },
  line: { href: "/app/settings#line" },
  names: { href: "/app/profile#edit-name", optional: true, recommended: true },
  schoolEmail: { href: "/app/settings#school-email" },
  photo: { href: "/app/profile#edit-photo" },
  bio: { href: "/app/profile#edit-about" },
  history: { href: "/app/profile/history" },
  follow: { href: "/app/directory" },
  family: { href: "/app/family", optional: true },
};

function home(): Home {
  const setup: Home["setup"]["items"] = demoData().me.setupChecklist.map(
    (i) => ({
      key: i.key,
      done: i.done,
      href: SETUP_ITEMS[i.key].href,
      optional: SETUP_ITEMS[i.key].optional ?? false,
      recommended: SETUP_ITEMS[i.key].recommended ?? false,
    }),
  );
  const required = setup.filter((i) => !i.optional);
  return {
    todo: {
      followRequests: demoData().follows.requestsToMe.length,
      vouches: [],
      family: [],
    },
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

/** 学年 (data/school.json), newest first. */
const cohorts = derive((d) =>
  Array.from({ length: d.school.latestClass }, (_, i) => {
    const n = d.school.latestClass - i;
    return {
      n,
      label: `Class ${n} (graduated ${d.school.class1GraduationYear - 1 + n})`,
    };
  }),
);
const classLabel = (n: number | null) => (n ? `Class ${n}` : null);

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
    cohorts: [...cohorts()]
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
  const items = members()
    .filter((x) => {
      if (role === "FORMER_STUDENT" && x.role !== "FORMER_STUDENT")
        return false;
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
      if (
        division &&
        !(division === "ELEMENTARY" && x.role === "FORMER_STUDENT")
      )
        return false;
      if (stage && x.stage !== stage) return false;
      if (cohort && `demo-cohort-${x.classNumber}` !== cohort) return false;
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

/** Follow ids: "demo-follow-<name>" for member "demo-m-<name>". */
const shortId = (memberId: string) => memberId.replace(/^demo-m-/, "");

function follows(q: URLSearchParams): FollowLists {
  const known = (id: string) => member(id) as DemoMember;
  const acceptedId = q.get("accepted");
  const accepted = demoData().follows.requestsToMe.find(
    (r) => `demo-follow-${shortId(r.memberId)}` === acceptedId,
  );
  return {
    incoming: demoData().follows.requestsToMe.map((r) => ({
      followId: `demo-follow-${shortId(r.memberId)}`,
      requestedAt: isoAgo(r.requested),
      member: memberCard(known(r.memberId)),
    })),
    outgoing: demoData().follows.myRequests.map((r) => ({
      followId: `demo-follow-${shortId(r.memberId)}`,
      requestedAt: isoAgo(r.requested),
      member: memberCard(known(r.memberId)),
    })),
    followers: demoData().follows.followMe.map((id) => ({
      followId: `demo-follower-${shortId(id)}`,
      member: memberCard(known(id)),
      followState: known(id).follow,
    })),
    following: demoData().follows.iFollow.map((id) => ({
      followId: `demo-following-${shortId(id)}`,
      member: memberCard(known(id)),
    })),
    blocked: [],
    accepted: accepted
      ? {
          member: memberCard(known(accepted.memberId)),
          followState: "followBack",
        }
      : null,
  } satisfies FollowLists;
}

// ---- Account ----

function myProfile(): MyProfile {
  return {
    id: DEMO_USER_ID,
    name: me().name,
    otherName: null,
    nameAtAis: null,
    avatar: me().avatar,
    roles: [
      {
        role: "FORMER_STUDENT",
        label: me().roleLabel,
        facts: me().facts,
        subjects: null,
      },
    ],
    follows: {
      followers: demoData().follows.followMe.length,
      following: demoData().follows.iFollow.length,
      requests: demoData().follows.requestsToMe.length,
    },
    about: {
      bio: me().bio,
      phone: null,
      phoneReach: "self",
      social: [],
      autoAcceptSameYear: true,
    },
    directoryListed: null,
    photo: { public: true, reach: "members", uploaded: false },
    sharedWithFollowers: ["currentStageDetail"],
    history: {
      education: me().education.map((e) => ({
        id: e.id,
        school: e.school,
        level: e.level,
        field: e.field,
        startYear: e.startYear,
        endYear: e.endYear,
        ongoing: e.endYear === null,
        reach: "members",
      })),
      work: me().work.map((w) => ({
        id: w.id,
        company: w.company,
        title: w.title,
        industry: w.industryLabel,
        jobType: w.jobTypeLabel,
        startYear: w.startYear,
        endYear: w.endYear,
        ongoing: w.endYear === null,
        reach: "members",
      })),
    },
    currentStage: {
      stage: me().stage,
      detail: me().stageDetail,
      detailReach: "followers",
    },
    names: {
      romaji: me().name,
      kanji: null,
      kana: null,
      nameAtAis: null,
      request: null,
      parts: {
        lastNameRomaji: demoData().me.lastName,
        firstNameRomaji: demoData().me.firstName,
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
        platform: demoData().me.device.platform,
        deviceName: demoData().me.device.name,
        createdAt: isoAgo(demoData().me.device.signedIn),
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
    education: me().education.map((e) => ({
      id: e.id,
      level: e.level,
      school: { id: e.schoolOrgId, name: e.school },
      field: e.field,
      startYear: e.startYear,
      endYear: e.endYear,
      visibility: "MEMBERS",
      current: e.endYear === null,
    })),
    work: me().work.map((w) => ({
      id: w.id,
      company: { id: w.companyOrgId, name: w.company },
      title: w.title,
      industry: w.industry,
      jobType: w.jobType,
      industryLabel: w.industryLabel,
      jobTypeLabel: w.jobTypeLabel,
      startYear: w.startYear,
      endYear: w.endYear,
      visibility: "MEMBERS",
      current: w.endYear === null,
    })),
    multipleCurrent: null,
    industries: twoLevel(INDUSTRIES),
    jobTypes: twoLevel(JOB_TYPES),
  } satisfies HistoryEditor;
}

function recordPage(): RecordPage {
  const values = {
    cohort: String(demoData().me.classNumber),
    yearsFrom: String(demoData().me.atAisFrom),
    yearsTo: String(demoData().me.graduationYear),
  };
  return {
    roles: [
      {
        role: "FORMER_STUDENT",
        label: me().roleLabel,
        rows: [
          {
            field: "cohort",
            value: `Class ${values.cohort}`,
            stillTeaching: false,
          },
          { field: "yearsFrom", value: values.yearsFrom, stillTeaching: false },
          { field: "yearsTo", value: values.yearsTo, stillTeaching: false },
        ],
        fields: ["cohort", "yearsFrom", "yearsTo"],
        values,
        pending: null,
      },
    ],
    cohorts: cohorts().map((c) => ({
      value: String(c.n),
      label: c.label,
      graduated: true,
    })),
    history: [],
  } satisfies RecordPage;
}

const cohortChoices = (): CohortChoice[] =>
  cohorts().map((c) => ({ value: String(c.n), label: c.label }));

function family(): FamilyPage {
  return {
    canClaimChild: demoData().family.canAddChild,
    canClaimParent: demoData().family.canAddParent,
    toConfirm: [],
    managed: [],
    members: demoData().family.memberIds.map((id) =>
      memberCard(member(id) as DemoMember),
    ),
    links: [],
    cohorts: cohortChoices(),
  } satisfies FamilyPage;
}

function invites(): InvitesPage {
  return {
    cohorts: cohortChoices(),
    invites: demoData().invites.map((inv) => {
      const usedBy = inv.usedById ? personName(inv.usedById) : null;
      return {
        id: inv.id,
        kind: inv.kind,
        type: inv.type,
        inviteeName: inv.inviteeName,
        cohortLabel: classLabel(inv.classNumber),
        createdAt: isoAgo(inv.created),
        usedByName: inv.kind === "INDIVIDUAL" ? usedBy : null,
        uses: usedBy ? 1 : 0,
        maxUses: 1,
        usedByNames: usedBy ? [usedBy] : [],
        status: inv.status,
      };
    }),
  } satisfies InvitesPage;
}

/** GET /me/export: the demo account's own (fictional) data. */
function exportData() {
  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: DEMO_USER_ID,
      name: me().name,
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
    GET: () =>
      ({ name: me().name, email: myEmail() }) satisfies SupportDefaults,
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
        people: members()
          .filter((x) => x.follow === "following" && x.followsYou)
          .map((x) => ({
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
  "chat/[id]/messages/[messageId]/reactions": {
    GET: ({ params }) =>
      demoMessageReactions(params.id, params.messageId) satisfies
        | ChatReactionsResult
        | undefined,
    POST: async ({ params, request }) =>
      toggleDemoReaction(
        params.id,
        params.messageId,
        str((await readBody(request)).emoji),
      ) satisfies ChatReactionsResult | undefined,
  },
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
        kind === "school" ? demoData().orgs.schools : demoData().orgs.companies;
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
