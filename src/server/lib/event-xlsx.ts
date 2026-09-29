import ExcelJS from "exceljs";
import { RoleKey, RsvpAnswer } from "@/server/generated/prisma/enums";
import type { AppLocale } from "@/server/i18n/routing";
import { getTranslatorFor } from "@/server/i18n/translator";
import { roleLabelKey } from "@/server/lib/audience";
import { cohortShort } from "@/server/lib/cohorts";
import { db } from "@/server/lib/db";
import { isRsvpOpen, rsvpClosesAt } from "@/server/lib/events";
import { isEveryone, specFromPost } from "@/server/lib/news-audience";

/**
 * Event detail as an Excel workbook (admins): 概要 (details, RSVP status and
 * counts) and 出欠 (one row per member who answered or checked in). Times
 * are Japan time; headers follow the admin's language.
 */

/** Excel has no time zones: store JST wall-clock time. */
const jst = (d: Date | null | undefined) =>
  d ? new Date(d.getTime() + 9 * 3600_000) : null;

const ANSWER_ORDER: Record<string, number> = {
  GOING: 0,
  MAYBE: 1,
  NOT_GOING: 2,
  NONE: 3,
};

export async function eventWorkbook(
  eventId: string,
  locale: AppLocale,
): Promise<{ buffer: Buffer; startsAt: Date; rows: number } | null> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      rsvps: {
        include: {
          user: {
            select: {
              id: true,
              nameRomaji: true,
              nameKanji: true,
              nameKana: true,
              primaryEmail: true,
              phone: true,
              roles: {
                select: {
                  role: true,
                  didGraduate: true,
                  cohort: { select: { number: true } },
                },
              },
            },
          },
        },
      },
      checkIns: {
        include: {
          user: {
            select: {
              id: true,
              nameRomaji: true,
              nameKanji: true,
              nameKana: true,
              primaryEmail: true,
              phone: true,
              roles: {
                select: {
                  role: true,
                  didGraduate: true,
                  cohort: { select: { number: true } },
                },
              },
            },
          },
          checkedInBy: { select: { nameRomaji: true, nameKanji: true } },
        },
      },
    },
  });
  if (!event) return null;

  const t = await getTranslatorFor(locale, "adminContent");
  const te = await getTranslatorFor(locale, "events");
  const tr = await getTranslatorFor(locale, "roles");

  type Person = (typeof event.rsvps)[number]["user"];
  const typeOf = (u: Person) =>
    u.roles
      .map((r) => {
        const label = tr(roleLabelKey(r));
        const cls =
          r.cohort &&
          (r.role === RoleKey.CURRENT_STUDENT ||
            r.role === RoleKey.FORMER_STUDENT)
            ? ` ${cohortShort(r.cohort, locale)}`
            : "";
        return `${label}${cls}`;
      })
      .join(" / ");

  // One row per member: their RSVP and/or check-in.
  const byUser = new Map<
    string,
    {
      user: Person;
      answer: RsvpAnswer | null;
      guests: number;
      updatedAt: Date | null;
      checkedInAt: Date | null;
      checkedInBy: string | null;
    }
  >();
  for (const r of event.rsvps)
    byUser.set(r.userId, {
      user: r.user,
      answer: r.answer,
      guests: r.guests,
      updatedAt: r.updatedAt,
      checkedInAt: null,
      checkedInBy: null,
    });
  for (const c of event.checkIns) {
    const row = byUser.get(c.userId) ?? {
      user: c.user,
      answer: null,
      guests: 0,
      updatedAt: null,
      checkedInAt: null,
      checkedInBy: null,
    };
    row.checkedInAt = c.checkedInAt;
    row.checkedInBy = c.checkedInBy
      ? (c.checkedInBy.nameRomaji ?? c.checkedInBy.nameKanji)
      : null;
    byUser.set(c.userId, row);
  }
  const rows = [...byUser.values()].sort(
    (a, b) =>
      ANSWER_ORDER[a.answer ?? "NONE"] - ANSWER_ORDER[b.answer ?? "NONE"] ||
      (a.user.nameRomaji ?? "").localeCompare(b.user.nameRomaji ?? ""),
  );

  const count = (a: RsvpAnswer) => rows.filter((r) => r.answer === a);
  const guests = (a: RsvpAnswer) => count(a).reduce((n, r) => n + r.guests, 0);
  const going = count(RsvpAnswer.GOING);
  const spec = specFromPost(event);
  const audience = isEveryone(spec)
    ? t("audience.everyone")
    : [
        ...spec.groups.map((g) => t(`audience.groups.${g}`)),
        spec.cohortIds.length
          ? t("audience.summaryCohorts", { count: spec.cohortIds.length }) +
            (spec.includeParents ? ` · ${t("audience.summaryParents")}` : "")
          : null,
        spec.userIds.length
          ? t("audience.summaryUsers", { count: spec.userIds.length })
          : null,
      ]
        .filter(Boolean)
        .join("、");
  const open = isRsvpOpen(event);

  const wb = new ExcelJS.Workbook();
  wb.creator = "AIS Alumni";
  wb.created = new Date();
  const DATE_FMT = "yyyy/mm/dd hh:mm";

  // ── 概要 ────────────────────────────────────────────────────────────
  const summary = wb.addWorksheet(t("xlsx.summarySheet"));
  summary.columns = [
    { key: "k", width: 22 },
    { key: "v", width: 70 },
  ];
  const info: [string, string | number | Date | null][] = [
    [t("fields.titleJa"), event.titleJa],
    [t("fields.titleEn"), event.titleEn],
    [t("fields.startsAt"), jst(event.startsAt)],
    [t("fields.endsAt"), jst(event.endsAt)],
    [t("fields.location"), event.location],
    [t("fields.mapUrl"), event.mapUrl],
    [t("fields.capacity"), event.capacity ?? t("xlsx.noLimit")],
    [t("fields.rsvpDeadline"), jst(rsvpClosesAt(event))],
    [
      t("xlsx.rsvpStatus"),
      open
        ? t("xlsx.rsvpOpen")
        : event.rsvpClosedAt
          ? t("xlsx.rsvpClosedManual")
          : t("xlsx.rsvpClosed"),
    ],
    [t("events.audience"), audience],
    [te("answer.GOING"), going.length],
    [t("xlsx.goingGuests"), guests(RsvpAnswer.GOING)],
    [t("attendees.headcount"), going.length + guests(RsvpAnswer.GOING)],
    [te("answer.MAYBE"), count(RsvpAnswer.MAYBE).length],
    [te("answer.NOT_GOING"), count(RsvpAnswer.NOT_GOING).length],
    [t("attendees.checkedIn"), event.checkIns.length],
    [t("fields.bodyJa"), event.bodyJa],
    [t("fields.bodyEn"), event.bodyEn],
    [t("xlsx.exportedAt"), jst(new Date())],
  ];
  for (const [k, v] of info) {
    const row = summary.addRow({ k, v: v ?? "" });
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    if (v instanceof Date) row.getCell(2).numFmt = DATE_FMT;
  }

  // ── 出欠 ────────────────────────────────────────────────────────────
  const sheet = wb.addWorksheet(t("xlsx.attendeesSheet"), {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: t("xlsx.col.nameRomaji"), key: "romaji", width: 24 },
    { header: t("xlsx.col.nameKanji"), key: "kanji", width: 16 },
    { header: t("xlsx.col.nameKana"), key: "kana", width: 18 },
    { header: t("xlsx.col.type"), key: "type", width: 26 },
    { header: t("xlsx.col.answer"), key: "answer", width: 12 },
    { header: t("xlsx.col.guests"), key: "guests", width: 8 },
    { header: t("xlsx.col.answeredAt"), key: "answeredAt", width: 18 },
    { header: t("xlsx.col.checkedInAt"), key: "checkedInAt", width: 18 },
    { header: t("xlsx.col.checkedInBy"), key: "checkedInBy", width: 20 },
    { header: t("xlsx.col.email"), key: "email", width: 30 },
    { header: t("xlsx.col.phone"), key: "phone", width: 16 },
  ];
  for (const r of rows) {
    sheet.addRow({
      romaji: r.user.nameRomaji ?? "",
      kanji: r.user.nameKanji ?? "",
      kana: r.user.nameKana ?? "",
      type: typeOf(r.user),
      answer: r.answer ? te(`answer.${r.answer}`) : t("xlsx.walkIn"),
      guests: r.guests,
      answeredAt: jst(r.updatedAt),
      checkedInAt: jst(r.checkedInAt),
      checkedInBy: r.checkedInBy ?? "",
      email: r.user.primaryEmail ?? "",
      phone: r.user.phone ?? "",
    });
  }
  for (const key of ["answeredAt", "checkedInAt"])
    sheet.getColumn(key).numFmt = DATE_FMT;
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, startsAt: event.startsAt, rows: rows.length };
}
