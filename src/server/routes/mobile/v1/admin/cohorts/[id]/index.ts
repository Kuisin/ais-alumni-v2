import { z } from "zod";
import {
  deleteCohortAction,
  updateCohortAction,
} from "@/server/app/actions/admin-cohorts";
import { IdParam, mobileRoute, readJson } from "@/server/lib/mobile/http";

const Body = z.object({
  elementaryStartYear: z.string().max(10),
  elementaryEndYear: z.string().max(10),
  note: z.string().max(1000),
});

/** Save a 学年's years and note → AdminFormResult (key in "cohorts"). */
export const PUT = mobileRoute<{ id: string }>(async ({ request, params }) => {
  const body = await readJson(request, Body);
  const fd = new FormData();
  fd.set("id", IdParam.parse(params.id));
  fd.set("elementaryStartYear", body.elementaryStartYear);
  fd.set("elementaryEndYear", body.elementaryEndYear);
  fd.set("note", body.note);
  return (await updateCohortAction(null, fd)) ?? {};
});

/** Delete an unused 学年 (the action ignores ones in use). */
export const DELETE = mobileRoute<{ id: string }>(async ({ params }) => {
  await deleteCohortAction(IdParam.parse(params.id));
  return { ok: true };
});
