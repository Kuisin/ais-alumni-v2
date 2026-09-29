import type {
  AudienceGroup,
  ComposeFormError,
  ComposeOptions,
  ComposeSaved,
} from "@contract/compose";
import { getTranslations } from "next-intl/server";
import type { AdminFormState } from "@/server/app/actions/admin-content";
import { cohortShortLabels, loadCohortOptions } from "@/server/lib/cohorts-db";
import { ApiError, forbidden, json } from "@/server/lib/mobile/http";
import { COVER_MAX_BYTES } from "@/server/lib/news";
import { AUDIENCE_GROUPS } from "@/server/lib/news-audience";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
  MAX_POLL_OPTIONS,
  MAX_SCHEDULE_OPTIONS,
} from "@/server/lib/news-hub";
import { type NewsScope, senderRoleFor } from "@/server/lib/permissions";
import { roleLabel } from "@/server/lib/sender";
import { actionNewsAuthor, type CurrentUser } from "@/server/lib/session";

/**
 * Writing ニュース and イベント (contract: compose.ts): what the website's
 * /app/news/new and /app/events/new pages load for their forms. Saving goes
 * through the website's own actions (src/server/app/actions/admin-content.ts).
 */

/** The author and what they may send to; 403 for everyone else. */
export async function composer(): Promise<{
  user: CurrentUser;
  scope: NewsScope;
}> {
  const a = await actionNewsAuthor().catch(() => null);
  if (!a) throw forbidden();
  return a;
}

export async function composeOptions(
  locale: "ja" | "en",
): Promise<ComposeOptions> {
  const { scope } = await composer();
  const [cohorts, short, ts] = await Promise.all([
    loadCohortOptions(locale),
    cohortShortLabels(locale),
    getTranslations({ locale, namespace: "news.sender" }),
  ]);
  // Members see the role the post is sent as, not the author's name.
  const role = roleLabel(senderRoleFor(scope), ts, () =>
    scope.kind === "COHORT"
      ? scope.cohortIds
          .map((id) => short[id])
          .join(locale === "ja" ? "・" : ", ")
      : "",
  );
  return {
    scope:
      scope.kind === "COHORT"
        ? { kind: "COHORT", cohortIds: [...scope.cohortIds] }
        : { kind: scope.kind },
    cohorts,
    groups: [...AUDIENCE_GROUPS] as AudienceGroup[],
    role,
    limits: {
      maxAttachments: MAX_ATTACHMENTS,
      attachmentMaxBytes: ATTACHMENT_MAX_BYTES,
      attachmentTypes: [...ATTACHMENT_TYPES],
      coverMaxBytes: COVER_MAX_BYTES,
      maxPollOptions: MAX_POLL_OPTIONS,
      maxScheduleOptions: MAX_SCHEDULE_OPTIONS,
    },
  };
}

/** A multipart body (the website form's fields); 400 for anything else. */
export async function readForm(request: Request): Promise<FormData> {
  try {
    return (await request.formData()) as unknown as FormData;
  } catch {
    throw new ApiError(400, "invalid");
  }
}

/** A save action's state as the API answer. */
export function savedResponse(state: AdminFormState): Response {
  if (state.ok && state.id)
    return json({
      ok: true,
      id: state.id,
      next: state.next ?? null,
    } satisfies ComposeSaved);
  const error = state.error ?? "generic";
  const status = error === "forbidden" ? 403 : error === "notFound" ? 404 : 400;
  return json(
    { error, fieldErrors: state.fieldErrors } satisfies ComposeFormError,
    { status },
  );
}
