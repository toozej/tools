"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Plan,
  BillingCycle,
  PLAN_PRICES,
  calculateBonusPercentage,
  calculateProjection,
} from "@/lib/credit-calculator-utils";

export default function CreditCalculator() {
  const [plan, setPlan] = useState<Plan>("starter");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [startingCredits, setStartingCredits] = useState<number>(0);
  const [months, setMonths] = useState<number>(12);
  const [monthlyUsage, setMonthlyUsage] = useState<number>(0);

  // Ensure monthlyUsage doesn't exceed the maximum when plan changes
  useEffect(() => {
    const maxUsage = PLAN_PRICES[plan] * 3;
    if (monthlyUsage > maxUsage) {
      setMonthlyUsage(maxUsage);
    }
  }, [plan]);

    const projection = useMemo(() => {
      return calculateProjection(
        plan,
        billingCycle,
        startingCredits,
        months,
        monthlyUsage
      );
    }, [plan, billingCycle, startingCredits, months, monthlyUsage]);

  const finalCredits = projection.months[projection.months.length - 1]?.creditsAtEnd ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as Plan)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            <option value="starter">Starter - $19/mo</option>
            <option value="pro">Pro - $49/mo</option>
            <option value="expert">Expert - $199/mo</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Billing Cycle</label>
          <div className="flex gap-2">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`flex-1 px-3 py-2 rounded-lg border transition ${
                billingCycle === "monthly"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`flex-1 px-3 py-2 rounded-lg border transition ${
                billingCycle === "annual"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              }`}
            >
              Annual
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Starting Credits ($)
          </label>
          <input
            type="number"
            min="0"
            value={startingCredits}
            onChange={(e) => setStartingCredits(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Projection Period (months)
          </label>
          <input
            type="number"
            min="1"
            max="24"
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value) || 12)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>
      </div>

       <div>
         <label className="block text-sm font-medium mb-2">
           Monthly Credit Usage ($)
         </label>
         <div className="flex gap-2 items-center">
           <input
             type="range"
             min="0"
             max={PLAN_PRICES[plan] * 3}
             step="1"
             value={monthlyUsage}
             onChange={(e) => setMonthlyUsage(parseFloat(e.target.value))}
             className="flex-1"
           />
           <input
             type="number"
             min="0"
             max={PLAN_PRICES[plan] * 3}
             value={monthlyUsage}
             onChange={(e) => {
               const value = parseFloat(e.target.value) || 0;
               const maxUsage = PLAN_PRICES[plan] * 3;
               setMonthlyUsage(Math.min(maxUsage, value));
             }}
             className="w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
           />
         </div>
         <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
           <span>0</span>
           <span>{Math.round(PLAN_PRICES[plan] * 3)}</span>
         </div>
       </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            ${projection.totalPaid.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Bonus Earned</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${projection.totalBonus.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Final Credits</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ${finalCredits.toFixed(2)}
          </p>
        </div>
      </div>

      {billingCycle === "monthly" && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Monthly Bonus Formula:</strong> Month 1 = 50% welcome bonus. Months 2+ use:
            min(40%, 5% + 5% × (streakMonths - 1))
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 px-2">Month</th>
              <th className="text-right py-2 px-2">Bonus %</th>
              <th className="text-right py-2 px-2">Credits Added</th>
              <th className="text-right py-2 px-2">Credits Before</th>
              <th className="text-right py-2 px-2">Credits After Usage</th>
              <th className="text-right py-2 px-2">Credits After</th>
            </tr>
          </thead>
          <tbody>
            {projection.months.map((m) => (
              <tr key={m.month} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 px-2">{m.month}</td>
                <td className="text-right py-2 px-2 text-green-600 dark:text-green-400">
                  +{m.bonusPercent}%
                </td>
                <td className="text-right py-2 px-2">${m.monthlyTotal.toFixed(2)}</td>
                <td className="text-right py-2 px-2">${m.creditsBefore.toFixed(2)}</td>
                <td className="text-right py-2 px-2">${m.creditsAfterUsage.toFixed(2)}</td>
                <td className="text-right py-2 px-2 font-medium">${m.creditsAtEnd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}