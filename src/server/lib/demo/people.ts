import type { MemberRef } from "@contract/core";
import type {
  FollowUiState,
  MemberCard,
  MemberProfile,
  ProfileAudience,
  RoleLine,
} from "@contract/people";

/**
 * The App Review demo's fictional members (src/server/lib/demo). Static,
 * made-up people — never read from the database. Text is English (the demo
 * account's language); avatars are the default icons the real server uses
 * for members without a photo (src/server/lib/gender.ts defaultAvatar).
 */

export const DEMO_USER_ID = "demo-reviewer";

type Gender = "MALE" | "FEMALE" | null;
type Role = "FORMER_STUDENT" | "TEACHER" | "FORMER_PARENT";

export function demoAvatar(gender: Gender): string {
  if (gender === "MALE") return "/avatars/default-male.jpg";
  if (gender === "FEMALE") return "/avatars/default-female.jpg";
  return "/avatars/default.svg";
}

export type DemoMember = {
  id: string;
  name: string;
  kanji: string | null;
  kana: string | null;
  gender: Gender;
  role: Role;
  /** 第N期 (former students) */
  cohort: number | null;
  /** graduation (or leaving) year */
  year: number | null;
  graduated: boolean;
  stage: "WORKING" | "UNIVERSITY_COLLEGE" | null;
  stageDetail: string | null;
  teacher: { from: number; to: number | null; subjects: string } | null;
  rep: boolean;
  bio: string | null;
  education: {
    school: string;
    level: string;
    field: string | null;
    years: string;
  }[];
  work: {
    company: string;
    title: string | null;
    industry: string | null;
    jobType: string | null;
    years: string;
  }[];
  /** my follow button toward them */
  follow: FollowUiState;
  /** they follow me (accepted) */
  followsYou: boolean;
  counts: { followers: number; following: number };
};

const m = (
  x: Partial<DemoMember> & Pick<DemoMember, "id" | "name" | "gender" | "role">,
): DemoMember => ({
  kanji: null,
  kana: null,
  cohort: null,
  year: null,
  graduated: true,
  stage: null,
  stageDetail: null,
  teacher: null,
  rep: false,
  bio: null,
  education: [],
  work: [],
  follow: "none",
  followsYou: false,
  counts: { followers: 12, following: 9 },
  ...x,
});

