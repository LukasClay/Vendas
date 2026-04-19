import { describe, expect, it } from "vitest";
import { getSaleUrgency, hasAutomaticDeadline } from "./businessDays";

describe("hasAutomaticDeadline", () => {
  it("returns false for coletivo", () => {
    expect(hasAutomaticDeadline("coletivo")).toBe(false);
  });

  it("returns true for individual and promocao", () => {
    expect(hasAutomaticDeadline("individual")).toBe(true);
    expect(hasAutomaticDeadline("promocao")).toBe(true);
  });

  it("defaults to true when category is null/undefined", () => {
    expect(hasAutomaticDeadline(null)).toBe(true);
    expect(hasAutomaticDeadline(undefined)).toBe(true);
  });
});

describe("getSaleUrgency", () => {
  // Data antiga o suficiente para estar muito atrasada em qualquer ambiente
  const oldSale = "2020-01-01";

  it("returns hasDeadline=false for coletivo regardless of sale age", () => {
    const urgency = getSaleUrgency(oldSale, "coletivo");
    expect(urgency.hasDeadline).toBe(false);
    expect(urgency.urgencyScore).toBe(Number.NEGATIVE_INFINITY);
    // TypeScript garante: campos de prazo não existem no arm false
    expect("daysRemaining" in urgency).toBe(false);
    expect("isOverdue" in urgency).toBe(false);
  });

  it("returns hasDeadline=true with prazo fields for individual", () => {
    const urgency = getSaleUrgency(oldSale, "individual");
    expect(urgency.hasDeadline).toBe(true);
    if (urgency.hasDeadline) {
      expect(urgency.isOverdue).toBe(true);
      expect(urgency.daysRemaining).toBeLessThan(0);
      expect(urgency.deadline).toBeInstanceOf(Date);
    }
  });

  it("treats null/undefined category as having deadline (backward compat)", () => {
    const urgency = getSaleUrgency(oldSale, null);
    expect(urgency.hasDeadline).toBe(true);
  });

  it("accepts saleDate as Date without caller normalization", () => {
    const urgencyFromDate = getSaleUrgency(
      new Date("2020-01-01"),
      "individual"
    );
    const urgencyFromStr = getSaleUrgency("2020-01-01", "individual");
    expect(urgencyFromDate.hasDeadline).toBe(urgencyFromStr.hasDeadline);
    if (urgencyFromDate.hasDeadline && urgencyFromStr.hasDeadline) {
      expect(urgencyFromDate.daysRemaining).toBe(urgencyFromStr.daysRemaining);
    }
  });
});
