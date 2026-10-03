import {
  type JobContext,
  type JobStep,
  PartialFailure,
  pastDeadline,
} from "@/server/lib/jobs/context";
import { dueScheduledNews, sendNewsNotification } from "@/server/lib/news";
import { sendDeadlineReminders } from "@/server/lib/news-hub-db";

/**
 * Reserved ニュース whose time has come, and the one reminder a day before
 * a response deadline. Each post is claimed with a lease; a send that fails,
 * stops at the deadline or is killed is picked up by the next call (every
 * minute) and reaches only those not reached yet.
 */
export async function publishDueNews(ctx: JobContext): Promise<JobStep> {
  const now = ctx.at;
  let posts = 0;
  let recipients = 0;
  let unfinished = 0;
  let failed = 0;
  for (const post of await dueScheduledNews(now)) {
    if (pastDeadline(ctx)) {
      unfinished++;
      continue;
    }
    try {
      const res = await sendNewsNotification(post.id, now, {
        deadline: ctx.deadline,
      });
      if (!res) continue;
      posts++;
      recipients += res.recipients;
      if (res.failed) failed++;
      else if (!res.done) unfinished++;
    } catch (e) {
      failed++;
      console.error(`[jobs/publish-news] ${post.id} failed`, e);
    }
  }
  const reminders = await sendDeadlineReminders(now, {
    deadline: ctx.deadline,
  });
  const result = { posts, recipients, unfinished, reminders };
  if (failed || reminders.unfinished)
    throw new PartialFailure(
      `${failed} post(s) and ${reminders.unfinished} reminder(s) not finished`,
      result,
    );
  return { done: unfinished === 0, result };
}
