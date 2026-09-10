import { z } from "zod";

const finiteAmountSchema = z.number().finite();

export const mobileDashboardResponseSchema = z.object({
  displayCurrency: z.string().regex(/^[A-Z]{3}$/),
  position: z.object({
    totalAssets: finiteAmountSchema.nullable(),
    totalDebt: finiteAmountSchema,
    netWorth: finiteAmountSchema.nullable(),
    liquidFunds: finiteAmountSchema,
    investmentValue: finiteAmountSchema.nullable(),
  }),
  cashFlow: z.object({
    averageMonthlyIncome: finiteAmountSchema,
    averageMonthlyExpenses: finiteAmountSchema,
    savingsRate: finiteAmountSchema,
    monthsOfRunway: finiteAmountSchema,
  }),
  health: z
    .object({
      tier: z.enum(["S", "A", "B", "C", "F"]),
      label: z.string(),
      description: z.string(),
      debtToWealthRatio: finiteAmountSchema,
    })
    .nullable(),
  valuationWarning: z.string().nullable(),
});

export type MobileDashboardResponse = z.infer<
  typeof mobileDashboardResponseSchema
>;
