import { describe, expect, it } from "vitest";
import { STAGES, type Stage } from "@nobre/contracts";
import { evaluateQuoteInvariant, evaluateTransition, reachableStages } from "./pipeline.js";

const quoted: { estimatedValueCents: number | null; itemCount: number } = {
  estimatedValueCents: 450_000,
  itemCount: 1,
};

function at(stage: Stage, overrides: Partial<typeof quoted> = {}) {
  return { stage, ...quoted, ...overrides };
}

describe("evaluateTransition", () => {
  it.each([
    ["FIRST_CONTACT", "QUOTE_PRESENTATION"],
    ["QUOTE_PRESENTATION", "FOLLOW_UP"],
    ["FOLLOW_UP", "FORECAST"],
    ["FORECAST", "CLOSING"],
  ] as const)("allows the forward step %s -> %s", (from, to) => {
    expect(evaluateTransition(at(from), { toStage: to })).toEqual({ allowed: true });
  });

  it.each([
    ["FOLLOW_UP", "QUOTE_PRESENTATION"],
    ["FORECAST", "FOLLOW_UP"],
  ] as const)("allows the backward step %s -> %s", (from, to) => {
    expect(evaluateTransition(at(from), { toStage: to })).toEqual({ allowed: true });
  });

  it.each([
    ["FIRST_CONTACT", "FOLLOW_UP"],
    ["FIRST_CONTACT", "CLOSING"],
    ["QUOTE_PRESENTATION", "FORECAST"],
    ["QUOTE_PRESENTATION", "CLOSING"],
    ["FOLLOW_UP", "CLOSING"],
    ["QUOTE_PRESENTATION", "FIRST_CONTACT"],
    ["FOLLOW_UP", "FIRST_CONTACT"],
    ["FORECAST", "QUOTE_PRESENTATION"],
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(evaluateTransition(at(from), { toStage: to })).toEqual({
      allowed: false,
      code: "TRANSITION_NOT_ALLOWED",
    });
  });

  it("only reaches CLOSING from FORECAST", () => {
    const sources = STAGES.filter(
      (from) => evaluateTransition(at(from), { toStage: "CLOSING" }).allowed,
    );
    expect(sources).toEqual(["FORECAST"]);
  });

  it("requires an estimated value to enter QUOTE_PRESENTATION", () => {
    expect(
      evaluateTransition(at("FIRST_CONTACT", { estimatedValueCents: null }), {
        toStage: "QUOTE_PRESENTATION",
      }),
    ).toEqual({ allowed: false, code: "MISSING_ESTIMATED_VALUE" });
    expect(
      evaluateTransition(at("FIRST_CONTACT", { estimatedValueCents: 0 }), {
        toStage: "QUOTE_PRESENTATION",
      }),
    ).toEqual({ allowed: false, code: "MISSING_ESTIMATED_VALUE" });
  });

  it("requires at least one gift item to enter QUOTE_PRESENTATION", () => {
    expect(
      evaluateTransition(at("FIRST_CONTACT", { itemCount: 0 }), { toStage: "QUOTE_PRESENTATION" }),
    ).toEqual({ allowed: false, code: "MISSING_GIFT_ITEMS" });
  });

  it.each(["FIRST_CONTACT", "QUOTE_PRESENTATION", "FOLLOW_UP", "FORECAST"] as const)(
    "allows LOST from %s with a reason",
    (from) => {
      expect(evaluateTransition(at(from), { toStage: "LOST", lostReason: "Sem orçamento" })).toEqual(
        { allowed: true },
      );
    },
  );

  it("allows LOST even without a quote", () => {
    expect(
      evaluateTransition(at("FIRST_CONTACT", { estimatedValueCents: null, itemCount: 0 }), {
        toStage: "LOST",
        lostReason: "Lead sem perfil",
      }),
    ).toEqual({ allowed: true });
  });

  it.each([undefined, "", "   "])("requires a lost reason (%j)", (lostReason) => {
    expect(evaluateTransition(at("FOLLOW_UP"), { toStage: "LOST", lostReason })).toEqual({
      allowed: false,
      code: "LOST_REASON_REQUIRED",
    });
  });

  it("rejects a lost reason on a non-LOST move", () => {
    expect(
      evaluateTransition(at("FOLLOW_UP"), { toStage: "FORECAST", lostReason: "x" }),
    ).toEqual({ allowed: false, code: "LOST_REASON_NOT_ALLOWED" });
  });

  it.each(["CLOSING", "LOST"] as const)("never moves out of the final stage %s", (from) => {
    for (const to of STAGES) {
      expect(evaluateTransition(at(from), { toStage: to, lostReason: "x" })).toEqual({
        allowed: false,
        code: "STAGE_IS_FINAL",
      });
    }
  });

  it("rejects moving to the current stage", () => {
    expect(evaluateTransition(at("FOLLOW_UP"), { toStage: "FOLLOW_UP" })).toEqual({
      allowed: false,
      code: "SAME_STAGE",
    });
  });
});

describe("reachableStages", () => {
  it("lists the allowed targets including LOST", () => {
    expect(reachableStages("FOLLOW_UP")).toEqual(["FORECAST", "QUOTE_PRESENTATION", "LOST"]);
  });

  it("is empty for final stages", () => {
    expect(reachableStages("CLOSING")).toEqual([]);
    expect(reachableStages("LOST")).toEqual([]);
  });
});

describe("evaluateQuoteInvariant", () => {
  it("lets FIRST_CONTACT have no quote", () => {
    expect(
      evaluateQuoteInvariant({ stage: "FIRST_CONTACT", estimatedValueCents: null, itemCount: 0 }),
    ).toEqual({ allowed: true });
  });

  it("blocks removing the value or every item after the quote stage", () => {
    expect(evaluateQuoteInvariant(at("FOLLOW_UP", { estimatedValueCents: null }))).toEqual({
      allowed: false,
      code: "ESTIMATED_VALUE_REQUIRED_FOR_STAGE",
    });
    expect(evaluateQuoteInvariant(at("FORECAST", { itemCount: 0 }))).toEqual({
      allowed: false,
      code: "ITEMS_REQUIRED_FOR_STAGE",
    });
  });
});
