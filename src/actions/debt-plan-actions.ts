"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { decryptAccountName } from "@/lib/account-crypto";
import { isLiabilityAccountType } from "@/lib/account-types";
import {
  compareDebtPayoffStrategies,
  simulateDebtPayoff,
  type DebtPayoffInputDebt,
  type DebtPayoffSimulationResult,
  type DebtPayoffStrategyComparison,
  type DebtPayoffStrategyValue,
} from "@/lib/debt-payoff";
import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";
import { DebtPayoffStrategy } from "@/generated/prisma/client/client";

const debtPlanItemSchema = z.object({
  accountId: z.string().min(1),
  annualInterestRate: z
    .number()
    .min(0, "Interest rate cannot be negative")
    .max(100, "Interest rate looks unrealistic"),
  minimumPayment: z.number().positive("Minimum payment must be positive"),
  priorityOverride: z.number().int().min(1).max(100).optional().nullable(),
  paymentDayOfMonth: z.number().int().min(1).max(28).default(1),
});

const debtPlanSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(120).default("My debt payoff plan"),
    strategy: z.enum(["AVALANCHE", "SNOWBALL", "CUSTOM"]),
    extraMonthlyAmount: z.number().min(0).default(0),
    currency: z.string().min(3).max(3).optional(),
    isActive: z.boolean().default(true),
    items: z.array(debtPlanItemSchema).min(1, "Add at least one liability"),
  })
  .superRefine((data, ctx) => {
    if (data.strategy === "CUSTOM") {
      const missingPriority = data.items.some(
        (item) => item.priorityOverride == null
      );
      if (missingPriority) {
        ctx.addIssue({
          code: "custom",
          message: "Custom strategy requires a priority on every debt",
          path: ["items"],
        });
      }
    }

    const accountIds = data.items.map((item) => item.accountId);
    if (new Set(accountIds).size !== accountIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Each liability can only appear once in a plan",
        path: ["items"],
      });
    }
  });

export type DebtPlanInput = z.infer<typeof debtPlanSchema>;

export interface DebtPlanItemView {
  id: string;
  accountId: string;
  accountName: string;
  accountType: string;
  accountCurrency: string;
  balance: number;
  balanceInPlanCurrency: number;
  exchangeRate: number;
  annualInterestRate: number;
  minimumPayment: number;
  priorityOverride: number | null;
  paymentDayOfMonth: number;
  isActive: boolean;
}

export interface DebtPlanView {
  id: string;
  name: string;
  strategy: DebtPayoffStrategyValue;
  extraMonthlyAmount: number;
  currency: string;
  isActive: boolean;
  items: DebtPlanItemView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DebtPlanProjection {
  plan: DebtPlanView;
  simulation: DebtPayoffSimulationResult;
  comparison: DebtPayoffStrategyComparison;
  totalDebtInPlanCurrency: number;
  missingRateCount: number;
}

async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ amount: number; rate: number; missing: boolean }> {
  if (fromCurrency === toCurrency) {
    return { amount, rate: 1, missing: false };
  }

  const rate = await getExchangeRate(fromCurrency, toCurrency);
  if (rate == null || rate <= 0) {
    return { amount, rate: 1, missing: true };
  }

  return { amount: amount * rate, rate, missing: false };
}

async function mapPlanRecord(
  userId: string,
  plan: {
    id: string;
    name: string;
    strategy: DebtPayoffStrategy;
    extraMonthlyAmount: number;
    currency: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      accountId: string;
      annualInterestRate: number;
      minimumPayment: number;
      priorityOverride: number | null;
      paymentDayOfMonth: number;
      account: {
        id: string;
        nameEncrypted: string;
        type: string;
        currency: string;
        balance: number;
        isActive: boolean;
      };
    }>;
  }
): Promise<{ plan: DebtPlanView; missingRateCount: number }> {
  let missingRateCount = 0;

  const items: DebtPlanItemView[] = await Promise.all(
    plan.items.map(async (item) => {
      const accountName = await decryptAccountName(
        userId,
        item.account.nameEncrypted
      );
      const outstanding = Math.abs(item.account.balance);
      const converted = await convertAmount(
        outstanding,
        item.account.currency,
        plan.currency
      );
      if (converted.missing) {
        missingRateCount += 1;
      }

      return {
        id: item.id,
        accountId: item.accountId,
        accountName,
        accountType: item.account.type,
        accountCurrency: item.account.currency,
        balance: outstanding,
        balanceInPlanCurrency: converted.amount,
        exchangeRate: converted.rate,
        annualInterestRate: item.annualInterestRate,
        minimumPayment: item.minimumPayment,
        priorityOverride: item.priorityOverride,
        paymentDayOfMonth: item.paymentDayOfMonth,
        isActive: item.account.isActive,
      };
    })
  );

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      strategy: plan.strategy,
      extraMonthlyAmount: plan.extraMonthlyAmount,
      currency: plan.currency,
      isActive: plan.isActive,
      items,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    },
    missingRateCount,
  };
}

