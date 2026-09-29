import type { EvidenceUploaded } from "@contract/onboarding";
import { ApiError, invalid, mobileRoute } from "@/server/lib/mobile/http";
import {
  APPLICANT_STATES,
  inState,
  uploadEvidence,
} from "@/server/lib/mobile/onboarding";

/**
 * Upload one evidence file (multipart/form-data: file, kind = DIPLOMA |
 * OTHER). Errors: type, size (verify.evidence.errors.<code>). It's attached
 * to the application when the form is sent.
 */
export const POST = mobileRoute(async ({ request }) => {
  const user = await inState(...APPLICANT_STATES);
  // The web FormData (React Native's global type has no get()).
  let form: { get(name: string): unknown };
  try {
    form = (await request.formData()) as unknown as typeof form;
  } catch {
    throw invalid();
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw invalid();
  try {
    return {
      item: await uploadEvidence(user, file, form.get("kind")),
    } satisfies EvidenceUploaded;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error("[verify] upload failed", e);
    throw new ApiError(500, "generic");
  }
}, "user");
