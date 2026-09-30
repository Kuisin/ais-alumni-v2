import type { DonationCheckout } from "@contract/donations";
import { z } from "zod";
import {
  createDonationCheckout,
  DONATION_MAX,
  DONATION_MIN,
  donationsReady,
} from "@/server/lib/donations";
import { ApiError, publicRoute, readJson } from "@/server/lib/mobile/http";
import { getCurrentUser } from "@/server/lib/session";

const Body = z.object({
  amount: z.number().int().min(DONATION_MIN).max(DONATION_MAX),
  interval: z.enum(["once", "month"]),
  locale: z.enum(["ja", "en"]).catch("ja"),
});

/**
 * 寄付, step 1 (the /donate page): a Stripe Checkout Session for this
 * amount, once or monthly → { url } to send the donor to. Open to anyone;
 * with a member's bearer token the donation is linked to their account.
 */
export const POST = publicRoute(async (request): Promise<DonationCheckout> => {
  if (!donationsReady()) throw new ApiError(404, "unavailable");
  const body = await readJson(request, Body);
  const user = await getCurrentUser();
  const url = await createDonationCheckout({
    ...body,
    origin: new URL(request.url).origin,
    user,
  });
  return { url };
});
