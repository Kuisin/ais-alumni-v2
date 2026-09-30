import type { MemberRef } from "@contract/core";
import type {
  FollowUiState,
  MemberCard,
  MemberProfile,
  ProfileAudience,
  RoleLine,
} from "@contract/people";
import { industryLabel } from "@/server/lib/industries";
import { jobTypeLabel } from "@/server/lib/job-types";
import { demoData, derive, type MemberData } from "./data";

/**
 * The App Review demo's fictional members (data/members.json, follows in
 * data/follows.json) as API shapes. Avatars are the default icons the real
 * server uses for members without a photo (src/server/lib/gender.ts).
 */

export const DEMO_USER_ID = "demo-reviewer";

type Gender = MemberData["gender"];

export function demoAvatar(gender: Gender): string {
  if (gender === "MALE") return "/avatars/default-male.jpg";
  if (gender === "FEMALE") return "/avatars/default-female.jpg";
  return "/avatars/default.svg";
}

export type DemoMember = MemberData & {
  /** my follow button toward them */
  follow: FollowUiState;
  /** they follow me (accepted) */
  followsYou: boolean;
};

function followState(id: string): FollowUiState {
  if (demoData().follows.iFollow.includes(id)) return "following";
  if (demoData().follows.myRequests.some((r) => r.memberId === id))
    return "requested";
  if (demoData().follows.followMe.includes(id)) return "followBack";
  return "none";
}

export const members = derive((d): DemoMember[] =>
  d.members.map((x) => ({
    ...x,
    follow: followState(x.id),
    followsYou: d.follows.followMe.includes(x.id),
  })),
);

export function member(id: string): DemoMember | undefined {
  return members().find((x) => x.id === id);
}

/** A member's display name; "me" = the demo account. */
export function personName(id: string): string {
  return id === "me" || id === DEMO_USER_ID
    ? me().name
    : (member(id)?.name ?? "");
}

export function otherName(x: {
  kanji: string | null;
  kana: string | null;
}): string | null {
  if (!x.kanji) return null;
  return x.kana ? `${x.kanji}（${x.kana}）` : x.kanji;
}

const ROLE_LABEL: Record<MemberData["role"], string> = {
  FORMER_STUDENT: "Former student / Alumni",
  TEACHER: "Teacher / Staff",
  FORMER_PARENT: "Parent of former student",
};

const STAGE_LABEL = {
  WORKING: "Working",
  UNIVERSITY_COLLEGE: "University / College",
};

export function roleFacts(x: MemberData, withStage = true): string[] {
  const facts: string[] = [];
  if (x.role === "FORMER_STUDENT") {
    if (x.classNumber) facts.push(`Class ${x.classNumber}`);
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

export function roleLines(x: MemberData): RoleLine[] {
  return [{ label: ROLE_LABEL[x.role], facts: roleFacts(x) }];
}

export function memberRef(x: MemberData): MemberRef {
  return {
    id: x.id,
    name: x.name,
    otherName: otherName(x),
    avatar: demoAvatar(x.gender),
  };
}

export function memberCard(x: MemberData): MemberCard {
  return { ...memberRef(x), nameAtAis: null, roles: roleLines(x) };
}

function email(x: MemberData): string {
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

// ---- The demo account itself (data/me.json) ----

const LEVEL_LABEL: Record<string, string> = {
  JUNIOR_HIGH: "Junior high",
  HIGH_SCHOOL: "High school",
  UNIVERSITY: "University",
  GRADUATE_SCHOOL: "Graduate school",
  VOCATIONAL: "Vocational school",
  OTHER: "Other",
};

const orgName = (list: { id: string; name: string }[], id: string) =>
  list.find((o) => o.id === id)?.name ?? "";

const years = (from: number | null, to: number | null) =>
  `${from ?? ""}–${to ?? "present"}`;

export const me = derive((d) => ({
  id: DEMO_USER_ID,
  name: `${d.me.firstName} ${d.me.lastName}`,
  otherName: null,
  avatar: demoAvatar(null),
  cohort: d.me.classNumber,
  year: d.me.graduationYear,
  bio: d.me.bio,
  stage: d.me.currentStage,
  stageLabel: STAGE_LABEL[d.me.currentStage],
  stageDetail: d.me.currentStageDetail,
  roleLabel: ROLE_LABEL.FORMER_STUDENT,
  facts: [
    `Class ${d.me.classNumber}`,
    `Class of ${d.me.graduationYear}`,
    "Elementary",
  ],
  education: d.me.education.map((e) => ({
    ...e,
    school: orgName(d.orgs.schools, e.schoolOrgId),
    levelLabel: LEVEL_LABEL[e.level],
    years: years(e.startYear, e.endYear),
  })),
  work: d.me.work.map((w) => ({
    ...w,
    company: orgName(d.orgs.companies, w.companyOrgId),
    industryLabel: industryLabel(w.industry, "en"),
    jobTypeLabel: jobTypeLabel(w.jobType, "en"),
    years: years(w.startYear, w.endYear),
  })),
}));

export function myEmail(): string {
  return (
    process.env.REVIEW_EMAIL?.trim().toLowerCase() ||
    demoData().me.fallbackEmail
  );
}

/** GET /members/<me>?as=…: my profile as others see it. */
export function myProfileAs(as: ProfileAudience): MemberProfile {
  const shared = as !== "members";
  return {
    id: me().id,
    name: me().name,
    otherName: null,
    nameAtAis: null,
    avatar: me().avatar,
    photoHidden: false,
    roles: [me().roleLabel],
    bio: me().bio,
    record: [
      {
        label: me().roleLabel,
        details: me().facts.join(" · "),
        subjects: null,
      },
    ],
    currentStage: {
      label: me().stageLabel,
      detail: shared ? me().stageDetail : null,
    },
    history: {
      education: me().education.map((e) => ({
        id: e.id,
        school: e.school,
        level: e.levelLabel,
        field: e.field,
        years: e.years,
      })),
      work: me().work.map((w) => ({
        id: w.id,
        company: w.company,
        title: w.title,
        industry: w.industryLabel,
        jobType: w.jobTypeLabel,
        years: w.years,
      })),
      hiddenCount: 0,
    },
    counts: {
      followers: demoData().follows.followMe.length,
      following: demoData().follows.iFollow.length,
    },
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
