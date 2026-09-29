import { waitUntil } from "@vercel/functions";

/**
 * `next/server`'s `after`: work to finish after the response is sent (on
 * Vercel the function stays alive until it's done).
 */
export function after(task: Promise<unknown> | (() => unknown)): void {
  const run = typeof task === "function" ? Promise.resolve().then(task) : task;
  const guarded = run.catch((e) => console.error("[after]", e));
  try {
    waitUntil(guarded);
  } catch {
    // Not on Vercel (local server): the promise just runs.
  }
}
