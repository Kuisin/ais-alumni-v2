import type { CheckInAttendee, CheckInBoard } from "@contract/events";
import { RsvpAnswer } from "@/server/generated/prisma/enums";
import { db } from "@/server/lib/db";
import { canCheckIn } from "@/server/lib/event-staff";
import { localized } from "@/server/lib/format";
import { forbidden, notFound } from "@/server/lib/mobile/http";
import type { CurrentUser } from "@/server/lib/session";

/**
 * The staff check-in screen (the website's /app/events/[id]/check-in):
 * who answered 参加 / 未定 and who has been checked in. Staff only (admins,
 * the event's author, assigned staff — canCheckIn).
 */
export async function checkInBoard(
  user: CurrentUser,
  id: string,
  locale: "ja" | "en",
): Promise<CheckInBoard> {
  if (!(await canCheckIn(user, id))) throw forbidden();
  const event = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      titleJa: true,
      titleEn: true,
      startsAt: true,
      rsvps: {
        where: { answer: { in: [RsvpAnswer.GOING, RsvpAnswer.MAYBE] } },
        select: {
          answer: true,
          guests: true,
          user: { select: { id: true, nameRomaji: true, nameKanji: true } },
        },
      },
      checkIns: {
        select: {
          checkedInAt: true,
          user: { select: { id: true, nameRomaji: true, nameKanji: true } },
        },
      },
    },
  });
  if (!event) throw notFound();

  const byId = new Map<string, CheckInAttendee>();
  const person = (u: {
    id: string;
    nameRomaji: string | null;
    nameKanji: string | null;
  }) => ({
    id: u.id,
    name: u.nameRomaji ?? u.nameKanji ?? "—",
    kanji: u.nameRomaji ? u.nameKanji : null,
  });
  for (const r of event.rsvps)
    byId.set(r.user.id, {
      ...person(r.user),
      answer: r.answer,
      guests: r.guests,
      checkedInAt: null,
    });
  for (const c of event.checkIns) {
    const a = byId.get(c.user.id) ?? {
      ...person(c.user),
      answer: null,
      guests: 0,
      checkedInAt: null,
    };
    byId.set(c.user.id, { ...a, checkedInAt: c.checkedInAt.toISOString() });
  }
  return {
    id: event.id,
    title: localized(event.titleJa, event.titleEn, locale),
    startsAt: event.startsAt.toISOString(),
    attendees: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