function toSimulationDebts(items: DebtPlanItemView[]): DebtPayoffInputDebt[] {
  return items
    .filter((item) => item.balanceInPlanCurrency > 0)
    .map((item) => ({
      id: item.accountId,
      name: item.accountName,
      balance: item.balanceInPlanCurrency,
      annualInterestRate: item.annualInterestRate,
      minimumPayment: item.minimumPayment,
      priorityOverride: item.priorityOverride,
    }));
}

const planInclude = {
  items: {
    include: {
      account: {
        select: {
          id: true,
          nameEncrypted: true,
          type: true,
          currency: true,
          balance: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ priorityOverride: "asc" as const }, { createdAt: "asc" as const }],
  },
};

/**
 * Fetch the user's active debt payoff plan, or null when none exists.
 */
export async function getActiveDebtPlan(): Promise<{
  success: boolean;
  data?: DebtPlanView | null;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const plan = await prisma.debtPlan.findFirst({
      where: { userId: session.user.id, isActive: true },
      include: planInclude,
      orderBy: { updatedAt: "desc" },
    });

    if (!plan) {
      return { success: true, data: null };
    }

    const mapped = await mapPlanRecord(session.user.id, plan);
    return { success: true, data: mapped.plan };
  } catch (error) {
    console.error("getActiveDebtPlan error:", error);
    return { success: false, error: "Failed to load debt plan" };
  }
}

/**
 * Build a live projection for the active plan using current liability balances.
 */
export async function getDebtPlanProjection(): Promise<{
  success: boolean;
  data?: DebtPlanProjection | null;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const plan = await prisma.debtPlan.findFirst({
      where: { userId: session.user.id, isActive: true },
      include: planInclude,
      orderBy: { updatedAt: "desc" },
    });

    if (!plan) {
      return { success: true, data: null };
    }

    const mapped = await mapPlanRecord(session.user.id, plan);
    const debts = toSimulationDebts(mapped.plan.items);
    const simulation = simulateDebtPayoff({
      debts,
      strategy: mapped.plan.strategy,
      extraMonthlyAmount: mapped.plan.extraMonthlyAmount,
    });
    const comparison = compareDebtPayoffStrategies({
      debts,
      extraMonthlyAmount: mapped.plan.extraMonthlyAmount,
    });

    if (mapped.missingRateCount > 0) {
      simulation.warnings = [
        ...simulation.warnings,
        `${mapped.missingRateCount} balance(s) used a 1:1 FX fallback because live rates were unavailable.`,
      ];
    }

    const totalDebtInPlanCurrency = debts.reduce(
      (sum, debt) => sum + debt.balance,
      0
    );

    return {
      success: true,
      data: {
        plan: mapped.plan,
        simulation,
        comparison,
        totalDebtInPlanCurrency,
        missingRateCount: mapped.missingRateCount,
      },
    };
  } catch (error) {
    console.error("getDebtPlanProjection error:", error);
    return { success: false, error: "Failed to project debt plan" };
  }
}

/**
 * Create a new debt payoff plan. When marked active, other plans for the user are deactivated.
 */
export async function createDebtPlan(input: DebtPlanInput): Promise<{
  success: boolean;
  data?: DebtPlanView;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = debtPlanSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid debt plan",
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mainCurrency: true },
    });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const currency = (parsed.data.currency ?? user.mainCurrency).toUpperCase();
    const accountIds = parsed.data.items.map((item) => item.accountId);
    const accounts = await prisma.financialAccount.findMany({
      where: {
        userId: session.user.id,
        id: { in: accountIds },
      },
      select: { id: true, type: true, isActive: true },
    });

    if (accounts.length !== accountIds.length) {
      return { success: false, error: "One or more accounts were not found" };
    }

    for (const account of accounts) {
      if (!isLiabilityAccountType(account.type)) {
        return {
          success: false,
          error: "Only loan and credit card accounts can be included",
        };
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      if (parsed.data.isActive) {
        await tx.debtPlan.updateMany({
          where: { userId: session.user.id, isActive: true },
          data: { isActive: false },
        });
      }

      return tx.debtPlan.create({
        data: {
          name: parsed.data.name,
          strategy: parsed.data.strategy,
          extraMonthlyAmount: parsed.data.extraMonthlyAmount,
          currency,
          isActive: parsed.data.isActive,
          userId: session.user.id,
          items: {
            create: parsed.data.items.map((item) => ({
              accountId: item.accountId,
              annualInterestRate: item.annualInterestRate,
              minimumPayment: item.minimumPayment,
              priorityOverride: item.priorityOverride ?? null,
              paymentDayOfMonth: item.paymentDayOfMonth ?? 1,
              userId: session.user.id,
            })),
          },
        },
        include: planInclude,
      });
    });

    const mapped = await mapPlanRecord(session.user.id, created);
    revalidatePath("/dashboard/liabilities");
    revalidatePath("/dashboard/insights");
    return { success: true, data: mapped.plan };
  } catch (error) {
    console.error("createDebtPlan error:", error);
    return { success: false, error: "Failed to create debt plan" };
  }
}

