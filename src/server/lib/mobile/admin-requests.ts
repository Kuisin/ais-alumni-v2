import type {
  AdminDecision,
  AdminNameDecisionBody,
  AdminNameDecisionResult,
  AdminNameLine,
  AdminNameRequests,
  AdminRecordDecisionResult,
  AdminRecordDiffRow,
  AdminRecordRequests,
  AdminRequestBase,
  AdminRequestTab,
} from "@contract/admin";
import { getTranslations } from "next-intl/server";
import { decideBirthDateRequestAction } from "@/server/app/actions/birth-date-requests";
import { decideGenderRequestAction } from "@/server/app/actions/gender-requests";
import {
  decideNameRequestAction,
  type NameValues,
} from "@/server/app/actions/name-requests";
import { decideRecordRequestAction } from "@/server/app/actions/record-requests";
import { ChangeRequestStatus } from "@/server/generated/prisma/enums";
import { loadCohortChoices } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import { displayName } from "@/server/lib/format";
import { isGender } from "@/server/lib/gender";
import { adminOnly } from "@/server/lib/mobile/admin";
import type { Locale } from "@/server/lib/mobile/http";
import { iso } from "@/server/lib/mobile/present";
import { composeKana, composeKanji, composeRomaji } from "@/server/lib/names";
import type { CurrentUser } from "@/server/lib/session";

/**
 * 審査: the website's (committee) name-requests and record-requests pages
 * and their decision forms. Committee admins (requireAdmin); the website's
 * decide* actions keep their own actionAdmin check and do the work.
 */

const PERSON = { select: { id: true, nameRomaji: true, nameKanji: true } };
const REVIEWER = { select: { nameRomaji: true, nameKanji: true } };

function listArgs(tab: AdminRequestTab) {
  return {
    where:
      tab === "pending"
        ? { status: ChangeRequestStatus.PENDING }
        : {
            status: {
              in: [ChangeRequestStatus.APPROVED, ChangeRequestStatus.REJECTED],
            },
          },
    orderBy: { createdAt: tab === "pending" ? "asc" : "desc" },
    take: 50,
    include: { user: PERSON, reviewer: REVIEWER },
  } as const;
}

type Row = {
  id: string;
  createdAt: Date;
  status: ChangeRequestStatus;
  reviewNote: string | null;
  decidedAt: Date | null;
  user: { id: string; nameRomaji: string | null; nameKanji: string | null };
  reviewer: { nameRomaji: string | null; nameKanji: string | null } | null;
};

function base(q: Row, locale: Locale): AdminRequestBase {
  return {
    id: q.id,
    member: { id: q.user.id, name: displayName(q.user, locale) },
    createdAt: q.createdAt.toISOString(),
    status: q.status,
    reviewer: q.reviewer ? displayName(q.reviewer, locale) : null,
    reviewNote: q.reviewNote,
    decidedAt: iso(q.decidedAt),
  };
}

/** The page's lines(): each name as the website composes it. */
function lines(v: Partial<NameValues>) {
  return {
    romaji: composeRomaji({
      lastNameRomaji: v.lastNameRomaji ?? null,
      firstNameRomaji: v.firstNameRomaji ?? null,
      middleNameRomaji: v.middleNameRomaji ?? null,
    }),
    kanji: composeKanji({
      lastNameKanji: v.lastNameKanji ?? null,
      firstNameKanji: v.firstNameKanji ?? null,
    }),
    kana: composeKana({
      lastNameKana: v.lastNameKana ?? null,
      firstNameKana: v.firstNameKana ?? null,
    }),
    nameAtAis: v.nameAtAis || null,
  };
}

const NAME_FIELDS = ["romaji", "kanji", "kana", "nameAtAis"] as const;

const day = (d: Date) => d.toISOString().slice(0, 10);
const gender = (v: string | null) => (v && isGender(v) ? v : null);

export function parseTab(url: string): AdminRequestTab {
  return new URL(url).searchParams.get("tab") === "decided"
    ? "decided"
    : "pending";
}

