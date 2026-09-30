import { z } from "zod";
import { isReactionEmoji } from "@/server/lib/chat-emoji";
import chatsJson from "./data/chats.json";
import eventsJson from "./data/events.json";
import familyJson from "./data/family.json";
import followsJson from "./data/follows.json";
import invitesJson from "./data/invites.json";
import meJson from "./data/me.json";
import membersJson from "./data/members.json";
import messagesJson from "./data/messages.json";
import newsJson from "./data/news.json";
import notificationsJson from "./data/notifications.json";
import orgsJson from "./data/orgs.json";
import schoolJson from "./data/school.json";

/**
 * The demo's content (data/*.json, see data/README.md), checked when the
 * first demo request (demoData()): a bad edit fails loudly, naming the file
 * and field, instead of producing a broken response. Times in the files are relative to now;
 * the helpers at the bottom turn them into ISO strings at request time.
 */

// ---- Relative times ----

/** A moment in the past: { "daysAgo", "hoursAgo", "minutesAgo" } (added up). */
const Ago = z
  .strictObject({
    daysAgo: z.number().nonnegative().optional(),
    hoursAgo: z.number().nonnegative().optional(),
    minutesAgo: z.number().nonnegative().optional(),
  })
  .refine(
    (a) =>
      a.daysAgo !== undefined ||
      a.hoursAgo !== undefined ||
      a.minutesAgo !== undefined,
    "give daysAgo, hoursAgo and/or minutesAgo",
  );
export type Ago = z.infer<typeof Ago>;

/** A day and time in Japan: { "inDays": 3 (negative = past), "time": "18:00" }. */
const OnDay = z.strictObject({
  inDays: z.number().int(),
  time: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      'time must be "HH:MM" (24-hour, Japan time)',
    ),
});
export type OnDay = z.infer<typeof OnDay>;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function agoMs(a: Ago): number {
  return (
    (a.daysAgo ?? 0) * DAY +
    (a.hoursAgo ?? 0) * HOUR +
    (a.minutesAgo ?? 0) * MIN
  );
}

/** ISO time of a past moment, from now. */
export const isoAgo = (a: Ago): string =>
  new Date(Date.now() - agoMs(a)).toISOString();

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

export function isoOnDay(d: OnDay): string {
  const [h, m] = d.time.split(":").map(Number);
  return jstDay(d.inDays, h, m);
}

// ---- Schemas ----

/** Markdown / plain text: one string, or a list of lines. */
const Text = z
  .union([z.string(), z.array(z.string())])
  .transform((t) => (Array.isArray(t) ? t.join("\n") : t));
const Id = z.string().min(1);
const Year = z.number().int().min(1950).max(2100);
/** A member's id, or "me" for the demo account. */
const PersonId = Id;

const MemberSchema = z.strictObject({
  id: Id,
  name: z.string().min(1),
  kanji: z.string().nullable().default(null),
  kana: z.string().nullable().default(null),
  gender: z.enum(["MALE", "FEMALE"]).nullable().default(null),
  role: z.enum(["FORMER_STUDENT", "TEACHER", "FORMER_PARENT"]),
  classNumber: z.number().int().positive().nullable().default(null),
  year: Year.nullable().default(null),
  graduated: z.boolean().default(true),
  stage: z.enum(["WORKING", "UNIVERSITY_COLLEGE"]).nullable().default(null),
  stageDetail: z.string().nullable().default(null),
  teacher: z
    .strictObject({ from: Year, to: Year.nullable(), subjects: z.string() })
    .nullable()
    .default(null),
  classRep: z.boolean().default(false),
  bio: z.string().nullable().default(null),
  education: z
    .array(
      z.strictObject({
        school: z.string(),
        level: z.string(),
        field: z.string().nullable().default(null),
        years: z.string(),
      }),
    )
    .default([]),
  work: z
    .array(
      z.strictObject({
        company: z.string(),
        title: z.string().nullable().default(null),
        industry: z.string().nullable().default(null),
        jobType: z.string().nullable().default(null),
        years: z.string(),
      }),
    )
    .default([]),
  counts: z.strictObject({
    followers: z.number().int().nonnegative(),
    following: z.number().int().nonnegative(),
  }),
});
export type MemberData = z.infer<typeof MemberSchema>;

