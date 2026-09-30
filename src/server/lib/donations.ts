import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import type { CurrentUser } from "@/server/lib/session";

/**
 * 寄付 (donations to run the alumni association) through Stripe Checkout:
 * one-time (mode "payment") or monthly (mode "subscription"), any amount,
 * from anyone — a signed-in member's donation is linked to their account
 * (their Stripe Customer carries metadata.userId), others give as guests.
 *
 * Stripe is the ledger: nothing is stored in our database except the
 * audit log entries the webhook writes (src/app/api/stripe/webhook+api.ts).
 * Donations aren't consideration for anything, so no consumption tax
 * (不課税): no automatic_tax.
 *
 * Env: STRIPE_SECRET_KEY (Vercel Marketplace integration),
 * STRIPE_WEBHOOK_SECRET (the webhook endpoint's signing secret),
 * STRIPE_PORTAL_LOGIN_URL (optional: the Customer Portal's login link,
 * where monthly donors change or stop their donation).
 */

export const DONATION_MIN = 500;
export const DONATION_MAX = 1_000_000;
export type DonationInterval = "once" | "month";

let client: Stripe | null = null;

export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

/**
 * Donations are offered when Stripe is set up — in production only with a
 * live key, so the real site never takes test-mode "donations" (staging
 * and local development use the sandbox's test keys).
 */
export function donationsReady(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return false;
  return process.env.VERCEL_ENV !== "production" || /^(sk|rk)_live_/.test(key);
}

export function portalLoginUrl(): string | null {
  const url = process.env.STRIPE_PORTAL_LOGIN_URL?.trim();
  return url?.startsWith("https://") ? url : null;
}

/** Tags our sessions in the Dashboard (Stripe asks for 8 random letters). */
function integrationIdentifier(): string {
  const letters = Array.from(randomBytes(8), (b) =>
    String.fromCharCode(97 + (b % 26)),
  ).join("");
  return `ais-donation-${letters}`;
}

/** The member's Stripe Customer (found by metadata.userId, else created). */
async function customerFor(s: Stripe, user: CurrentUser): Promise<string> {
  const found = await s.customers.search({
    query: `metadata['userId']:'${user.id}'`,
    limit: 1,
  });
  const existing = found.data[0];
  if (existing) return existing.id;
  const created = await s.customers.create({
    email: user.primaryEmail ?? undefined,
    metadata: { userId: user.id },
  });
  return created.id;
}

/** A Checkout Session for one donation; the URL to send the donor to. */
export async function createDonationCheckout(params: {
  amount: number;
  interval: DonationInterval;
  locale: "ja" | "en";
  origin: string;
  user: CurrentUser | null;
}): Promise<string> {
  const s = stripe();
  if (!s) throw new Error("Stripe is not configured");
  const { amount, interval, locale, origin, user } = params;
  const monthly = interval === "month";
  const product = {
    name: locale === "en" ? "Donation to AIS Alumni" : "AIS同窓会への寄付",
    description:
      locale === "en"
        ? "Supports running the AIS Alumni Committee (not tax-deductible)."
        : "AIS同窓会委員会の運営に使われます（寄付金控除の対象外）。",
  };
  const customer = user ? await customerFor(s, user) : undefined;
  const metadata = user ? { userId: user.id } : undefined;
  const session = await s.checkout.sessions.create({
    mode: monthly ? "subscription" : "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: amount,
          product_data: product,
          ...(monthly ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    ...(customer ? { customer } : {}),
    ...(monthly
      ? { subscription_data: { metadata } }
      : {
          submit_type: "donate" as const,
          payment_intent_data: { metadata },
          // Guests too, so receipts and the portal know them.
          ...(customer ? {} : { customer_creation: "always" as const }),
        }),
    client_reference_id: user?.id,
    metadata,
    locale,
    success_url: `${origin}/donate?done=1`,
    cancel_url: `${origin}/donate`,
    integration_identifier: integrationIdentifier(),
  });
  if (!session.url) throw new Error("Checkout Session without a URL");
  return session.url;
}

/** The member a Checkout Session / Subscription belongs to, if any. */
function memberId(obj: {
  client_reference_id?: string | null;
  metadata?: Stripe.Metadata | null;
}): string | null {
  return obj.client_reference_id ?? obj.metadata?.userId ?? null;
}

async function existingUser(id: string | null): Promise<string | null> {
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * A verified webhook event: record what happened in the audit log (who,
 * how much, once or monthly). Stripe sends receipts itself (Dashboard →
 * Settings → Customer emails) and retries, dunning and cancellations are
 * Billing's; this only keeps the committee's log in step.
 */
export async function recordDonationEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      // Delayed methods complete unpaid; they're recorded when they succeed.
      if (session.payment_status === "unpaid") return;
      await audit(
        await existingUser(memberId(session)),
        session.mode === "subscription"
          ? "donation.monthly_started"
          : "donation.received",
        { type: "CheckoutSession", id: session.id },
        {
          amount: session.amount_total,
          currency: session.currency,
          guest: !memberId(session),
        },
      );
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      // The first invoice is the checkout above; record the renewals.
      if (invoice.billing_reason !== "subscription_cycle") return;
      await audit(
        null,
        "donation.monthly_paid",
        { type: "Invoice", id: invoice.id ?? "" },
        { amount: invoice.amount_paid, currency: invoice.currency },
      );
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await audit(
        await existingUser(sub.metadata?.userId ?? null),
        "donation.monthly_stopped",
        { type: "Subscription", id: sub.id },
      );
      return;
    }
    default:
      return;
  }
}
