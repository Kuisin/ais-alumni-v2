/**
 * The application's rules, shared with the server: the same Zod schema
 * validates each step here and the submission there, and the 学年 /
 * status preview uses the same school calendar. These modules are pure
 * (no database, no Node APIs), so the app bundles them as they are.
 */
export { classYears } from "@/server/lib/class-names";
export {
  type CohortChoice,
  elementaryEndFor,
  gradeLabel,
  parseCohortNumber,
} from "@/server/lib/cohorts";
export { GENDERS } from "@/server/lib/gender";
export { composeKanji, composeRomaji } from "@/server/lib/names";
export {
  isCurrentTeacher,
  schoolYearStart,
  studentStatus,
} from "@/server/lib/school";
export {
  applicantGraduated,
  type ChildMode,
  type ChildState,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_TYPES,
  type EvidenceItem,
  type EvidenceKindValue,
  emptyChild,
  issuesToErrors,
  MAX_CHILDREN,
  MEMBER_TYPES,
  type MemberType,
  STEPS,
  type Step,
  stepOfPath,
  toPayload,
  type VerifyFormState,
  verificationSchema,
} from "@/server/lib/verification/schema";

export type Errors = Record<string, string>;
