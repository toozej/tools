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
  creditsBefore: number;
  creditsAfterUsage: number;
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
  let currentCredits = startingCredits;
  let totalPaid = 0;
  let totalBonus = 0;

  for (let i = 1; i <= months; i++) {
    const bonusPercent = calculateBonusPercentage(i, billingCycle);
    const basePrice = PLAN_PRICES[plan];
    const bonusAmount = basePrice * (bonusPercent / 100);
    const monthlyTotal = basePrice + bonusAmount;

    totalPaid += basePrice;
    totalBonus += bonusAmount;

    const creditsAfterUsage = currentCredits - monthlyUsage;
    const creditsAtEnd = Math.max(0, creditsAfterUsage + monthlyTotal);

    monthsArray.push({
      month: i,
      bonusPercent,
      bonusAmount,
      monthlyTotal,
      creditsBefore: currentCredits,
      creditsAfterUsage: creditsAfterUsage < 0 ? 0 : creditsAfterUsage,
      creditsAtEnd,
    });

    currentCredits = creditsAtEnd;
  }

  return {
    months: monthsArray,
    totalPaid,
    totalBonus,
    totalValue: totalPaid + totalBonus,
  };
}