import { isAuthorizedCron } from "@/server/lib/cron";
import { isJobName, runDueJobs, runJob } from "@/server/lib/jobs";

/**
 * The one cron endpoint (src/server/lib/jobs): Supabase pg_cron calls it
 * every minute (`Authorization: Bearer $CRON_SECRET`) to work through
 * whatever is due. ?task=<name> runs that task now. Vercel stops a call at
 * maxDuration (vercel.json, 300 s); the jobs' time budget
 * (src/server/lib/jobs/budget.ts) keeps each call well inside it.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request))
    return new Response("Unauthorized", { status: 401 });
  const now = new Date();
  const task = new URL(request.url).searchParams.get("task");
  if (task === null)
    return Response.json({
      ok: true,
      ranAt: now.toISOString(),
      tasks: await runDueJobs(now),
    });
  if (!isJobName(task)) return new Response("Unknown task", { status: 404 });
  const outcome = await runJob(task, now);
  return Response.json(
    {
      ok: !outcome.error,
      task,
      ranAt: now.toISOString(),
      done: outcome.done,
      ...(outcome.error ? { error: outcome.error } : {}),
      ...outcome.result,
    },
    { status: outcome.error ? 500 : 200 },
  );
}
