import { describe, expect, it } from "vitest";
import { formatCentsForInput, maskMoneyInput, parseMoneyToCents } from "./format";

describe("BRL input formatting", () => {
  it("keeps an empty field empty", () => {
    expect(maskMoneyInput("")).toBe("");
  });

  it("treats the final two digits as cents", () => {
    expect(maskMoneyInput("4500")).toBe("45,00");
  });

  it("adds Brazilian thousands and decimal separators", () => {
    expect(maskMoneyInput("450000")).toBe("4.500,00");
  });

  it("normalizes pasted currency text and parses it back to cents", () => {
    const masked = maskMoneyInput("R$ 4.500,00");
    expect(masked).toBe("4.500,00");
    expect(parseMoneyToCents(masked)).toBe(450_000);
  });

  it("formats an existing opportunity value for editing", () => {
    expect(formatCentsForInput(450_000)).toBe("4.500,00");
    expect(formatCentsForInput(null)).toBe("");
  });
});
