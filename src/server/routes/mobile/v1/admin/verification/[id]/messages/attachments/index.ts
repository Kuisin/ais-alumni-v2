import { z } from "zod";
import { uploadAdminAttachment } from "@/server/lib/mobile/admin-verification";
import {
  ApiError,
  IdParam,
  invalid,
  mobileRoute,
} from "@/server/lib/mobile/http";
import { discardThreadAttachment } from "@/server/lib/mobile/verification-messages";
import { formFile } from "@/server/lib/verification/uploads";

/**
 * 「やりとり」: upload one photo / PDF for the committee's next message
 * (multipart: file; contract: MessageAttachmentUploaded; errors 400 type /
 * size, 404, 409 closed). Committee admins only.
 */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params, locale }) => {
    const id = IdParam.parse(params.id);
    const picked = await formFile(request);
    if (!picked) throw invalid();
    try {
      return await uploadAdminAttachment(user, id, picked.file, locale);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.error("[verification] attachment upload failed", e);
      throw new ApiError(500, "generic");
    }
  },
);

const Key = z.string().min(1).max(500);

/** ?key=: remove an upload of mine that wasn't sent ({ ok: true }). */
export const DELETE = mobileRoute<{ id: string }>(async ({ request, user }) =>
  discardThreadAttachment(
    user,
    Key.parse(new URL(request.url).searchParams.get("key")),
  ),
);
