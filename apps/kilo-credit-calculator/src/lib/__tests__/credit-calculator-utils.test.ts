import { describe, test, expect } from "bun:test";
import {
  calculateBonusPercentage,
  PLAN_PRICES,
  calculateProjection,
  type Plan,
  type BillingCycle,
} from "../credit-calculator-utils";

describe("calculateBonusPercentage", () => {
  test("returns 50% for annual billing in any month", () => {
    expect(calculateBonusPercentage(1, "annual")).toBe(50);
    expect(calculateBonusPercentage(5, "annual")).toBe(50);
    expect(calculateBonusPercentage(12, "annual")).toBe(50);
    expect(calculateBonusPercentage(24, "annual")).toBe(50);
  });

  test("returns 50% for month 1 with monthly billing", () => {
    expect(calculateBonusPercentage(1, "monthly")).toBe(50);
  });

  test("calculates correct bonus for monthly billing months 2+", () => {
    // Month 2: min(40, 5 + 5 * (2-1)) = min(40, 10) = 10
    expect(calculateBonusPercentage(2, "monthly")).toBe(10);
    // Month 3: min(40, 5 + 5 * (3-1)) = min(40, 15) = 15
    expect(calculateBonusPercentage(3, "monthly")).toBe(15);
    // Month 4: min(40, 5 + 5 * (4-1)) = min(40, 20) = 20
    expect(calculateBonusPercentage(4, "monthly")).toBe(20);
    // Month 5: min(40, 5 + 5 * (5-1)) = min(40, 25) = 25
    expect(calculateBonusPercentage(5, "monthly")).toBe(25);
    // Month 8: min(40, 5 + 5 * (8-1)) = min(40, 40) = 40 (cap)
    expect(calculateBonusPercentage(8, "monthly")).toBe(40);
    // Month 10: should still be capped at 40
    expect(calculateBonusPercentage(10, "monthly")).toBe(40);
    // Month 24: should still be capped at 40
    expect(calculateBonusPercentage(24, "monthly")).toBe(40);
  });
});

describe("PLAN_PRICES", () => {
  test("has correct prices for all plans", () => {
    expect(PLAN_PRICES.starter).toBe(19);
    expect(PLAN_PRICES.pro).toBe(49);
    expect(PLAN_PRICES.expert).toBe(199);
  });
});

