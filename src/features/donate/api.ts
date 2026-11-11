import type { MyDonations } from "@contract/donations";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const MY_DONATIONS_KEY = ["me", "donations"] as const;

/** 寄付の履歴: the member's own donations (GET /me/donations). */
export function useMyDonations() {
  return useQuery({
    queryKey: MY_DONATIONS_KEY,
    queryFn: ({ signal }) => api<MyDonations>("/me/donations", { signal }),
  });
}