/** 氏名・生年月日・性別の変更申請. */
export async function adminNameRequests(
  user: CurrentUser,
  tab: AdminRequestTab,
  locale: Locale,
): Promise<AdminNameRequests> {
  adminOnly(user);
  const pending = { where: { status: ChangeRequestStatus.PENDING } };
  const [pendingCount, names, births, genders] = await Promise.all([
    Promise.all([
      db.nameChangeRequest.count(pending),
      db.birthDateRequest.count(pending),
      db.genderRequest.count(pending),
    ]).then(([a, b, c]) => a + b + c),
    db.nameChangeRequest.findMany(listArgs(tab)),
    db.birthDateRequest.findMany(listArgs(tab)),
    db.genderRequest.findMany(listArgs(tab)),
  ]);
  return {
    tab,
    pendingCount,
    names: names.map((q) => {
      const before = lines(q.current as Partial<NameValues>);
      const after = lines(q.proposed as Partial<NameValues>);
      return {
        ...base(q, locale),
        lines: NAME_FIELDS.map(
          (field): AdminNameLine => ({
            field,
            before: before[field],
            after: after[field],
          }),
        ),
        reason: q.reason,
      };
    }),
    birthDates: births.map((q) => ({
      ...base(q, locale),
      current: q.current ? day(q.current) : null,
      proposed: day(q.proposed),
      reason: q.reason,
    })),
    genders: genders.map((q) => ({
      ...base(q, locale),
      current: gender(q.current),
      proposed: gender(q.proposed),
      reason: q.reason,
    })),
  };
}

function decisionForm(id: string, decision: AdminDecision, note: string) {
  const fd = new FormData();
  fd.set("id", id);
  fd.set("decision", decision);
  fd.set("note", note);
  return fd;
}

/** The website's NameDecisionForm: approve (apply) or reject with a note. */
export async function decideNameRequest(
  user: CurrentUser,
  id: string,
  body: AdminNameDecisionBody,
): Promise<AdminNameDecisionResult> {
  adminOnly(user);
  const fd = decisionForm(id, body.decision, body.note);
  const state =
    body.kind === "birthDate"
      ? await decideBirthDateRequestAction(null, fd)
      : body.kind === "gender"
        ? await decideGenderRequestAction(null, fd)
        : await decideNameRequestAction(null, fd);
  const message = state?.message ?? "";
  // The form shows the kind's own approval text.
  if (body.kind !== "name" && message === "nameRequests.approved")
    return {
      ok: true,
      message:
        body.kind === "gender"
          ? "genderRequests.approved"
          : "birthDateRequests.approved",
    };
  return { ok: Boolean(state?.ok), message };
}

const RECORD_FIELDS = new Set<string>([
  "cohort",
  "yearsFrom",
  "yearsTo",
  "subjects",
  "studentIdNo",
] satisfies AdminRecordDiffRow["field"][]);

/** 在籍情報の修正申請. */
export async function adminRecordRequests(
  user: CurrentUser,
  tab: AdminRequestTab,
  locale: Locale,
): Promise<AdminRecordRequests> {
  adminOnly(user);
  const [choices, tc, pendingCount, requests] = await Promise.all([
    loadCohortChoices(locale),
    getTranslations({ locale, namespace: "common" }),
    db.recordChangeRequest.count({
      where: { status: ChangeRequestStatus.PENDING },
    }),
    db.recordChangeRequest.findMany(listArgs(tab)),
  ]);
  const cohortLabels = new Map(choices.map((c) => [String(c.value), c.label]));
  // RecordValue: 学年 number → its label, else "第N期".
  const value = (field: string, v: unknown): string | null => {
    if (v === null || v === undefined || v === "") return null;
    if (field === "cohort")
      return (
        cohortLabels.get(String(v)) ?? tc("cohortNumber", { number: String(v) })
      );
    return String(v);
  };
  return {
    tab,
    pendingCount,
    requests: requests.map((q) => {
      const current = (q.current ?? {}) as Record<string, unknown>;
      const proposed = (q.proposed ?? {}) as Record<string, unknown>;
      return {
        ...base(q, locale),
        role: q.role,
        // Requests from older forms may carry fields that no longer exist.
        diff: Object.keys(proposed)
          .filter((f) => RECORD_FIELDS.has(f))
          .map((f) => ({
            field: f as AdminRecordDiffRow["field"],
            before: value(f, current[f]),
            after: value(f, proposed[f]),
          })),
        reason: q.reason,
      };
    }),
  };
}

/** The website's RecordDecisionForm. */
export async function decideRecordRequest(
  user: CurrentUser,
  id: string,
  decision: AdminDecision,
  note: string,
): Promise<AdminRecordDecisionResult> {
  adminOnly(user);
  const state = await decideRecordRequestAction(
    null,
    decisionForm(id, decision, note),
  );
  return {
    ok: Boolean(state?.ok),
    message: state?.message,
    fieldErrors: state?.fieldErrors?.reason
      ? { reason: state.fieldErrors.reason }
      : undefined,
  };
}
