// From the website's server actions; here plain functions the API calls.

import { revalidatePath } from "next/cache";
import { AccountState, type RsvpAnswer } from "@/server/generated/prisma/enums";
import { audit } from "@/server/lib/audit";
import { db } from "@/server/lib/db";
import { canCheckIn } from "@/server/lib/event-staff";
import { tokenFromScan, verifyTicket } from "@/server/lib/event-tickets";
import { toKatakana } from "@/server/lib/names";
import { inAudience } from "@/server/lib/news-visibility";
import { actionActive } from "@/server/lib/session";

export type CheckInResult =
  | {
      status: "ok" | "already";
      userId: string;
      name: string;
      kanji: string | null;
      /** null = no RSVP (walk-in) */
      answer: RsvpAnswer | null;
      guests: number;
      at: string;
    }
  | { status: "invalid" | "notInvited" | "forbidden" | "notFound" };

async function staffFor(eventId: string) {
  const user = await actionActive().catch(() => null);
  if (!user || typeof eventId !== "string" || eventId.length > 64) return null;
  return (await canCheckIn(user, eventId)) ? user : null;
}

async function checkIn(
  eventId: string,
  userId: string,
  staffId: string,
): Promise<CheckInResult> {
  const [event, member] = await Promise.all([
    db.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        audience: true,
        targetAudiences: true,
        targetRoles: true,
      },
    }),
    db.user.findUnique({ where: { id: userId }, include: { roles: true } }),
  ]);
  if (!event) return { status: "notFound" };
  if (!member || member.state !== AccountState.ACTIVE)
    return { status: "invalid" };
  const rsvp = await db.rsvp.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { answer: true, guests: true },
  });
  // Anyone who answered may come; otherwise they must be in the audience.
  if (!rsvp && !(await inAudience(member, event)))
    return { status: "notInvited" };

  const existing = await db.eventCheckIn.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { checkedInAt: true },
  });
  const row =
    existing ??
    (await db.eventCheckIn.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, checkedInById: staffId },
      update: {},
      select: { checkedInAt: true },
    }));
  if (!existing) {
    await audit(
      staffId,
      "event.check_in",
      { type: "Event", id: eventId },
      {
        userId,
      },
    );
    revalidatePath("/[locale]/app/events/[id]", "page");
  }
  return {
    status: existing ? "already" : "ok",
    userId,
    name: member.nameRomaji ?? member.nameKanji ?? "—",
    kanji: member.nameRomaji ? member.nameKanji : null,
    answer: rsvp?.answer ?? null,
    guests: rsvp?.guests ?? 0,
    at: row.checkedInAt.toISOString(),
  };
}

/** Check in the holder of a scanned QR ticket. */
export async function checkInTicketAction(
  eventId: string,
  scanned: string,
): Promise<CheckInResult> {
  const staff = await staffFor(eventId);
  if (!staff) return { status: "forbidden" };
  const token = tokenFromScan(String(scanned ?? ""));
  const userId = token ? verifyTicket(eventId, token) : null;
  if (!userId) return { status: "invalid" };
  return checkIn(eventId, userId, staff.id);
}

/** Check in a member picked from the list or search (no phone / no QR). */
export async function checkInMemberAction(
  eventId: string,
  userId: string,
): Promise<CheckInResult> {
  const staff = await staffFor(eventId);
  if (!staff) return { status: "forbidden" };
  if (typeof userId !== "string" || userId.length > 64)
    return { status: "invalid" };
  return checkIn(eventId, userId, staff.id);
}

/** Undo a mistaken check-in. */
export async function undoCheckInAction(
  eventId: string,
  userId: string,
): Promise<{ ok: boolean }> {
  const staff = await staffFor(eventId);
  if (!staff || typeof userId !== "string") return { ok: false };
  const { count } = await db.eventCheckIn.deleteMany({
    where: { eventId, userId },
  });
  if (count) {
    await audit(
      staff.id,
      "event.check_in_undo",
      { type: "Event", id: eventId },
      {
        userId,
      },
    );
    revalidatePath("/[locale]/app/events/[id]", "page");
  }
  return { ok: count > 0 };
}

export type CheckInCandidate = {
  id: string;
  name: string;
  kanji: string | null;
};

/** Staff search for a walk-in by name (active members in the audience). */
export async function searchCheckInAction(
  eventId: string,
  q: string,
): Promise<CheckInCandidate[]> {
  const staff = await staffFor(eventId);
  if (!staff) return [];
  const term = String(q ?? "")
    .trim()
    .slice(0, 60);
  if (!term) return [];
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { audience: true, targetAudiences: true, targetRoles: true },
  });
  if (!event) return [];
  const rows = await db.user.findMany({
    where: {
      state: AccountState.ACTIVE,
      OR: [
        { nameRomaji: { contains: term, mode: "insensitive" } },
        { nameKanji: { contains: term } },
        { nameKana: { contains: toKatakana(term) } },
      ],
    },
    orderBy: { nameRomaji: "asc" },
    take: 20,
    include: { roles: true },
  });
  const out: CheckInCandidate[] = [];
  for (const r of rows) {
    if (!(await inAudience(r, event))) continue;
    out.push({
      id: r.id,
      name: r.nameRomaji ?? r.nameKanji ?? "—",
      kanji: r.nameRomaji ? r.nameKanji : null,
    });
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Admins and the event's author assign (or remove) members who may run
 * check-in at an event.
 */
export async function setEventStaffAction(
  eventId: string,
  userId: string,
  on: boolean,
): Promise<{ ok: boolean }> {
  const admin = await actionActive().catch(() => null);
  if (!admin || typeof eventId !== "string" || typeof userId !== "string")
    return { ok: false };
  if (!admin.isAdmin) {
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { createdById: true },
    });
    if (event?.createdById !== admin.id) return { ok: false };
  }
  if (on) {
    const member = await db.user.findUnique({
      where: { id: userId },
      select: { state: true },
    });
    if (member?.state !== AccountState.ACTIVE) return { ok: false };
    await db.eventStaff.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId },
      update: {},
    });
  } else {
    await db.eventStaff.deleteMany({ where: { eventId, userId } });
  }
  await audit(
    admin.id,
    on ? "event.staff_add" : "event.staff_remove",
    { type: "Event", id: eventId },
    { userId },
  );
  revalidatePath("/[locale]/app/admin/events/[id]", "page");
  return { ok: true };
}
