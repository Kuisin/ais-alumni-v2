import { answerVouch, vouchPage } from "@/server/lib/mobile/family";
import { IdParam, mobileRoute } from "@/server/lib/mobile/http";

/** 「この方をご存じですか？」 (contract: VouchPage; only the asked voucher). */
export const GET = mobileRoute<{ id: string }>(({ user, params, locale }) =>
  vouchPage(user, IdParam.parse(params.id), locale),
);

/** {answer}: YES | NO | NOT_SURE (contract: Ok; errors vouch.messages.<code>). */
export const POST = mobileRoute<{ id: string }>(
  async ({ request, user, params }) =>
    answerVouch(
      user,
      IdParam.parse(params.id),
      await request.json().catch(() => null),
    ),
);
