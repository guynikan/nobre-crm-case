import type { CalendarDate } from "@nobre/contracts";
import { calendarDateIn } from "@nobre/domain";

/** Source of "now" and of the business "today"; injected so rules are testable. */
export interface Clock {
  now(): Date;
  today(): CalendarDate;
}

export function systemClock(timeZone: string): Clock {
  return {
    now: () => new Date(),
    today: () => calendarDateIn(new Date(), timeZone),
  };
}

export function fixedClock(today: CalendarDate, now = new Date(`${today}T12:00:00-03:00`)): Clock {
  return { now: () => now, today: () => today };
}
