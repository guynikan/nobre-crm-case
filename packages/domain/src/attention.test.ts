import { describe, expect, it } from "vitest";
import type { Stage } from "@nobre/contracts";
import { evaluateAttention } from "./attention.js";

const REFERENCE_DATE = "2026-10-15";

describe("evaluateAttention", () => {
  // The seven opportunities of the case, on its reference date, with the 2-day threshold.
  it.each([
    ["OPP-2001", "FIRST_CONTACT", "2026-10-14", false, 1],
    ["OPP-2002", "QUOTE_PRESENTATION", "2026-10-06", true, 9],
    ["OPP-2003", "FOLLOW_UP", "2026-10-13", true, 2],
    ["OPP-2004", "FOLLOW_UP", "2026-10-02", true, 13],
    ["OPP-2005", "FORECAST", "2026-10-15", false, 0],
  ] as const)("%s (%s, last contact %s)", (_code, stage, lastContactOn, needsAttention, days) => {
    const result = evaluateAttention({ stage, lastContactOn }, REFERENCE_DATE);
    expect(result.needsAttention).toBe(needsAttention);
    expect(result.daysSinceLastContact).toBe(days);
  });

  it.each(["CLOSING", "LOST"] as const)("never flags the final stage %s", (stage: Stage) => {
    expect(evaluateAttention({ stage, lastContactOn: "2026-01-01" }, REFERENCE_DATE)).toEqual({
      needsAttention: false,
      reason: null,
      daysSinceLastContact: null,
    });
  });

  it("flags exactly at the threshold, not one day before", () => {
    expect(
      evaluateAttention({ stage: "FOLLOW_UP", lastContactOn: "2026-10-14" }, REFERENCE_DATE, 2)
        .needsAttention,
    ).toBe(false);
    expect(
      evaluateAttention({ stage: "FOLLOW_UP", lastContactOn: "2026-10-13" }, REFERENCE_DATE, 2),
    ).toEqual({ needsAttention: true, reason: "DAYS_WITHOUT_CONTACT", daysSinceLastContact: 2 });
  });

  it("respects a custom threshold", () => {
    expect(
      evaluateAttention({ stage: "FOLLOW_UP", lastContactOn: "2026-10-13" }, REFERENCE_DATE, 5)
        .needsAttention,
    ).toBe(false);
  });

  it("flags a lead nobody has contacted yet", () => {
    expect(evaluateAttention({ stage: "FIRST_CONTACT", lastContactOn: null }, REFERENCE_DATE)).toEqual(
      { needsAttention: true, reason: "NO_CONTACT_RECORDED", daysSinceLastContact: null },
    );
  });

  it("treats a future contact date as today", () => {
    expect(
      evaluateAttention({ stage: "FOLLOW_UP", lastContactOn: "2026-10-20" }, REFERENCE_DATE)
        .daysSinceLastContact,
    ).toBe(0);
  });

  it("counts calendar days across month boundaries", () => {
    expect(
      evaluateAttention({ stage: "FOLLOW_UP", lastContactOn: "2026-09-30" }, "2026-10-01")
        .daysSinceLastContact,
    ).toBe(1);
  });
});
