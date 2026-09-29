/**
 * Writing ニュース and イベント — the website's NewsForm / EventForm with the
 * 「受け取る人」 picker (member /app/news/new, /app/events/new; admin mode's
 * /app/admin/news/[id], /app/admin/events/[id] edit with the same forms).
 * Pure types (see core.ts). Authors: admins, current teachers, 同窓会委員 and
 * 学年代表 (newsScope); everything else answers 403 forbidden.
 *
 *   GET  /compose                        → ComposeOptions
 *   POST /compose/news      (multipart)  → ComposeSaved | ComposeFormError
 *   POST /compose/events    (multipart)  → ComposeSaved | ComposeFormError
 *   POST /compose/files     (multipart)  → ComposeFileResult
 *   POST /compose/audience  AudienceSpec → AudienceCount
 *   GET  /compose/members?q=…            → { members: AudienceMember[] }
 */

/** A 「受け取る人」 group (the website's AUDIENCE_GROUPS; LEFT_STUDENT: older posts). */
export type AudienceGroup =
  | "TEACHER_CURRENT"
  | "TEACHER_FORMER"
  | "CURRENT_STUDENT"
  | "CURRENT_PARENT"
  | "GRADUATE"
  | "FORMER_STUDENT"
  | "FORMER_PARENT"
  | "LEFT_STUDENT";

/**
 * Who receives a post / is invited to an event: any of these conditions;
 * nothing selected = every member.
 */
export type AudienceSpec = {
  groups: AudienceGroup[];
  cohortIds: string[];
  /** also the parents of children in `cohortIds` */
  includeParents: boolean;
  userIds: string[];
};

/** An individually chosen member. */
export type AudienceMember = { id: string; name: string; kanji: string | null };

/** Who the author may send to (the website's NewsScope). */
export type ComposeScope =
  | { kind: "ANY" }
  /** current teachers: always includes current teachers */
  | { kind: "TEACHER" }
  /** 同窓会委員: anyone, once another 同窓会委員 approves */
  | { kind: "COMMITTEE" }
  /** 学年代表: their own 学年 only */
  | { kind: "COHORT"; cohortIds: string[] };

export type CohortOption = { id: string; label: string; graduated: boolean };

// ---- GET /compose ----

export type ComposeOptions = {
  scope: ComposeScope;
  /** existing 学年, for the picker */
  cohorts: CohortOption[];
  /** groups offered in the picker, in order */
  groups: AudienceGroup[];
  /** 「〇〇として送信します」: the role members see (news.sender.postingAs) */
  role: string;
  limits: {
    maxAttachments: number;
    attachmentMaxBytes: number;
    attachmentTypes: string[];
    coverMaxBytes: number;
    maxPollOptions: number;
    maxScheduleOptions: number;
  };
};

// ---- Form values (dates: "YYYY-MM-DDTHH:mm" in Japan time, "" = none) ----

/** 配信: how the post goes out. KEEP = already published, leave it. */
export type Delivery = "NOW" | "SCHEDULE" | "DRAFT" | "KEEP";

export type NewsStatus = "draft" | "scheduled" | "published";

export type AttachmentItem = {
  /** saved attachment */
  id?: string;
  /** storage key */
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type PollValue = {
  question: string;
  multiple: boolean;
  options: { id?: string; label: string }[];
};

export type ScheduleValue = {
  question: string;
  options: { id?: string; startsAt: string; label: string }[];
};

export type HubValues = {
  requireConfirm: boolean;
  allowComments: boolean;
  deadline: string;
  poll: PollValue | null;
  schedule: ScheduleValue | null;
  attachments: AttachmentItem[];
};

export type NewsFormValues = {
  id?: string;
  titleJa: string;
  titleEn: string;
  bodyJa: string;
  bodyEn: string;
  /** null = new post */
  status: NewsStatus | null;
  sendAt: string;
  notifyOnPublish: boolean;
  pinned: boolean;
  audience: AudienceSpec;
  /** names for `audience.userIds` */
  audienceMembers: AudienceMember[];
  /** signed URL of the current cover */
  coverPreviewUrl: string | null;
  hub: HubValues;
};

export type EventFormValues = {
  id?: string;
  titleJa: string;
  titleEn: string;
  bodyJa: string;
  bodyEn: string;
  startsAt: string;
  endsAt: string;
  rsvpDeadline: string;
  location: string;
  mapUrl: string;
  /** digits, "" = no limit */
  capacity: string;
  audience: AudienceSpec;
  audienceMembers: AudienceMember[];
};

// ---- POST /compose/news, /compose/events ----
// multipart/form-data with the website form's fields: id (edit), titleJa,
// titleEn, bodyJa, bodyEn, audience (AudienceSpec JSON) and
//   news:   delivery, sendAt, notifyOnPublish=on, pinned=on, requireConfirm=on,
//           allowComments=on, deadline, poll / schedule / attachments (JSON),
//           cover (JPEG/PNG file), removeCover=on
//   events: startsAt, endsAt, rsvpDeadline, location, mapUrl, capacity

export type ComposeSaved = {
  ok: true;
  id: string;
  /**
   * What the website shows next: "notify" = the 「通知を送る」 confirm step
   * (/app/admin/news/[id]?notify=1), "created" = the new post / event in
   * admin mode (?created=1), null = saved in place.
   */
  next: "notify" | "created" | null;
};

/**
 * 400 { error: "validation", fieldErrors } — keys in adminContent.errors;
 * 403 forbidden; 404 notFound (editing a deleted post).
 */
export type ComposeFormError = {
  error: string;
  fieldErrors?: Record<string, string>;
};

// ---- POST /compose/files (multipart: file) ----
// errors (adminContent.hub.files.errors): type, size, forbidden, generic

export type ComposeFileResult = { ok: true; item: AttachmentItem };

// ---- POST /compose/audience ----

/** ACTIVE members the audience reaches, as saved (a teacher's post also reaches teachers). */
export type AudienceCount = { count: number };
