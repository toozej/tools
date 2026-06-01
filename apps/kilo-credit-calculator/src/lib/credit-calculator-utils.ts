export type Plan = "starter" | "pro" | "expert";
export type BillingCycle = "monthly" | "annual";

export const PLAN_PRICES: Record<Plan, number> = {
  starter: 19,
  pro: 49,
  expert: 199,
};

export function calculateBonusPercentage(monthNumber: number, billingCycle: BillingCycle): number {
  if (billingCycle === "annual") {
    return 50;
  }
  if (monthNumber === 1) {
    return 50;
  }
  const base = 5;
  const step = 5;
  const cap = 40;
  const streakMonths = monthNumber - 1;
  return Math.min(cap, base + step * streakMonths);
}

export interface MonthProjection {
  month: number;
  bonusPercent: number;
  bonusAmount: number;
  monthlyTotal: number;
  paidCreditsBefore: number;
  bonusCreditsBefore: number;
  paidCreditsAfterUsage: number;
  bonusCreditsAfterUsage: number;
  creditsAtEnd: number;
}

export interface ProjectionResult {
  months: MonthProjection[];
  totalPaid: number;
  totalBonus: number;
  totalValue: number;
}

export function calculateProjection(
  plan: Plan,
  billingCycle: BillingCycle,
  startingCredits: number,
  months: number,
  monthlyUsage: number
): ProjectionResult {
  const monthsArray: MonthProjection[] = [];
  let carriedOverPaidCredits = startingCredits; // Starting credits are considered carried-over paid credits
  let totalPaid = 0;
  let totalBonus = 0;

  for (let i = 1; i <= months; i++) {
    const bonusPercent = calculateBonusPercentage(i, billingCycle);
    const basePrice = PLAN_PRICES[plan];
    const bonusAmount = basePrice * (bonusPercent / 100);
    const monthlyTotal = basePrice + bonusAmount;

    totalPaid += basePrice;
    totalBonus += bonusAmount;

    // Credits available this month:
    // - carriedOverPaidCredits: paid credits from previous months
    // - basePrice: newly earned paid credits this month
    // - bonusAmount: newly earned bonus credits this month (expires if unused)
    const paidCreditsBefore = carriedOverPaidCredits;
    const bonusCreditsBefore = 0; // Bonus credits don't carry over, so always 0 at start of month

    // Total paid credits available this month (carried over + newly earned)
    const totalPaidAvailable = carriedOverPaidCredits + basePrice;
    
    // Apply monthly usage: use paid credits first (carried over, then newly earned), then bonus credits
    let paidCreditsAfterUsage = Math.max(0, totalPaidAvailable - monthlyUsage);
    let bonusCreditsAfterUsage = 0;
    let remainingUsage = monthlyUsage;

    if (totalPaidAvailable < monthlyUsage) {
      // Used all paid credits, now use bonus credits
      remainingUsage = monthlyUsage - totalPaidAvailable;
      paidCreditsAfterUsage = 0;
      bonusCreditsAfterUsage = Math.max(0, bonusAmount - remainingUsage);
    }

    // Calculate what carries over to next month:
    // - Paid credits: whatever is left after usage (both carried over and newly earned)
    // - Bonus credits: 0 (all unused bonus credits expire)
    const creditsAtEnd = paidCreditsAfterUsage; // Only paid credits carry over
    carriedOverPaidCredits = paidCreditsAfterUsage;

    monthsArray.push({
      month: i,
      bonusPercent,
      bonusAmount,
      monthlyTotal,
      paidCreditsBefore,
      bonusCreditsBefore,
      paidCreditsAfterUsage,
      bonusCreditsAfterUsage,
      creditsAtEnd,
    });
  }

  return {
    months: monthsArray,
    totalPaid,
    totalBonus,
    totalValue: totalPaid + totalBonus,
  };
}