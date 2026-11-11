import type {
  AdminDonation,
  AdminDonations,
  AdminDonationTotals,
  DonationRefund,
  MyDonation,
  MyDonations,
  MyMonthlyDonation,
} from "@contract/donations";
import type Stripe from "stripe";
import { db } from "@/server/lib/db";
import { donationsReady, portalLoginUrl, stripe } from "@/server/lib/donations";
import { displayName } from "@/server/lib/format";
import { ApiError, invalid } from "@/server/lib/mobile/http";

/**
 * 寄付の履歴, read from Stripe (the ledger — nothing is stored here).
 *
 * One donation = one succeeded PaymentIntent: a one-time Checkout payment
 * has exactly one, and every paid invoice of a monthly donation is paid by
 * exactly one (a failed attempt and its retries are the same PaymentIntent,
 * so a donation never shows twice, and a failed payment never shows).
 * Refunds stay on that PaymentIntent's latest_charge. Whether it was
 * monthly: an Invoice Payment links it to an invoice; one-time Checkout
 * payments are marked donation=once (createDonationCheckout), so only the
 * others are looked up.
 */

const ONCE_MARK = "once";

/** Whether Stripe answers at all here (else: the empty "not available"). */
function client(): Stripe | null {
  return donationsReady() ? stripe() : null;
}

function stripeFailed(e: unknown): never {
  console.error("[donations]", e instanceof Error ? e.message : e);
  throw new ApiError(502, "stripe_unavailable");
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

function refundOf(pi: Stripe.PaymentIntent): {
  refundedAmount: number;
  refund: DonationRefund;
} {
  const charge =
    pi.latest_charge && typeof pi.latest_charge === "object"
      ? pi.latest_charge
      : null;
  const refundedAmount = charge?.amount_refunded ?? 0;
  return {
    refundedAmount,
    refund:
      refundedAmount <= 0
        ? "none"
        : refundedAmount >= pi.amount_received
          ? "full"
          : "partial",
  };
}

/** A paid donation (succeeded, in yen). */
const isDonation = (pi: Stripe.PaymentIntent) =>
  pi.status === "succeeded" && pi.currency === "jpy";

/** Runs fn over items, a few at a time (Stripe's rate limits). */
async function eachLimited<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}

/** The PaymentIntents among these that paid a subscription invoice. */
async function monthlyIntents(
  s: Stripe,
  pis: Stripe.PaymentIntent[],
): Promise<Set<string>> {
  const monthly = new Set<string>();
  const unknown = pis.filter((pi) => pi.metadata?.donation !== ONCE_MARK);
  await eachLimited(unknown, 4, async (pi) => {
    const found = await s.invoicePayments.list({
      payment: { type: "payment_intent", payment_intent: pi.id },
      limit: 1,
    });
    if (found.data.length > 0) monthly.add(pi.id);
  });
  return monthly;
}

// ---- The member's own ----

const MY_MAX = 100;

/** GET /me/donations: only this member's (customers with metadata.userId). */
export async function loadMyDonations(userId: string): Promise<MyDonations> {
  const s = client();
  if (!s)
    return {
      available: false,
      donations: [],
      total: 0,
      monthly: [],
      portalUrl: null,
    };
  try {
    // A member may have more than one Customer (e.g. created twice).
    const customers = await s.customers
      .search({ query: `metadata['userId']:'${userId}'`, limit: 10 })
      .autoPagingToArray({ limit: 10 });
    const ids = customers
      .filter((c) => c.metadata?.userId === userId)
      .map((c) => c.id);
    const [pis, subs] = await Promise.all([
      Promise.all(
        ids.map((customer) =>
          s.paymentIntents
            .list({ customer, limit: 100, expand: ["data.latest_charge"] })
            .autoPagingToArray({ limit: MY_MAX }),
        ),
      ).then((lists) => lists.flat().filter(isDonation)),
      Promise.all(
        ids.map((customer) =>
          s.subscriptions
            .list({ customer, status: "active", limit: 20 })
            .autoPagingToArray({ limit: 20 }),
        ),
      ).then((lists) => lists.flat()),
    ]);
    pis.sort((a, b) => b.created - a.created);
    const monthly = await monthlyIntents(s, pis);
    const donations: MyDonation[] = pis.map((pi) => {
      const charge =
        pi.latest_charge && typeof pi.latest_charge === "object"
          ? pi.latest_charge
          : null;
      return {
        id: pi.id,
        date: iso(pi.created),
        amount: pi.amount_received,
        ...refundOf(pi),
        interval: monthly.has(pi.id) ? "month" : "once",
        receiptUrl: charge?.receipt_url ?? null,
      };
    });
    return {
      available: true,
      donations,
      total: donations.reduce((n, d) => n + d.amount - d.refundedAmount, 0),
      monthly: subs.map(monthlyOf).filter((m) => m !== null),
      portalUrl: portalLoginUrl(),
    };
  } catch (e) {
    stripeFailed(e);
  }
}