export const MEMBERS: DemoMember[] = [
  m({
    id: "demo-m-emily",
    name: "Emily Tanaka",
    kanji: "田中 エミリー",
    kana: "タナカ エミリー",
    gender: "FEMALE",
    role: "FORMER_STUDENT",
    cohort: 3,
    year: 2014,
    stage: "WORKING",
    stageDetail: "Product designer in Tokyo",
    bio: "Class 3. Designing apps in Tokyo these days — always happy to chat with fellow AIS alumni!",
    education: [
      {
        school: "Northfield University",
        level: "University",
        field: "Visual Communication",
        years: "2020–2024",
      },
    ],
    work: [
      {
        company: "Sakura Digital Studio",
        title: "Product Designer",
        industry: "Software & telecommunications › Software",
        jobType: "Creative",
        years: "2024–present",
      },
    ],
    follow: "following",
    followsYou: true,
    counts: { followers: 34, following: 28 },
  }),
  m({
    id: "demo-m-kenji",
    name: "Kenji Morimoto",
    kanji: "森本 健二",
    kana: "モリモト ケンジ",
    gender: "MALE",
    role: "FORMER_STUDENT",
    cohort: 3,
    year: 2014,
    stage: "WORKING",
    stageDetail: "Mechanical engineer in Nagoya",
    rep: true,
    bio: "Class rep for Class 3. Organising our next class get-together — message me with ideas!",
    education: [
      {
        school: "Chubu Institute of Technology",
        level: "University",
        field: "Mechanical Engineering",
        years: "2020–2024",
      },
    ],
    work: [
      {
        company: "Aoba Motors",
        title: "Engineer",
        industry: "Manufacturers",
        jobType: "Engineering (architecture & civil)",
        years: "2024–present",
      },
    ],
    follow: "following",
    followsYou: true,
    counts: { followers: 51, following: 47 },
  }),
  m({
    id: "demo-m-yui",
    name: "Yui Hasegawa",
    kanji: "長谷川 結衣",
    kana: "ハセガワ ユイ",
    gender: "FEMALE",
    role: "FORMER_STUDENT",
    cohort: 4,
    year: 2015,
    stage: "UNIVERSITY_COLLEGE",
    stageDetail: "Studying marine biology",
    bio: "Class 4. Currently studying marine biology in Okinawa.",
    education: [
      {
        school: "Ryukyu Coastal University",
        level: "University",
        field: "Marine Biology",
        years: "2023–present",
      },
    ],
    follow: "following",
    followsYou: false,
    counts: { followers: 19, following: 22 },
  }),
  m({
    id: "demo-m-daniel",
    name: "Daniel Okafor",
    gender: "MALE",
    role: "FORMER_STUDENT",
    cohort: 5,
    year: 2016,
    stage: "UNIVERSITY_COLLEGE",
    stageDetail: "Computer science student",
    bio: "Class 5. CS student, part-time barista, full-time football fan.",
    counts: { followers: 8, following: 15 },
  }),
  m({
    id: "demo-m-marco",
    name: "Marco Rossi",
    gender: "MALE",
    role: "FORMER_STUDENT",
    cohort: 3,
    year: 2012,
    graduated: false,
    stage: "WORKING",
    stageDetail: "Chef in Milan",
    bio: "Was at AIS until 3rd grade before moving to Italy. Still remember the school festival!",
    follow: "requested",
    counts: { followers: 6, following: 4 },
  }),
  m({
    id: "demo-m-sophie",
    name: "Sophie Laurent",
    gender: "FEMALE",
    role: "TEACHER",
    teacher: { from: 2008, to: 2016, subjects: "French, Art" },
    bio: "Taught French and art at AIS for eight wonderful years. Now back in Lyon.",
    follow: "followBack",
    followsYou: true,
    counts: { followers: 88, following: 12 },
  }),
  m({
    id: "demo-m-liam",
    name: "Liam Carter",
    gender: "MALE",
    role: "TEACHER",
    teacher: { from: 2015, to: null, subjects: "English, PE" },
    bio: "English and PE teacher. Ask me about the sports day archives.",
    counts: { followers: 64, following: 20 },
  }),
  m({
    id: "demo-m-aiko",
    name: "Aiko Nakamura",
    kanji: "中村 愛子",
    kana: "ナカムラ アイコ",
    gender: "FEMALE",
    role: "FORMER_PARENT",
    bio: "Parent of two AIS graduates. Helping with the alumni committee's events.",
    counts: { followers: 27, following: 30 },
  }),
];

export function member(id: string): DemoMember | undefined {
  return MEMBERS.find((x) => x.id === id);
}

export function otherName(x: {
  kanji: string | null;
  kana: string | null;
}): string | null {
  if (!x.kanji) return null;
  return x.kana ? `${x.kanji}（${x.kana}）` : x.kanji;
}

const ROLE_LABEL: Record<Role, string> = {
  FORMER_STUDENT: "Former student / Alumni",
  TEACHER: "Teacher / Staff",
  FORMER_PARENT: "Parent of former student",
};

const STAGE_LABEL = {
  WORKING: "Working",
  UNIVERSITY_COLLEGE: "University / College",
};

export function roleFacts(x: DemoMember, withStage = true): string[] {
  const facts: string[] = [];
  if (x.role === "FORMER_STUDENT") {
    if (x.cohort) facts.push(`Class ${x.cohort}`);
    if (x.year)
      facts.push(x.graduated ? `Class of ${x.year}` : `Left AIS in ${x.year}`);
    facts.push("Elementary");
    if (withStage && x.stage) facts.push(`Now: ${STAGE_LABEL[x.stage]}`);
  } else if (x.role === "TEACHER" && x.teacher) {
    facts.push(x.teacher.to ? "Former" : "Current");
    facts.push(
      x.teacher.to
        ? `At AIS ${x.teacher.from}–${x.teacher.to}`
        : `At AIS ${x.teacher.from}–present`,
    );
  }
  return facts;
}

export function roleLines(x: DemoMember): RoleLine[] {
  return [{ label: ROLE_LABEL[x.role], facts: roleFacts(x) }];
}

export function memberRef(x: DemoMember): MemberRef {
  return {
    id: x.id,
    name: x.name,
    otherName: otherName(x),
    avatar: demoAvatar(x.gender),
  };
}

export function memberCard(x: DemoMember): MemberCard {
  return { ...memberRef(x), nameAtAis: null, roles: roleLines(x) };
}

