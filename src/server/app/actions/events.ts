// From the website's server actions; here plain functions the API calls.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RsvpAnswer } from "@/server/generated/prisma/enums";
import { awaitingApproval } from "@/server/lib/approval";
import { toViewer } from "@/server/lib/authz";
import { db } from "@/server/lib/db";
import { checkRsvp, MAX_GUESTS, type RsvpDenial } from "@/server/lib/events";
import { inAudience } from "@/server/lib/news-visibility";
import { actionActive } from "@/server/lib/session";

export type RsvpState = {
  ok?: boolean;
  error?: RsvpDenial | "notFound" | "validation" | "forbidden" | "generic";
};

const RsvpSchema = z.object({
  eventId: z.string().min(1).max(64),
  answer: z.enum(RsvpAnswer),
  guests: z.coerce.number().int().min(0).max(MAX_GUESTS),
});

/** Create or update the viewer's RSVP (§10.3). */
export async function rsvpAction(
  _prev: RsvpState,
  formData: FormData,
): Promise<RsvpState> {
  let user: Awaited<ReturnType<typeof actionActive>>;
  try {
    user = await actionActive();
  } catch {
    return { error: "forbidden" };
  }

  const parsed = RsvpSchema.safeParse({
    eventId: formData.get("eventId"),
    answer: formData.get("answer"),
    guests: formData.get("guests") || 0,
  });
  if (!parsed.success) return { error: "validation" };
  const { eventId, answer } = parsed.data;
  // Guests only make sense when attending (or maybe attending).
  const guests = answer === RsvpAnswer.NOT_GOING ? 0 : parsed.data.guests;
  const _viewer = toViewer(user);

  try {
    const outcome = await db.$transaction(async (tx) => {
      // Serialise RSVPs per event so two last-seat requests can't both pass
      // the capacity check.
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          startsAt: true,
          rsvpDeadline: true,
          rsvpClosedAt: true,
          capacity: true,
          targetRoles: true,
          targetAudiences: true,
          audience: true,
          approvalRequired: true,
          approvedAt: true,
        },
      });
      if (!event || awaitingApproval(event) || !(await inAudience(user, event)))
        return "notFound" as const;

      const others = await tx.rsvp.aggregate({
        where: { eventId, answer: RsvpAnswer.GOING, userId: { not: user.id } },
        _count: { _all: true },
        _sum: { guests: true },
      });
      const othersGoing = others._count._all + (others._sum.guests ?? 0);
      const check = checkRsvp({ event, answer, guests, othersGoing });
      if (!check.ok) return check.reason;

      await tx.rsvp.upsert({
        where: { eventId_userId: { eventId, userId: user.id } },
        create: { eventId, userId: user.id, answer, guests },
        update: { answer, guests },
      });
      return null;
    });
    if (outcome) return { error: outcome };
  } catch (e) {
    console.error("[rsvp] failed", e);
    return { error: "generic" };
  }

  revalidatePath("/[locale]/app/events/[id]", "page");
  revalidatePath("/[locale]/app/events", "page");
  revalidatePath("/[locale]/app/dashboard", "page");
  return { ok: true };
}