describe("calculateProjection", () => {
  test("calculates correct projection for starter plan, monthly billing, no usage", () => {
    const result = calculateProjection("starter", "monthly", 0, 3, 0);
    
    // Month 1: $19 base paid, $9.50 bonus (expires if unused)
    // Start: 0 carried over paid credits
    // Available: 0 carried over + 19 new paid + 9.50 bonus
    // Use 0 credits
    // End: 19 carried over paid credits (0 + 19), 9.50 bonus expires
    
    // Month 2: $19 base paid, $1.90 bonus (expires if unused)
    // Start: 19 carried over paid credits
    // Available: 19 carried over + 19 new paid + 1.90 bonus
    // Use 0 credits
    // End: 38 carried over paid credits (19 + 19), 1.90 bonus expires
    
    // Month 3: $19 base paid, $2.85 bonus (expires if unused)
    // Start: 38 carried over paid credits
    // Available: 38 carried over + 19 new paid + 2.85 bonus
    // Use 0 credits
    // End: 57 carried over paid credits (38 + 19), 2.85 bonus expires
    
    expect(result.totalPaid).toBeCloseTo(57); // 19 * 3
    expect(result.totalBonus).toBeCloseTo(14.25); // 9.50 + 1.90 + 2.85
    expect(result.totalValue).toBeCloseTo(71.25); // 57 + 14.25
    
    // Check month-by-month details
    expect(result.months[0].month).toBe(1);
    expect(result.months[0].bonusPercent).toBe(50);
    expect(result.months[0].bonusAmount).toBeCloseTo(9.50);
    expect(result.months[0].monthlyTotal).toBeCloseTo(28.50);
    expect(result.months[0].paidCreditsBefore).toBe(0);
    expect(result.months[0].bonusCreditsBefore).toBe(0);
    expect(result.months[0].paidCreditsAfterUsage).toBeCloseTo(19);
    expect(result.months[0].bonusCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[0].creditsAtEnd).toBeCloseTo(19); // Only paid credits carry over
    
    expect(result.months[1].month).toBe(2);
    expect(result.months[1].bonusPercent).toBe(10);
    expect(result.months[1].bonusAmount).toBeCloseTo(1.90);
    expect(result.months[1].monthlyTotal).toBeCloseTo(20.90);
    expect(result.months[1].paidCreditsBefore).toBeCloseTo(19);
    expect(result.months[1].bonusCreditsBefore).toBe(0);
    expect(result.months[1].paidCreditsAfterUsage).toBeCloseTo(38);
    expect(result.months[1].bonusCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[1].creditsAtEnd).toBeCloseTo(38); // 19 + 19
    
    expect(result.months[2].month).toBe(3);
    expect(result.months[2].bonusPercent).toBe(15);
    expect(result.months[2].bonusAmount).toBeCloseTo(2.85);
    expect(result.months[2].monthlyTotal).toBeCloseTo(21.85);
    expect(result.months[2].paidCreditsBefore).toBeCloseTo(38);
    expect(result.months[2].bonusCreditsBefore).toBe(0);
    expect(result.months[2].paidCreditsAfterUsage).toBeCloseTo(57);
    expect(result.months[2].bonusCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[2].creditsAtEnd).toBeCloseTo(57); // 38 + 19
  });

  test("calculates correct projection with starting credits and monthly usage", () => {
    const result = calculateProjection("pro", "monthly", 100, 2, 10);
    
    // Month 1: $49 base paid, $24.50 bonus (expires if unused)
    // Start: 100 carried over paid credits
    // Available: 100 carried over + 49 new paid + 24.50 bonus = 173.50 total
    // Use 10 credits (all from paid credits first)
    // End: 139 carried over paid credits (100 + 49 - 10), 24.50 bonus expires
    
    // Month 2: $49 base paid, $4.90 bonus (expires if unused)
    // Start: 139 carried over paid credits
    // Available: 139 carried over + 49 new paid + 4.90 bonus = 192.90 total
    // Use 10 credits (all from paid credits first)
    // End: 178 carried over paid credits (139 + 49 - 10), 4.90 bonus expires
    
    expect(result.totalPaid).toBeCloseTo(98); // 49 * 2
    expect(result.totalBonus).toBeCloseTo(29.40); // 24.50 + 4.90
    expect(result.totalValue).toBeCloseTo(127.40); // 98 + 29.40
    
    expect(result.months[0].paidCreditsBefore).toBeCloseTo(100);
    expect(result.months[0].bonusCreditsBefore).toBeCloseTo(0);
    expect(result.months[0].paidCreditsAfterUsage).toBeCloseTo(139); // 100 + 49 - 10
    expect(result.months[0].bonusCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[0].creditsAtEnd).toBeCloseTo(139);
    
    expect(result.months[1].paidCreditsBefore).toBeCloseTo(139);
    expect(result.months[1].bonusCreditsBefore).toBeCloseTo(0);
    expect(result.months[1].paidCreditsAfterUsage).toBeCloseTo(178); // 139 + 49 - 10
    expect(result.months[1].bonusCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[1].creditsAtEnd).toBeCloseTo(178);
  });

  test("handles annual billing correctly", () => {
    const result = calculateProjection("starter", "annual", 0, 2, 0);
    
    // Both months should have 50% bonus
    // Month 1: $19 base paid, $9.50 bonus (expires if unused)
    // Start: 0 carried over paid credits
    // Available: 0 carried over + 19 new paid + 9.50 bonus
    // Use 0 credits
    // End: 19 carried over paid credits, 9.50 bonus expires
    
    // Month 2: $19 base paid, $9.50 bonus (expires if unused)
    // Start: 19 carried over paid credits
    // Available: 19 carried over + 19 new paid + 9.50 bonus
    // Use 0 credits
    // End: 38 carried over paid credits (19 + 19), 9.50 bonus expires
    
    expect(result.totalPaid).toBeCloseTo(38); // 19 * 2
    expect(result.totalBonus).toBeCloseTo(19); // 9.50 * 2
    expect(result.totalValue).toBeCloseTo(57); // 38 + 19
    
    expect(result.months[0].bonusPercent).toBe(50);
    expect(result.months[1].bonusPercent).toBe(50);
    
    // Month 1 details
    expect(result.months[0].paidCreditsBefore).toBe(0);
    expect(result.months[0].bonusCreditsBefore).toBe(0);
    expect(result.months[0].paidCreditsAfterUsage).toBeCloseTo(19);
    expect(result.months[0].bonusCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[0].creditsAtEnd).toBeCloseTo(19);
    
    // Month 2 details
    expect(result.months[1].paidCreditsBefore).toBeCloseTo(19);
    expect(result.months[1].bonusCreditsBefore).toBe(0);
    expect(result.months[1].paidCreditsAfterUsage).toBeCloseTo(38);
    expect(result.months[1].bonusCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[1].creditsAtEnd).toBeCloseTo(38);
  });

  test("does not let credits go negative with high usage", () => {
    const result = calculateProjection("starter", "monthly", 10, 2, 50);
    
    // Month 1: $19 base paid, $9.50 bonus (expires if unused)
    // Start: 10 carried over paid credits
    // Available: 10 carried over + 19 new paid + 9.50 bonus = 38.50 total
    // Use 50 credits:
    //   - First use all 10 carried over paid credits
    //   - Then use all 19 new paid credits
    //   - Then use 21 of the 28.50 bonus credits
    //   - Remaining: 7.50 bonus credits (these expire)
    // End: 0 carried over paid credits
    
    // Month 2: $19 base paid, $9.50 bonus (expires if unused)
    // Start: 0 carried over paid credits
    // Available: 0 carried over + 19 new paid + 9.50 bonus = 28.50 total
    // Use 50 credits:
    //   - First use all 0 carried over paid credits (none)
    //   - Then use all 19 new paid credits
    //   - Then use 31 of the 28.50 bonus credits (but only 28.50 available)
    //   - Remaining: 0 paid credits, 0 bonus credits (all expire)
    // End: 0 carried over paid credits
    
    expect(result.months[0].paidCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[0].bonusCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[0].creditsAtEnd).toBeCloseTo(0);
    
    expect(result.months[1].paidCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[1].bonusCreditsAfterUsage).toBeCloseTo(0);
    expect(result.months[1].creditsAtEnd).toBeCloseTo(0);
  });
});