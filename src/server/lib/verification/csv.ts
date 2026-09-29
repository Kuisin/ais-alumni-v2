import { RoleKey } from "@/server/generated/prisma/enums";

/**
 * Roster CSV import (§6.4.1). Columns:
 *   nameRomaji,nameKanji,dateOfBirth,yearsFrom,yearsTo,kind
 * A header row is optional (detected by a first cell of "nameRomaji").
 * dateOfBirth is YYYY-MM-DD (or YYYY/MM/DD); kind is a RoleKey (case-insensitive,
 * defaults to FORMER_STUDENT when blank — assumption).
 */

export type RosterRowInput = {
  nameRomaji: string;
  nameKanji: string | null;
  dateOfBirth: Date | null;
  yearsFrom: number | null;
  yearsTo: number | null;
  kind: RoleKey;
};

export type RosterParseError = { line: number; error: RosterRowError };
export type RosterRowError =
  | "missingName"
  | "badDate"
  | "badYear"
  | "yearsOrder"
  | "badKind"
  | "tooManyColumns";

export const ROSTER_MAX_ROWS = 20000;

/** Minimal RFC 4180 parser: quoted fields, "" escapes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function parseDate(s: string): Date | null | "bad" {
  const v = s.trim();
  if (!v) return null;
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(v);
  if (!m) return "bad";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  )
    return "bad";
  return date;
}

function parseYear(s: string): number | null | "bad" {
  const v = s.trim();
  if (!v) return null;
  if (!/^\d{4}$/.test(v)) return "bad";
  const n = Number(v);
  return n >= 1900 && n <= 2200 ? n : "bad";
}

const KINDS = new Set<string>(Object.values(RoleKey));

export function parseRosterCsv(text: string): {
  rows: RosterRowInput[];
  errors: RosterParseError[];
} {
  const table = parseCsv(text);
  const rows: RosterRowInput[] = [];
  const errors: RosterParseError[] = [];
  for (const [index, cells] of table.entries()) {
    const line = index + 1;
    if (index === 0 && cells[0]?.trim().toLowerCase() === "nameromaji")
      continue;
    if (cells.length > 6) {
      errors.push({ line, error: "tooManyColumns" });
      continue;
    }
    const [name = "", kanji = "", dob = "", from = "", to = "", kindRaw = ""] =
      cells;
    const nameRomaji = name.trim();
    if (!nameRomaji) {
      errors.push({ line, error: "missingName" });
      continue;
    }
    const dateOfBirth = parseDate(dob);
    if (dateOfBirth === "bad") {
      errors.push({ line, error: "badDate" });
      continue;
    }
    const yearsFrom = parseYear(from);
    const yearsTo = parseYear(to);
    if (yearsFrom === "bad" || yearsTo === "bad") {
      errors.push({ line, error: "badYear" });
      continue;
    }
    if (yearsFrom !== null && yearsTo !== null && yearsTo < yearsFrom) {
      errors.push({ line, error: "yearsOrder" });
      continue;
    }
    const kindUpper = kindRaw.trim().toUpperCase() || RoleKey.FORMER_STUDENT;
    if (!KINDS.has(kindUpper)) {
      errors.push({ line, error: "badKind" });
      continue;
    }
    rows.push({
      nameRomaji: nameRomaji.slice(0, 200),
      nameKanji: kanji.trim().slice(0, 200) || null,
      dateOfBirth,
      yearsFrom,
      yearsTo,
      kind: kindUpper as RoleKey,
    });
  }
  return { rows, errors };
}
