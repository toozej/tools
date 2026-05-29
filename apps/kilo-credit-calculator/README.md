# Kilo Credit Calculator

A tool for modeling Kilo Plus subscription credits and payments over time.

## Features

- Calculate credit accumulation based on plan selection (Starter, Pro, Expert)
- Choose between monthly or annual billing cycles
- Visualize bonus streak progression (up to 50% bonus)
- Adjust monthly credit usage with slider
- See month-by-month projection of credits

## Usage

1. Select your plan (Starter $19/mo, Pro $49/mo, or Expert $199/mo)
2. Choose billing cycle (Monthly or Annual)
3. Enter starting credits (optional)
4. Set projection period (1-24 months)
5. Adjust monthly usage slider to model credit consumption

The calculator shows:
- Total paid amount
- Total bonus earned
- Final credit balance
- Month-by-month breakdown of credits added and consumed

## Bonus Formula

**Monthly plans:**
- Month 1: 50% welcome bonus
- Months 2+: min(40%, 5% + 5% × (streakMonths - 1))

**Annual plans:**
- 50% bonus every month

## Technology Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS 4