import type {
  AboutUpdate,
  BirthDateRequestInput,
  FormOk,
  GenderRequestInput,
  HistoryEditor,
  HistoryInput,
  NameRequestInput,
  RecordDiffRow,
  RecordField,
  RecordPage,
  RecordRequestInput,
  RecordRequestView,
  TwoLevelGroup,
} from "@contract/profile";
import { z } from "zod";
import {
  cancelBirthDateRequestAction,
  submitBirthDateRequestAction,
} from "@/server/app/actions/birth-date-requests";
import {
  cancelGenderRequestAction,
  setGenderOnceAction,
  submitGenderRequestAction,
} from "@/server/app/actions/gender-requests";
import {
  deleteHistoryAction,
  saveHistoryAction,
  searchOrgsAction,
} from "@/server/app/actions/history";
import {
  cancelNameRequestAction,
  submitNameRequestAction,
} from "@/server/app/actions/name-requests";
import {
  removeAvatarAction,
  updateAvatarSettingsAction,
  updateDirectorySettingsAction,
  updateFollowerFieldsAction,
  updateProfileAction,
  uploadAvatarAction,
} from "@/server/app/actions/profile";
import {
  cancelRecordRequestAction,
  submitRecordRequestAction,
} from "@/server/app/actions/record-requests";
import { SOCIAL_KEYS } from "@/server/components/profile/social-links";
import { ChangeRequestStatus, RoleKey } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { roleLabelKey } from "@/server/lib/audience";
import { cohortNumbersById, loadCohortChoices } from "@/server/lib/cohorts-db";
import { db } from "@/server/lib/db";
import {
  currentEntries,
  sortHistory,
  stageFromHistory,
} from "@/server/lib/history";
import {
  INDUSTRIES,
  type IndustryGroup,
  industryLabel,
} from "@/server/lib/industries";
import { JOB_TYPES, jobTypeLabel } from "@/server/lib/job-types";
import { ApiError, type Locale } from "@/server/lib/mobile/http";
import {
  fieldsFor,
  hasRecord,
  snapshot,
  toFormValues,
} from "@/server/lib/record-requests";
import type { CurrentUser } from "@/server/lib/session";

/**
 * Editing my profile from the app: every change goes through the website's
 * own server actions (src/server/app/actions — profile, history,
 * name-/birth-date-/gender-/record-requests), given the FormData their
 * forms would send, so validation, authorization and notifications are
 * exactly the website's. Their answers become FormOk / FormError.
 */

type ActionState = {
  ok?: boolean;
  message?: string;
  fields?: string[];
  fieldErrors?: Partial<Record<string, string | undefined>>;
} | null;

/** The action's state as an API answer: FormOk, or a thrown FormError. */
export function formResult(state: ActionState): FormOk {
  if (state?.ok) return { message: state.message ?? "saved" };
  const message = state?.message ?? "errors.validation";
  let fieldErrors: Record<string, string> | undefined;
  if (state?.fieldErrors) {
    fieldErrors = {};
    for (const [k, v] of Object.entries(state.fieldErrors))
      if (v) fieldErrors[k] = v;
  } else if (state?.fields?.length) {
    fieldErrors = Object.fromEntries(state.fields.map((f) => [f, "invalid"]));
  }
  throw new ApiError(message === "errors.forbidden" ? 403 : 400, "form", {
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  });
}

function form(values: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values))
    if (v !== undefined) fd.set(k, v);
  return fd;
}

const on = (b: boolean) => (b ? "on" : "");

// ---------------------------------------------------------------------------
// About, directory, photo, follower fields (src/app/actions/profile.ts)
// ---------------------------------------------------------------------------

const str = (max: number) => z.string().max(max);

export const AboutBody = z.object({
  // Lengths are checked by the action; these only bound the request.
  bio: str(5000),
  phone: str(200),
  autoAcceptSameYear: z.boolean().optional(),
  social: z.partialRecord(z.enum(SOCIAL_KEYS), str(2000)),
});

