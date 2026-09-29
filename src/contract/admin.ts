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
