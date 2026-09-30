import { recordDonationEvent, stripe } from "@/server/lib/donations";

/**
 * Stripe's webhook (Dashboard → Developers → Webhooks, endpoint
 * https://<domain>/api/stripe/webhook): checkout.session.completed,
 * checkout.session.async_payment_succeeded, invoice.paid and
 * customer.subscription.deleted. Only events signed with
 * STRIPE_WEBHOOK_SECRET are processed (src/server/lib/donations.ts).
 */
export async function POST(request: Request): Promise<Response> {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!s || !secret) return new Response("not configured", { status: 503 });
  if (!signature) return new Response("no signature", { status: 400 });
  const body = await request.text();
  let event: Awaited<ReturnType<typeof s.webhooks.constructEventAsync>>;
  try {
    event = await s.webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return new Response("bad signature", { status: 400 });
  }
  try {
    await recordDonationEvent(event);
  } catch (e) {
    console.error("[stripe] webhook failed", event.type, e);
    // Stripe retries on errors.
    return new Response("failed", { status: 500 });
  }
  return Response.json({ received: true });
}