export async function saveAbout(
  user: CurrentUser,
  input: AboutUpdate,
): Promise<FormOk> {
  return formResult(
    await updateProfileAction(
      null,
      form({
        bio: input.bio,
        phone: input.phone,
        // Left out (not a former student): the form's hidden current value.
        autoAcceptSameYear: on(
          input.autoAcceptSameYear ?? user.autoAcceptSameYear,
        ),
        ...Object.fromEntries(
          SOCIAL_KEYS.map((k) => [k, input.social[k] ?? ""]),
        ),
      }),
    ),
  );
}

export async function saveDirectory(listed: boolean): Promise<FormOk> {
  return formResult(
    await updateDirectorySettingsAction(null, form({ listed: on(listed) })),
  );
}

export async function savePhotoVisibility(isPublic: boolean): Promise<FormOk> {
  return formResult(
    await updateAvatarSettingsAction(
      null,
      form({ avatarPublic: on(isPublic) }),
    ),
  );
}

export async function saveFollowerFields(shared: string[]): Promise<FormOk> {
  const fd = new FormData();
  for (const f of shared) fd.append("share", f);
  return formResult(await updateFollowerFieldsAction(null, fd));
}

/**
 * The photo form's multipart body, handed to the website's upload action
 * as its form sends it (it reads only the "avatar" file, checks size and
 * type by the file's bytes, stores it and deletes the old one).
 */
export async function uploadPhoto(request: Request): Promise<FormOk> {
  let body: FormData;
  try {
    // The DOM FormData (the request's) vs React Native's global type.
    body = (await request.formData()) as unknown as FormData;
  } catch {
    body = new FormData();
  }
  return formResult(await uploadAvatarAction(null, body));
}

export async function removePhoto(): Promise<{ ok: true }> {
  await removeAvatarAction();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 学歴・職歴 (src/app/[locale]/app/(member)/profile/history, actions/history.ts)
// ---------------------------------------------------------------------------

function twoLevel(list: IndustryGroup[], locale: Locale): TwoLevelGroup[] {
  const label = (x: { ja: string; en: string }) =>
    locale === "en" ? x.en : x.ja;
  return list.map((g) => ({
    code: g.code,
    label: label(g),
    children: g.children.map((c) => ({ code: c.code, label: label(c) })),
  }));
}

/**
 * The website's HistoryEditor for a member's history: `user` is whose it
 * is — the caller must have checked access (own history, or an admin on
 * 管理 → 会員, as the website's pages do).
 */
export async function loadHistoryEditor(
  user: { id: string },
  locale: Locale,
): Promise<HistoryEditor> {
  const [education, work] = await Promise.all([
    db.educationEntry.findMany({
      where: { userId: user.id },
      include: { school: true },
    }),
    db.workEntry.findMany({
      where: { userId: user.id },
      include: { company: true },
    }),
  ]);
  // Several entries marked 現在: say which one sets 現在の状況.
  const current = [...currentEntries(education), ...currentEntries(work)];
  const used =
    current.length > 1
      ? stageFromHistory(
          education.map((e) => ({ ...e, school: e.school.name })),
          work.map((w) => ({ ...w, company: w.company.name })),
        )
      : null;
  return {
    education: sortHistory(education).map((e) => ({
      id: e.id,
      level: e.level,
      school: { id: e.school.id, name: e.school.name },
      field: e.field,
      startYear: e.startYear,
      endYear: e.endYear,
      visibility: e.visibility,
      current: e.endYear === null,
    })),
    work: sortHistory(work).map((e) => ({
      id: e.id,
      company: { id: e.company.id, name: e.company.name },
      title: e.title,
      industry: e.industry,
      jobType: e.jobType,
      industryLabel: industryLabel(e.industry, locale),
      jobTypeLabel: jobTypeLabel(e.jobType, locale),
      startYear: e.startYear,
      endYear: e.endYear,
      visibility: e.visibility,
      current: e.endYear === null,
    })),
    multipleCurrent: used
      ? { count: current.length, detail: used.detail }
      : null,
    industries: twoLevel(INDUSTRIES, locale),
    jobTypes: twoLevel(JOB_TYPES, locale),
  };
}

const Id = z.string().max(64).optional();
const Year = str(10);
const Visibility = z.enum(["MEMBERS", "FOLLOWERS"]);

export const HistoryBody = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("education"),
    id: Id,
    level: str(40),
    school: str(500),
    schoolId: Id,
    field: str(500),
    startYear: Year,
    endYear: Year,
    visibility: Visibility,
  }),
  z.object({
    kind: z.literal("work"),
    id: Id,
    company: str(500),
    companyId: Id,
    title: str(500),
    industry: str(40),
    jobType: str(40),
    startYear: Year,
    endYear: Year,
    visibility: Visibility,
  }),
]);