function email(x: DemoMember): string {
  return `${x.name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
}

export function memberProfile(x: DemoMember): MemberProfile {
  const accepted = x.follow === "following";
  const mutual = accepted && x.followsYou;
  const canRequest = x.follow === "none" || x.follow === "followBack";
  return {
    id: x.id,
    name: x.name,
    otherName: otherName(x),
    nameAtAis: null,
    avatar: demoAvatar(x.gender),
    photoHidden: false,
    roles: [ROLE_LABEL[x.role]],
    bio: x.bio,
    record: [
      {
        label: ROLE_LABEL[x.role],
        details: roleFacts(x, false).join(" · ") || "No details",
        subjects: x.teacher ? `Subjects: ${x.teacher.subjects}` : null,
      },
    ],
    currentStage:
      x.role === "FORMER_STUDENT"
        ? {
            label: x.stage ? STAGE_LABEL[x.stage] : null,
            detail: accepted ? x.stageDetail : null,
          }
        : null,
    history:
      x.education.length || x.work.length
        ? {
            education: x.education.map((e, i) => ({
              id: `${x.id}-edu-${i}`,
              ...e,
            })),
            work: x.work.map((w, i) => ({ id: `${x.id}-work-${i}`, ...w })),
            hiddenCount: 0,
          }
        : null,
    counts: x.counts,
    relationship: {
      family: false,
      followsYou: x.followsYou,
      follow: x.follow,
      canRequest,
      blockedByMe: false,
      canMessage: mutual,
      menu: true,
    },
    contact: accepted
      ? {
          access: "followers",
          birthDate: null,
          email: email(x),
          phone: null,
          lineDisplayName: null,
          social: [{ key: "linkedin", url: "https://www.linkedin.com/" }],
          locked: null,
          hidden: ["phone"],
        }
      : {
          access: "none",
          birthDate: null,
          email: null,
          phone: null,
          lineDisplayName: null,
          social: [],
          locked:
            x.follow === "requested"
              ? "requested"
              : canRequest
                ? "body"
                : "unavailable",
          hidden: ["email"],
        },
    preview: null,
  };
}

// ---- The demo account itself ----

export const ME = {
  id: DEMO_USER_ID,
  name: "Reviewer App",
  otherName: null,
  avatar: demoAvatar(null),
  cohort: 3,
  year: 2014,
  bio: "Class 3 graduate. Glad to reconnect with everyone from AIS!",
  stageDetail: "Working in software",
} as const;

export function myEmail(): string {
  return (
    process.env.REVIEW_EMAIL?.trim().toLowerCase() || "reviewer@example.com"
  );
}

/** GET /members/<me>?as=…: my profile as others see it. */
export function myProfileAs(as: ProfileAudience): MemberProfile {
  const shared = as !== "members";
  return {
    id: ME.id,
    name: ME.name,
    otherName: null,
    nameAtAis: null,
    avatar: ME.avatar,
    photoHidden: false,
    roles: [ROLE_LABEL.FORMER_STUDENT],
    bio: ME.bio,
    record: [
      {
        label: ROLE_LABEL.FORMER_STUDENT,
        details: "Class 3 · Class of 2014 · Elementary",
        subjects: null,
      },
    ],
    currentStage: { label: "Working", detail: shared ? ME.stageDetail : null },
    history: {
      education: [
        {
          id: "demo-me-edu-0",
          school: "Lakeside University",
          level: "University",
          field: "Computer Science",
          years: "2020–2024",
        },
      ],
      work: [
        {
          id: "demo-me-work-0",
          company: "Example Apps Inc.",
          title: "Software Engineer",
          industry: "Software & telecommunications › Software",
          jobType: "IT & web › Programmer & software development",
          years: "2024–present",
        },
      ],
      hiddenCount: 0,
    },
    counts: { followers: 3, following: 3 },
    relationship: {
      family: as === "family",
      followsYou: false,
      follow: null,
      canRequest: false,
      blockedByMe: false,
      canMessage: false,
      menu: false,
    },
    contact: shared
      ? {
          access: as === "family" ? "all" : "followers",
          birthDate: null,
          email: as === "family" ? myEmail() : null,
          phone: null,
          lineDisplayName: null,
          social: [],
          locked: null,
          hidden: as === "family" ? [] : ["email"],
        }
      : {
          access: "none",
          birthDate: null,
          email: null,
          phone: null,
          lineDisplayName: null,
          social: [],
          locked: "body",
          hidden: ["email"],
        },
    preview: as,
  };
}
