/**
 * 家族 (/app/family), 同窓生を招待 (/app/invite) and 「この方をご存じですか？」
 * (/app/vouch/[id]). Pure types (see core.ts for the conventions). Error
 * codes are keys of the website's messages: family.errors.<code>,
 * family.handover.errors.<code>, invites.errors.<code>,
 * vouch.messages.<code>.
 */

import type { MemberCard } from "./people";

/** A 学年 choice (value = 第N期 number, as the website's selects). */
export type CohortChoice = { value: string; label: string };

// ---- GET /family ----

/** A request the other side sent that I confirm (「あなたの承認待ち」). */
export type FamilyRequest = {
  linkId: string;
  /** the member who asked */
  member: MemberCard;
  /** family.pendingForMe.<key> */
  key: "asChild" | "asParent";
};

/** A child account this parent created at sign-up (「あなたが管理しているお子さま」). */
export type ManagedChild = {
  member: MemberCard;
  /** family.managed.state.<state> */
  state: "active" | "pending" | "other";
  /** the handover link waiting for the child, if any */
  handover: { email: string; expiresAt: string } | null;
};

/** A link row (「家族のリンク」). */
export type FamilyLinkRow = {
  id: string;
  parentName: string;
  childName: string;
  /** family.status.<status>; pendingOther names `pendingName` */
  status: "confirmed" | "pendingAdmin" | "pendingOther";
  pendingName: string | null;
  /** 「リクエストを取り消す」 (pending, and I'm the parent or the child) */
  cancellable: boolean;
};

export type FamilyPage = {
  /** I may claim a child (保護者) / a parent (生徒) */
  canClaimChild: boolean;
  canClaimParent: boolean;
  toConfirm: FamilyRequest[];
  managed: ManagedChild[];
  /** 「わたしの家族」 */
  members: MemberCard[];
  links: FamilyLinkRow[];
  /** 学年 choices for adding a child without an account (canClaimChild) */
  cohorts: CohortChoice[];
};

// ---- GET /family/search?direction=child|parent&q= ----

export type FamilyCandidate = {
  member: MemberCard;
  /** a minor found by exact name: no photo and no profile link */
  limited: boolean;
};
export type FamilySearch = { items: FamilyCandidate[] };

// ---- POST /family/links {direction, otherId} ----
// ---- POST /family/children {childName, cohortNumber, leftYear} ----
// Result: family.<message>. Errors: family.errors.<code>.
export type FamilyClaimResult = { ok: true; message: "sent" | "sentAdmin" };

// ---- POST /family/links/[id]/confirm, DELETE /family/links/[id] → Ok ----

// ---- POST /family/managed/[childId]/handover {email} → Ok ----
// errors: family.handover.errors.<code>
// ---- DELETE /family/managed/[childId]/handover → Ok ----

// ---- GET /invites ----

export type InviteKind = "INDIVIDUAL" | "GRADE";
export type InviteType = "STUDENT" | "PARENT" | "TEACHER";

export type InviteRow = {
  id: string;
  kind: InviteKind;
  type: InviteType;
  inviteeName: string | null;
  /** 第N期 */
  cohortLabel: string | null;
  createdAt: string;
  /** invites.usedBy (個別) */
  usedByName: string | null;
  /** 学年招待: people registered / allowed, and their names */
  uses: number;
  maxUses: number;
  usedByNames: string[];
  /** invites.status.<status> */
  status: "open" | "used" | "full" | "revoked" | "expired";
};

export type InvitesPage = { cohorts: CohortChoice[]; invites: InviteRow[] };

// ---- POST /invites {kind, type, cohortNumber, inviteeName} ----
// errors: invites.errors.<code> (forbidden, cohort, tooMany, invalid, gradeOpen)
export type InviteCreated = {
  /** the link to share (shown once) */
  url: string;
  kind: InviteKind;
};

// ---- POST /invites/[id]/revoke → Ok ----

// ---- GET /invite/[token] (public) ----
// Opening an invitation link: who invited, for the sign-in banner and to
// prefill the application. 404 not_found = invalid, used or expired.
export type InvitePreview = {
  kind: InviteKind;
  type: InviteType;
  /** the inviter (romaji name, else kanji) */
  inviterName: string;
  cohortNumber: number | null;
  /** 第N期 in the request's language */
  cohortLabel: string | null;
};

// ---- GET /vouch/[id] ----

export type VouchAnswer = "YES" | "NO" | "NOT_SURE";

export type VouchPage = {
  name: string;
  otherName: string | null;
  nameAtAis: string | null;
  /** AIS years from the application ("2005–2011") */
  years: string | null;
  answer: VouchAnswer | null;
  /** decided: answers can't change */
  closed: boolean;
};

// ---- POST /vouch/[id] {answer} → Ok ----
// errors: vouch.messages.<code> (forbidden, validation, closed)
