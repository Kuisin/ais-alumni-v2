import { loadMyDonations } from "@/server/lib/donations-history";
import { mobileRoute } from "@/server/lib/mobile/http";

/** 寄付の履歴: only the member's own donations (contract: MyDonations). */
export const GET = mobileRoute(async ({ user }) => loadMyDonations(user.id));
