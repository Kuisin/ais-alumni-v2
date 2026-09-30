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
