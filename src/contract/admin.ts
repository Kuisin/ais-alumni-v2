/**
 * 管理モード (the website's /app/admin). Pure types only (see core.ts):
 * change additively.
 */

// ---- GET /admin — admin-mode home (staff only) ----

/**
 * Work waiting for the committee (the website's admin sidebar badges).
 * All zero for staff who aren't committee admins.
 */
export type AdminCounts = {
  /** 本人確認: pending applications (not the ones following a parent's) */
  verification: number;
  /** 在籍情報の修正 */
  recordRequests: number;
  /** 氏名・生年月日: name, birth date and gender requests */
  nameRequests: number;
  /** お問い合わせ still open */
  support: number;
  /** チャット: reports still open */
  chat: number;
};

export type AdminHome = { counts: AdminCounts };

// ---- 名簿 (roster; committee admins) ----

/** Role keys used by the roster (RoleKey). */
export type RosterKind =
  | "TEACHER"
  | "CURRENT_STUDENT"
  | "CURRENT_PARENT"
  | "FORMER_STUDENT"
  | "FORMER_PARENT";

/** GET /admin/roster — what the roster holds. */
export type AdminRoster = {
  byKind: { kind: RosterKind; count: number }[];
  total: number;
  /** rows linked to an approved member */
  claimed: number;
};

/** A CSV row the import rejected (adminVerify.roster.rowErrors.<error>). */
export type RosterRowError = {
  line: number;
  error:
    | "missingName"
    | "badDate"
    | "badYear"
    | "yearsOrder"
    | "badKind"
    | "tooManyColumns";
};

/**
 * POST /admin/roster/import (multipart: `file` or `csv`, `intent`) — the
 * preview or import result (adminVerify.roster.messages.<message>).
 */
export type RosterImportResult = {
  ok: boolean;
  mode?: "preview" | "import";
  message?:
    | "forbidden"
    | "empty"
    | "tooMany"
    | "hasErrors"
    | "imported"
    | "preview"
    | "generic";
  total?: number;
  byKind?: Partial<Record<RosterKind, number>>;
  /** the first 20 */
  errors?: RosterRowError[];
  errorCount?: number;
  imported?: number;
};

/** DELETE /admin/roster { confirm: true } — delete every row. */
export type RosterDeleteResult = {
  ok: boolean;
  message?: "forbidden" | "confirm" | "deleted";
  deleted?: number;
};