function monthlyOf(sub: Stripe.Subscription): MyMonthlyDonation | null {
  if (sub.currency !== "jpy") return null;
  const item = sub.items.data[0];
  if (!item) return null;
  const amount = sub.items.data.reduce(
    (n, i) => n + (i.price.unit_amount ?? 0) * (i.quantity ?? 1),
    0,
  );
  const stops = sub.cancel_at ?? null;
  return {
    amount,
    nextDate:
      stops !== null || sub.cancel_at_period_end
        ? null
        : iso(item.current_period_end),
    endsAt:
      stops !== null
        ? iso(stops)
        : sub.cancel_at_period_end
          ? iso(item.current_period_end)
          : null,
  };
}

// ---- 管理モード → 寄付 ----

const PAGE = 25;
const TOTALS_MAX = 1000;
const CURSOR = /^pi_[A-Za-z0-9]{1,64}$/;

/** The member behind a payment: its Customer's metadata.userId. */
function memberIdOf(pi: Stripe.PaymentIntent): string | null {
  const c = pi.customer;
  const fromCustomer =
    c && typeof c === "object" && !("deleted" in c && c.deleted)
      ? ((c as Stripe.Customer).metadata?.userId ?? null)
      : null;
  return fromCustomer ?? pi.metadata?.userId ?? null;
}

/** GET /admin/donations?cursor=: every donation, newest first. */
export async function loadAdminDonations(
  cursor: string | undefined,
): Promise<AdminDonations> {
  if (cursor !== undefined && !CURSOR.test(cursor)) throw invalid();
  const s = client();
  if (!s)
    return { available: false, donations: [], nextCursor: null, totals: null };
  try {
    const pis: Stripe.PaymentIntent[] = [];
    let last = cursor;
    let hasMore = true;
    // Failed / abandoned payments are skipped; a few pages fill one.
    for (let i = 0; i < 4 && hasMore && pis.length < PAGE; i++) {
      const page = await s.paymentIntents.list({
        limit: PAGE,
        ...(last ? { starting_after: last } : {}),
        expand: ["data.customer", "data.latest_charge"],
      });
      pis.push(...page.data.filter(isDonation));
      hasMore = page.has_more;
      last = page.data.at(-1)?.id ?? last;
    }
    const [monthly, totals, names] = await Promise.all([
      monthlyIntents(s, pis),
      cursor ? Promise.resolve(null) : adminTotals(s),
      memberNames(pis.map(memberIdOf)),
    ]);
    const donations: AdminDonation[] = pis.map((pi) => {
      const id = memberIdOf(pi);
      const name = id ? names.get(id) : undefined;
      return {
        id: pi.id,
        date: iso(pi.created),
        amount: pi.amount_received,
        ...refundOf(pi),
        interval: monthly.has(pi.id) ? "month" : "once",
        // Only members are named; guests' Stripe details stay in Stripe.
        donor: id && name ? { id, name } : null,
      };
    });
    return {
      available: true,
      donations,
      nextCursor: hasMore ? (last ?? null) : null,
      totals,
    };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    stripeFailed(e);
  }
}

async function memberNames(
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, nameRomaji: true, nameKanji: true },
  });
  return new Map(users.map((u) => [u.id, displayName(u)]));
}

/** Japan time (UTC+9, no DST): the start of this month and year, in seconds. */
function jstStarts(now = new Date()): { month: number; year: number } {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth();
  return {
    month: Date.UTC(y, m, 1) / 1000 - 9 * 3600,
    year: Date.UTC(y, 0, 1) / 1000 - 9 * 3600,
  };
}

let totalsCache: { at: number; value: AdminDonationTotals } | null = null;
const TOTALS_TTL = 60_000;

/**
 * This month / this year / all time (after refunds) and the monthly
 * donations running: one pass over the newest payments, up to TOTALS_MAX —
 * a period it didn't reach the start of is null rather than wrong.
 */
async function adminTotals(s: Stripe): Promise<AdminDonationTotals> {
  if (totalsCache && Date.now() - totalsCache.at < TOTALS_TTL)
    return totalsCache.value;
  const starts = jstStarts();
  let month = 0;
  let year = 0;
  let allTime = 0;
  let seen = 0;
  let oldest = Number.POSITIVE_INFINITY;
  let complete = true;
  await s.paymentIntents
    .list({ limit: 100, expand: ["data.latest_charge"] })
    .autoPagingEach((pi) => {
      if (seen >= TOTALS_MAX) {
        complete = false;
        return false;
      }
      seen++;
      oldest = Math.min(oldest, pi.created);
      if (!isDonation(pi)) return;
      const net = pi.amount_received - refundOf(pi).refundedAmount;
      allTime += net;
      if (pi.created >= starts.year) year += net;
      if (pi.created >= starts.month) month += net;
    });
  let active = 0;
  let activeComplete = true;
  await s.subscriptions
    .list({ status: "active", limit: 100 })
    .autoPagingEach(() => {
      if (active >= TOTALS_MAX) {
        activeComplete = false;
        return false;
      }
      active++;
    });
  const value: AdminDonationTotals = {
    month: complete || oldest < starts.month ? month : null,
    year: complete || oldest < starts.year ? year : null,
    allTime: complete ? allTime : null,
    activeMonthly: activeComplete ? active : null,
  };
  totalsCache = { at: Date.now(), value };
  return value;
}