const MeSchema = z.strictObject({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  fallbackEmail: z
    .email()
    .endsWith("@example.com", "must be an @example.com address"),
  classNumber: z.number().int().positive(),
  atAisFrom: Year,
  graduationYear: Year,
  bio: z.string().nullable(),
  currentStage: z.enum(["WORKING", "UNIVERSITY_COLLEGE"]),
  currentStageDetail: z.string().nullable(),
  education: z.array(
    z.strictObject({
      id: Id,
      schoolOrgId: Id,
      level: z.enum([
        "JUNIOR_HIGH",
        "HIGH_SCHOOL",
        "UNIVERSITY",
        "GRADUATE_SCHOOL",
        "VOCATIONAL",
        "OTHER",
      ]),
      field: z.string().nullable(),
      startYear: Year.nullable(),
      endYear: Year.nullable(),
    }),
  ),
  work: z.array(
    z.strictObject({
      id: Id,
      companyOrgId: Id,
      title: z.string().nullable(),
      industry: z.string().nullable(),
      jobType: z.string().nullable(),
      startYear: Year.nullable(),
      endYear: Year.nullable(),
    }),
  ),
  badges: z.strictObject({
    news: z.number().int().nonnegative(),
    messages: z.number().int().nonnegative(),
    chat: z.number().int().nonnegative(),
    follows: z.number().int().nonnegative(),
    inbox: z.number().int().nonnegative(),
  }),
  device: z.strictObject({
    platform: z.string(),
    name: z.string(),
    signedIn: Ago,
  }),
  setupChecklist: z.array(
    z.strictObject({
      key: z.enum([
        "email",
        "apply",
        "approval",
        "names",
        "photo",
        "bio",
        "history",
        "follow",
        "family",
      ]),
      done: z.boolean(),
    }),
  ),
});

const FollowsSchema = z.strictObject({
  iFollow: z.array(Id),
  followMe: z.array(Id),
  requestsToMe: z.array(z.strictObject({ memberId: Id, requested: Ago })),
  myRequests: z.array(z.strictObject({ memberId: Id, requested: Ago })),
});

const Vote = z.enum(["YES", "MAYBE", "NO"]);
const NewsSchema = z.array(
  z.strictObject({
    id: Id,
    pinned: z.boolean().default(false),
    posted: Ago,
    sender: z.string(),
    title: z.string(),
    excerpt: z.string(),
    body: Text,
    deadline: OnDay.nullable().default(null),
    unread: z.boolean().default(false),
    needsAnswer: z.boolean().default(false),
    allowComments: z.boolean().default(true),
    requireConfirm: z.boolean().default(false),
    confirmedByMe: Ago.nullable().default(null),
    confirmCount: z.number().int().nonnegative().default(0),
    reactions: z
      .array(
        z.strictObject({
          emoji: z.string().min(1),
          count: z.number().int().nonnegative(),
          mine: z.boolean(),
        }),
      )
      .default([]),
    comments: z
      .array(
        z.strictObject({
          id: Id,
          authorId: PersonId,
          body: z.string(),
          posted: Ago,
        }),
      )
      .default([]),
    polls: z
      .array(
        z.strictObject({
          id: Id,
          kind: z.enum(["POLL", "SCHEDULE"]),
          question: z.string(),
          multiple: z.boolean().default(false),
          voters: z.number().int().nonnegative(),
          options: z.array(
            z.strictObject({
              id: Id,
              label: z.string().default(""),
              starts: OnDay.nullable().default(null),
              yes: z.number().int().nonnegative().default(0),
              maybe: z.number().int().nonnegative().default(0),
              no: z.number().int().nonnegative().default(0),
              best: z.boolean().default(false),
              /** 日程調整: everyone's answers ("me" = the demo account's own) */
              answers: z
                .array(z.strictObject({ memberId: PersonId, answer: Vote }))
                .default([]),
            }),
          ),
        }),
      )
      .default([]),
  }),
);

const MessagesSchema = z.array(
  z.strictObject({
    id: Id,
    title: z.string(),
    sender: z.string(),
    sent: Ago,
    sentTo: z.string(),
    body: Text,
  }),
);

const EventsSchema = z.array(
  z.strictObject({
    id: Id,
    title: z.string(),
    body: Text,
    starts: OnDay,
    ends: OnDay.nullable().default(null),
    rsvpCloses: OnDay,
    checkedIn: OnDay.nullable().default(null),
    location: z.string().nullable(),
    mapUrl: z.url().nullable(),
    sender: z.string(),
    capacity: z.number().int().positive().nullable(),
    going: z.number().int().nonnegative(),
    maxGuests: z.number().int().nonnegative(),
    myAnswer: z
      .strictObject({
        answer: z.enum(["GOING", "MAYBE", "NOT_GOING"]),
        guests: z.number().int().nonnegative(),
      })
      .nullable(),
  }),
);