/**
 * Update an existing debt payoff plan and replace its items.
 */
export async function updateDebtPlan(
  id: string,
  input: DebtPlanInput
): Promise<{
  success: boolean;
  data?: DebtPlanView;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = debtPlanSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid debt plan",
      };
    }

    const existing = await prisma.debtPlan.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Debt plan not found" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mainCurrency: true },
    });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const currency = (parsed.data.currency ?? user.mainCurrency).toUpperCase();
    const accountIds = parsed.data.items.map((item) => item.accountId);
    const accounts = await prisma.financialAccount.findMany({
      where: {
        userId: session.user.id,
        id: { in: accountIds },
      },
      select: { id: true, type: true },
    });

    if (accounts.length !== accountIds.length) {
      return { success: false, error: "One or more accounts were not found" };
    }

    for (const account of accounts) {
      if (!isLiabilityAccountType(account.type)) {
        return {
          success: false,
          error: "Only loan and credit card accounts can be included",
        };
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.isActive) {
        await tx.debtPlan.updateMany({
          where: {
            userId: session.user.id,
            isActive: true,
            NOT: { id },
          },
          data: { isActive: false },
        });
      }

      await tx.debtPlanItem.deleteMany({
        where: { debtPlanId: id, userId: session.user.id },
      });

      return tx.debtPlan.update({
        where: { id },
        data: {
          name: parsed.data.name,
          strategy: parsed.data.strategy,
          extraMonthlyAmount: parsed.data.extraMonthlyAmount,
          currency,
          isActive: parsed.data.isActive,
          items: {
            create: parsed.data.items.map((item) => ({
              accountId: item.accountId,
              annualInterestRate: item.annualInterestRate,
              minimumPayment: item.minimumPayment,
              priorityOverride: item.priorityOverride ?? null,
              paymentDayOfMonth: item.paymentDayOfMonth ?? 1,
              userId: session.user.id,
            })),
          },
        },
        include: planInclude,
      });
    });

    const mapped = await mapPlanRecord(session.user.id, updated);
    revalidatePath("/dashboard/liabilities");
    revalidatePath("/dashboard/insights");
    return { success: true, data: mapped.plan };
  } catch (error) {
    console.error("updateDebtPlan error:", error);
    return { success: false, error: "Failed to update debt plan" };
  }
}

/**
 * Delete a debt payoff plan owned by the authenticated user.
 */
export async function deleteDebtPlan(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const existing = await prisma.debtPlan.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Debt plan not found" };
    }

    await prisma.debtPlan.delete({ where: { id } });
    revalidatePath("/dashboard/liabilities");
    revalidatePath("/dashboard/insights");
    return { success: true };
  } catch (error) {
    console.error("deleteDebtPlan error:", error);
    return { success: false, error: "Failed to delete debt plan" };
  }
}

/**
 * Liability accounts eligible for payoff planning (active loan / credit card).
 */
export async function getDebtPlanEligibleAccounts(): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    type: string;
    currency: string;
    balance: number;
  }>;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const accounts = await prisma.financialAccount.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        type: { in: ["LOAN", "CREDIT_CARD"] },
      },
      select: {
        id: true,
        nameEncrypted: true,
        type: true,
        currency: true,
        balance: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const data = await Promise.all(
      accounts.map(async (account) => ({
        id: account.id,
        name: await decryptAccountName(session.user.id, account.nameEncrypted),
        type: account.type,
        currency: account.currency,
        balance: Math.abs(account.balance),
      }))
    );

    return { success: true, data };
  } catch (error) {
    console.error("getDebtPlanEligibleAccounts error:", error);
    return { success: false, error: "Failed to load liability accounts", data: [] };
  }
}
