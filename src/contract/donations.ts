// ---- POST /donate/checkout (public; a member's token links it) ----

export type DonationInterval = "once" | "month";

export type DonationCheckoutRequest = {
  /** yen, 500–1,000,000 */
  amount: number;
  interval: DonationInterval;
  locale: "ja" | "en";
};

/** Stripe Checkout: send the donor here. */
export type DonationCheckout = { url: string };

/** none, part of it or all of it given back (Stripe refunds) */
export type DonationRefund = "none" | "partial" | "full";

// ---- GET /me/donations (ACTIVE member: only their own) ----

/** One successful payment: a one-time donation, or one month of a
 *  monthly donation. Amounts in yen (JPY has no minor unit). */
export type MyDonation = {
  id: string;
  /** ISO time it was paid */
  date: string;
  amount: number;
  /** yen given back (0 when none) */
  refundedAmount: number;
  refund: DonationRefund;
  interval: DonationInterval;
  /** Stripe's receipt page, when there is one */
  receiptUrl: string | null;
};

/** A monthly donation that is still running. */
export type MyMonthlyDonation = {
  amount: number;
  /** ISO: the next payment (null: it stops at endsAt instead) */
  nextDate: string | null;
  /** ISO: set to stop on this date */
  endsAt: string | null;
};

export type MyDonations = {
  /** false: donations aren't set up on this server (everything empty) */
  available: boolean;
  /** newest first */
  donations: MyDonation[];
  /** yen, after refunds */
  total: number;
  monthly: MyMonthlyDonation[];
  /** Stripe's Customer Portal login (change / stop a monthly donation) */
  portalUrl: string | null;
};

// ---- GET /admin/donations?cursor= (committee admins) ----

export type AdminDonation = {
  id: string;
  date: string;
  amount: number;
  refundedAmount: number;
  refund: DonationRefund;
  interval: DonationInterval;
  /** the member who gave; null: a guest (shown as 匿名 — never the
   *  donor's Stripe name or email) */
  donor: { id: string; name: string } | null;
};

/** Yen after refunds, Japan time; null where too many payments to add up. */
export type AdminDonationTotals = {
  month: number | null;
  year: number | null;
  allTime: number | null;
  /** monthly donations running now */
  activeMonthly: number | null;
};

export type AdminDonations = {
  available: boolean;
  /** newest first */
  donations: AdminDonation[];
  nextCursor: string | null;
  /** on the first page only (no cursor) */
  totals: AdminDonationTotals | null;
};