const ChatsSchema = z.array(
  z.strictObject({
    id: Id,
    kind: z.enum([
      "TEACHERS",
      "CURRENT_STUDENTS",
      "FORMER_STUDENTS",
      "CURRENT_PARENTS",
      "FORMER_PARENTS",
      "COHORT",
      "COHORT_PARENTS",
      "ADULTS",
      "DIRECT",
      "CLASS_REPS",
      "GRADUATES",
      "GRADUATES_ADULTS",
      "ALUMNI_COMMITTEE",
    ]),
    title: z.string(),
    hint: z.string(),
    memberIds: z.array(Id).min(1),
    extraMemberCount: z.number().int().nonnegative().default(0),
    unread: z.number().int().nonnegative().default(0),
    mentioned: z.boolean().default(false),
    messages: z.array(
      z.strictObject({
        id: Id,
        from: PersonId,
        body: z.string().min(1),
        sent: Ago,
        mentionAll: z.boolean().default(false),
        /** emoji reactions: who reacted ("me" = the demo user), in order */
        reactions: z
          .array(
            z.strictObject({
              emoji: z.string().min(1).max(32),
              by: z.array(PersonId).min(1),
            }),
          )
          .default([]),
      }),
    ),
  }),
);

const NotificationsSchema = z.array(
  z.strictObject({
    id: Id,
    kind: z.string(),
    category: z.string(),
    emoji: z.string(),
    title: z.string(),
    body: z.string(),
    path: z.string().startsWith("/app/").nullable(),
    sent: Ago,
    read: z.boolean(),
  }),
);

const InvitesSchema = z.array(
  z.strictObject({
    id: Id,
    kind: z.enum(["INDIVIDUAL", "GRADE"]),
    type: z.enum(["STUDENT", "PARENT", "TEACHER"]),
    inviteeName: z.string().nullable(),
    classNumber: z.number().int().positive().nullable(),
    created: Ago,
    usedById: Id.nullable().default(null),
    status: z.enum(["open", "used", "full", "revoked", "expired"]),
  }),
);

const Org = z.strictObject({
  id: Id,
  name: z.string(),
  count: z.number().int().nonnegative(),
});
const OrgsSchema = z.strictObject({
  schools: z.array(Org),
  companies: z.array(Org),
});

const FamilySchema = z.strictObject({
  canAddChild: z.boolean(),
  canAddParent: z.boolean(),
  memberIds: z.array(Id),
});

const SchoolSchema = z.strictObject({
  latestClass: z.number().int().positive(),
  class1GraduationYear: Year,
});

// ---- Loading ----

function where(file: string, path: readonly PropertyKey[]): string {
  let out = `data/${file}`;
  for (const p of path)
    out += typeof p === "number" ? `[${p}]` : `.${String(p)}`;
  return out;
}

function load<S extends z.ZodType>(
  file: string,
  schema: S,
  raw: unknown,
): z.output<S> {
  const r = schema.safeParse(raw);
  if (r.success) return r.data;
  const lines = r.error.issues.map(
    (i) => `  - ${where(file, i.path)}: ${i.message}`,
  );
  throw new Error(
    `Demo data: data/${file} is invalid (src/server/lib/demo)\n${lines.join("\n")}`,
  );
}

function parseAll() {
  return {
    members: load("members.json", z.array(MemberSchema), membersJson),
    me: load("me.json", MeSchema, meJson),
    follows: load("follows.json", FollowsSchema, followsJson),
    news: load("news.json", NewsSchema, newsJson),
    messages: load("messages.json", MessagesSchema, messagesJson),
    events: load("events.json", EventsSchema, eventsJson),
    chats: load("chats.json", ChatsSchema, chatsJson),
    notifications: load(
      "notifications.json",
      NotificationsSchema,
      notificationsJson,
    ),
    invites: load("invites.json", InvitesSchema, invitesJson),
    orgs: load("orgs.json", OrgsSchema, orgsJson),
    family: load("family.json", FamilySchema, familyJson),
    school: load("school.json", SchoolSchema, schoolJson),
  };
}
export type DemoData = ReturnType<typeof parseAll>;

// ---- Consistency: unique ids, and every reference points somewhere ----