/**
 * Add or edit an entry: my own, or with `userId` another member's (the
 * action then requires an admin, as on the website's 管理 → 会員).
 */
export async function saveHistory(
  input: HistoryInput,
  userId = "",
): Promise<FormOk> {
  const { kind, id, ...rest } = input;
  return formResult(
    await saveHistoryAction(
      null,
      form({ kind, id: id ?? "", userId, ...rest }),
    ),
  );
}

export const HistoryKind = z.enum(["education", "work"]);

/** Remove an entry: mine, or with `userId` (admins) another member's. */
export async function deleteHistory(
  kind: "education" | "work",
  id: string,
  userId = "",
): Promise<{ ok: true }> {
  await deleteHistoryAction(kind, id, userId);
  return { ok: true };
}

export const OrgQuery = z.object({
  kind: z.enum(["school", "company"]),
  q: z.string().max(200).default(""),
});

export async function searchOrgs(query: z.infer<typeof OrgQuery>) {
  return { options: await searchOrgsAction(query.kind, query.q) };
}

// ---------------------------------------------------------------------------
// 在校記録 (src/app/[locale]/app/(member)/profile/record, record-requests.ts)
// ---------------------------------------------------------------------------

const KNOWN_FIELDS = new Set<string>([
  "cohort",
  "yearsFrom",
  "yearsTo",
  "subjects",
  "studentIdNo",
] satisfies RecordField[]);

/** The website's RecordPage: my records, pending requests and past ones. */
export async function loadRecordPage(
  user: CurrentUser,
  locale: Locale,
): Promise<RecordPage> {
  const [t, tr, tc] = await Promise.all([
    getTranslatorFor(locale, "records"),
    getTranslatorFor(locale, "roles"),
    getTranslatorFor(locale, "common"),
  ]);
  const [requests, cohorts, cohortNumbers] = await Promise.all([
    db.recordChangeRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    loadCohortChoices(locale),
    cohortNumbersById(),
  ]);
  const cohortLabels: Record<string, string> = Object.fromEntries(
    cohorts.map((c) => [c.value, c.label]),
  );

  // RecordValue (src/components/records/record-value.tsx)
  const valueText = (field: string, value: unknown, role: RoleKey): string => {
    if (value === null || value === undefined || value === "")
      return field === "yearsTo" && role === RoleKey.TEACHER
        ? t("stillTeaching")
        : "—";
    if (field === "cohort")
      return (
        cohortLabels[String(value)] ??
        tc("cohortNumber", { number: String(value) })
      );
    return String(value);
  };

  const view = (q: (typeof requests)[number]): RecordRequestView => {
    const current = (q.current ?? {}) as Record<string, unknown>;
    const proposed = (q.proposed ?? {}) as Record<string, unknown>;
    const diff: RecordDiffRow[] = Object.keys(proposed)
      // Requests from older forms may carry fields that no longer exist.
      .filter((f) => KNOWN_FIELDS.has(f))
      .map((f) => ({
        field: f as RecordField,
        current: valueText(f, current[f], q.role),
        proposed: valueText(f, proposed[f], q.role),
      }));
    return {
      id: q.id,
      role: q.role,
      roleLabel: tr(`role.${q.role}`),
      status: q.status,
      createdAt: q.createdAt.toISOString(),
      reason: q.reason,
      reviewNote: q.reviewNote,
      diff,
    };
  };

  return {
    roles: user.roles
      .filter((r) => hasRecord(r.role))
      .map((r) => {
        const current = snapshot(r.role, {
          ...r,
          cohort: r.cohortId ? (cohortNumbers.get(r.cohortId) ?? null) : null,
        });
        const values = current as Record<string, unknown>;
        const pending = requests.find(
          (q) => q.role === r.role && q.status === ChangeRequestStatus.PENDING,
        );
        return {
          role: r.role,
          label: tr(roleLabelKey(r)),
          rows: fieldsFor(r.role).map((f) => ({
            field: f,
            value: valueText(f, values[f], r.role),
            // A teacher with no end year is still at AIS.
            stillTeaching:
              f === "yearsTo" &&
              r.role === RoleKey.TEACHER &&
              (values[f] === null || values[f] === undefined),
          })),
          fields: [...fieldsFor(r.role)],
          values: toFormValues(r.role, current),
          pending: pending ? view(pending) : null,
        };
      }),
    cohorts: cohorts.map((c) => ({
      value: String(c.value),
      label: c.label,
      graduated: c.graduated,
    })),
    history: requests
      .filter((q) => q.status !== ChangeRequestStatus.PENDING)
      .map(view),
  };
}

