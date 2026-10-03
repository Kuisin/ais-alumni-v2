import { chatSyncUserIds, syncChatMembership } from "@/server/lib/chat-db";
import { db } from "@/server/lib/db";
import {
  eachIdBatch,
  eachOrFailed,
  idCursor,
  type JobContext,
  type JobStep,
  PartialFailure,
  START,
} from "@/server/lib/jobs/context";
import { statusSyncUserIds, syncMemberStatus } from "@/server/lib/status-sync";

const BATCH = 25;

/**
 * status → chat: passes over members in id order (after / failed = this
 * pass's progress); retry: only the members that failed in either pass.
 */
type Cursor = {
  phase: "status" | "chat" | "retry";
  after: string | null;
  failed: string[];
  statusFailed: string[];
};

function cursorOf(v: unknown): Cursor {
  const c = (v ?? {}) as Partial<Cursor>;
  const ids = (x: unknown) =>
    Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : [];
  return {
    phase: c.phase === "chat" || c.phase === "retry" ? c.phase : "status",
    ...idCursor(c),
    statusFailed: ids(c.statusFailed),
  };
}

/**
 * Current/former, grades and graduation as the school year and leave years
 * pass (the school year rolls over on April 1), then every member's group
 * chats. Progress is saved as it goes; members that failed are retried on
 * the following calls until they succeed.
 */
export async function syncStatus(ctx: JobContext): Promise<JobStep> {
  let cur = cursorOf(ctx.cursor);
  const save = (next: Cursor) => {
    cur = next;
    return ctx.save(next);
  };
  const status = (batch: string[]) =>
    eachOrFailed(
      batch,
      (id) => syncMemberStatus(id, db, ctx.at),
      "sync-status",
    );
  const chats = (batch: string[]) =>
    eachOrFailed(batch, (id) => syncChatMembership(id), "sync-status");
  const opts = (with_: (c: typeof START) => Cursor) => ({
    deadline: ctx.deadline,
    save: (c: typeof START) => save(with_(c)),
  });
  const paused = () => ({ done: false, cursor: cur, result: {} });

  if (cur.phase === "status") {
    const step = await eachIdBatch(
      await statusSyncUserIds(),
      cur,
      opts((c) => ({ ...c, phase: "status", statusFailed: [] })),
      BATCH,
      status,
    );
    if (!step.done) return paused();
    await save({ phase: "chat", ...START, statusFailed: step.cursor.failed });
  }

  if (cur.phase === "chat") {
    const statusFailed = cur.statusFailed;
    const step = await eachIdBatch(
      await chatSyncUserIds(),
      cur,
      opts((c) => ({ ...c, phase: "chat", statusFailed })),
      BATCH,
      chats,
    );
    if (!step.done) return paused();
    await save({
      phase: "retry",
      after: null,
      failed: step.cursor.failed,
      statusFailed,
    });
  }

  // Retry: the status failures, then the chat failures.
  const chatFailed = cur.failed;
  const s = await eachIdBatch(
    [],
    { after: null, failed: cur.statusFailed },
    opts((c) => ({
      phase: "retry",
      after: null,
      failed: chatFailed,
      statusFailed: c.failed,
    })),
    BATCH,
    status,
  );
  if (!s.done) return paused();
  const c = await eachIdBatch(
    [],
    { after: null, failed: chatFailed },
    opts((x) => ({
      phase: "retry",
      after: null,
      failed: x.failed,
      statusFailed: s.cursor.failed,
    })),
    BATCH,
    chats,
  );
  if (!c.done) return paused();
  const failed = s.cursor.failed.length + c.cursor.failed.length;
  if (failed)
    throw new PartialFailure(`${failed} member sync(s) failed`, { failed });
  return { done: true, result: { failed: 0 } };
}