function check(d: DemoData): void {
  const errors: string[] = [];
  const unique = (file: string, ids: string[]) => {
    const seen = new Set<string>();
    ids.forEach((id, i) => {
      if (seen.has(id))
        errors.push(`${where(file, [i, "id"])}: duplicate id "${id}"`);
      seen.add(id);
    });
  };
  unique(
    "members.json",
    d.members.map((m) => m.id),
  );
  unique(
    "news.json",
    d.news.map((m) => m.id),
  );
  unique(
    "messages.json",
    d.messages.map((m) => m.id),
  );
  unique(
    "events.json",
    d.events.map((m) => m.id),
  );
  unique(
    "chats.json",
    d.chats.map((m) => m.id),
  );
  unique(
    "notifications.json",
    d.notifications.map((m) => m.id),
  );
  unique(
    "invites.json",
    d.invites.map((m) => m.id),
  );

  const members = new Set(d.members.map((m) => m.id));
  const ref = (
    file: string,
    path: PropertyKey[],
    id: string,
    allowMe = false,
  ) => {
    if (members.has(id) || (allowMe && id === "me")) return;
    errors.push(
      `${where(file, path)}: unknown member id "${id}" (not in members.json${allowMe ? ', and not "me"' : ""})`,
    );
  };
  for (const k of ["iFollow", "followMe"] as const)
    d.follows[k].forEach((id, i) => {
      ref("follows.json", [k, i], id);
    });
  for (const k of ["requestsToMe", "myRequests"] as const)
    d.follows[k].forEach((r, i) => {
      ref("follows.json", [k, i, "memberId"], r.memberId);
    });
  d.news.forEach((p, i) => {
    p.comments.forEach((c, j) => {
      ref("news.json", [i, "comments", j, "authorId"], c.authorId, true);
    });
    p.polls.forEach((poll, j) => {
      poll.options.forEach((o, k) => {
        o.answers.forEach((a, l) => {
          ref(
            "news.json",
            [i, "polls", j, "options", k, "answers", l, "memberId"],
            a.memberId,
            true,
          );
        });
      });
    });
  });
  d.chats.forEach((c, i) => {
    c.memberIds.forEach((id, j) => {
      ref("chats.json", [i, "memberIds", j], id);
    });
    if (c.kind === "DIRECT" && c.memberIds.length !== 1)
      errors.push(
        `${where("chats.json", [i, "memberIds"])}: a DIRECT chat has exactly one other member`,
      );
    c.messages.forEach((m, j) => {
      ref("chats.json", [i, "messages", j, "from"], m.from, true);
      if (m.from !== "me" && !c.memberIds.includes(m.from))
        errors.push(
          `${where("chats.json", [i, "messages", j, "from"])}: "${m.from}" is not in this chat's memberIds`,
        );
      m.reactions.forEach((r, k) => {
        const at = [i, "messages", j, "reactions", k];
        if (!isReactionEmoji(r.emoji))
          errors.push(
            `${where("chats.json", [...at, "emoji"])}: "${r.emoji}" is not a single emoji`,
          );
        r.by.forEach((id, l) => {
          ref("chats.json", [...at, "by", l], id, true);
          if (id !== "me" && !c.memberIds.includes(id))
            errors.push(
              `${where("chats.json", [...at, "by", l])}: "${id}" is not in this chat's memberIds`,
            );
        });
      });
    });
  });
  d.invites.forEach((inv, i) => {
    if (inv.usedById) ref("invites.json", [i, "usedById"], inv.usedById);
  });
  d.family.memberIds.forEach((id, i) => {
    ref("family.json", ["memberIds", i], id);
  });
  const schools = new Set(d.orgs.schools.map((o) => o.id));
  const companies = new Set(d.orgs.companies.map((o) => o.id));
  d.me.education.forEach((e, i) => {
    if (!schools.has(e.schoolOrgId))
      errors.push(
        `${where("me.json", ["education", i, "schoolOrgId"])}: unknown school "${e.schoolOrgId}" (not in orgs.json)`,
      );
  });
  d.me.work.forEach((w, i) => {
    if (!companies.has(w.companyOrgId))
      errors.push(
        `${where("me.json", ["work", i, "companyOrgId"])}: unknown company "${w.companyOrgId}" (not in orgs.json)`,
      );
  });
  if (errors.length)
    throw new Error(
      `Demo data is inconsistent (src/server/lib/demo)\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
}

let cached: DemoData | null = null;

/**
 * The demo's content, parsed and checked on first use (then cached). Throws
 * with every problem, naming file and field — only demo requests call it,
 * so a bad edit never affects anyone else (and `pnpm demo:check` / CI
 * catch it before deploying).
 */
export function demoData(): DemoData {
  if (cached) return cached;
  const d = parseAll();
  check(d);
  cached = d;
  return d;
}

/** A value computed from the demo data, once per (cached) load. */
export function derive<T>(fn: (d: DemoData) => T): () => T {
  const memo = new WeakMap<DemoData, T>();
  return () => {
    const d = demoData();
    if (!memo.has(d)) memo.set(d, fn(d));
    return memo.get(d) as T;
  };
}
