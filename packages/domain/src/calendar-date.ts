import type { CalendarDate } from "@nobre/contracts";

const MS_PER_DAY = 86_400_000;

function toUtcMidnight(date: CalendarDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / MS_PER_DAY);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return new Date(toUtcMidnight(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The calendar date of `instant` in the given IANA time zone. */
export function calendarDateIn(instant: Date, timeZone: string): CalendarDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