export const RecordBody = z.object({
  role: str(40),
  values: z.partialRecord(
    z.enum(["cohort", "yearsFrom", "yearsTo", "subjects", "studentIdNo"]),
    str(1000),
  ),
  reason: str(5000),
});

export async function submitRecordRequest(
  input: RecordRequestInput,
): Promise<FormOk> {
  return formResult(
    await submitRecordRequestAction(
      null,
      form({ role: input.role, reason: input.reason, ...input.values }),
    ),
  );
}

export async function cancelRecordRequest(id: string): Promise<{ ok: true }> {
  await cancelRecordRequestAction(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Name / birth date / gender requests
// ---------------------------------------------------------------------------

export const NameRequestBody = z.object({
  lastNameRomaji: str(500),
  firstNameRomaji: str(500),
  middleNameRomaji: str(500),
  lastNameKanji: str(500),
  firstNameKanji: str(500),
  lastNameKana: str(500),
  firstNameKana: str(500),
  nameAtAis: str(500),
  reason: str(5000),
});

export async function submitNameRequest(
  input: NameRequestInput,
): Promise<FormOk> {
  return formResult(await submitNameRequestAction(null, form(input)));
}

export const BirthDateRequestBody = z.object({
  dateOfBirth: str(40),
  reason: str(5000),
});

export async function submitBirthDateRequest(
  input: BirthDateRequestInput,
): Promise<FormOk> {
  return formResult(await submitBirthDateRequestAction(null, form(input)));
}

export const GenderRequestBody = z.object({
  gender: str(40),
  reason: str(5000),
});

export async function submitGenderRequest(
  input: GenderRequestInput,
): Promise<FormOk> {
  return formResult(await submitGenderRequestAction(null, form(input)));
}

export const GenderSetBody = z.object({ gender: str(40) });

export async function setGenderOnce(gender: string): Promise<FormOk> {
  return formResult(await setGenderOnceAction(null, form({ gender })));
}

/** Withdraw my pending request (the website's RequestStatus button). */
export async function withdrawRequest(
  kind: "name" | "birthDate" | "gender",
  id: string,
): Promise<{ ok: true }> {
  const fd = form({ id });
  if (kind === "name") await cancelNameRequestAction(fd);
  else if (kind === "birthDate") await cancelBirthDateRequestAction(fd);
  else await cancelGenderRequestAction(fd);
  return { ok: true };
}
