import { describe, expect, it } from "vitest";
import { addDays, calendarDateIn, daysBetween } from "./calendar-date.js";

describe("calendar dates", () => {
  it("counts days and adds days", () => {
    expect(daysBetween("2026-10-02", "2026-10-15")).toBe(13);
    expect(daysBetween("2026-10-15", "2026-10-02")).toBe(-13);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("uses the business time zone, not UTC, to pick today", () => {
    // 02:00 UTC on the 16th is still the 15th in São Paulo (UTC-03:00).
    expect(calendarDateIn(new Date("2026-10-16T02:00:00Z"), "America/Sao_Paulo")).toBe("2026-10-15");
  });
});
