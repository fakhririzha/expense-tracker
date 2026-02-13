"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { format } from "date-fns";

/**
 * Sanitizes a CSV cell value to prevent formula injection attacks.
 * Cells starting with "=", "+", "-", or "@" are prefixed with a single quote.
 * Internal quotes are doubled and the cell is wrapped in double quotes.
 */
function sanitizeCsvCell(value: string): string {
  const strValue = String(value);
  // Check if the value starts with a formula injection character
  const dangerousPrefix = /^[=+\-@]/.test(strValue);
  // Double any internal quotes
  const escaped = strValue.replace(/"/g, '""');
  // Prefix with single quote if dangerous, then wrap in double quotes
  return `"${dangerousPrefix ? "'" : ""}${escaped}"`;
}

/**
 * Export transactions to CSV format
 */
export async function exportTransactionsCSV(params?: {
  startDate?: Date;
  endDate?: Date;
  accountId?: string;
  type?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (params?.accountId) where.accountId = params.accountId;
    if (params?.type) where.type = params.type;
    if (params?.startDate || params?.endDate) {
      where.date = {};
      if (params?.startDate)
        (where.date as Record<string, Date>).gte = params.startDate;
      if (params?.endDate)
        (where.date as Record<string, Date>).lte = params.endDate;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        account: {
          select: { name: true, currency: true },
        },
        category: {
          select: { name: true },
        },
        toAccount: {
          select: { name: true },
        },
      },
      orderBy: { date: "desc" },
    });

    // CSV Headers
    const headers = [
      "Date",
      "Amount",
      "Type",
      "Category",
      "Account",
      "To Account",
      "Description",
      "Currency",
      "Exchange Rate",
    ];

    // CSV Rows
    const rows = transactions.map((t) => [
      format(new Date(t.date), "yyyy-MM-dd"),
      t.amount.toString(),
      t.type,
      t.category?.name || "",
      t.account.name,
      t.toAccount?.name || "",
      t.description || "",
      t.currency,
      t.exchangeRate.toString(),
    ]);

    // Combine headers and rows
    const csv = [
      headers.map((h) => sanitizeCsvCell(h)).join(","),
      ...rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(",")),
    ].join("\n");

    return {
      success: true,
      data: csv,
      filename: `transactions-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`,
      count: transactions.length,
    };
  } catch (error) {
    console.error("Export transactions error:", error);
    return { success: false, error: "Failed to export transactions" };
  }
}

/**
 * Export all user data for backup
 */
export async function exportAllData() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Fetch all user data in parallel
    const [
      accounts,
      transactions,
      categories,
      budgets,
      investmentAssets,
      tradeHistory,
      recurringRules,
      savingsGoals,
    ] = await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId: session.user.id },
      }),
      prisma.transaction.findMany({
        where: { userId: session.user.id },
        include: {
          account: { select: { name: true } },
          category: { select: { name: true } },
          toAccount: { select: { name: true } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.category.findMany({
        where: { userId: session.user.id },
      }),
      prisma.budget.findMany({
        where: { userId: session.user.id },
        include: { category: { select: { name: true } } },
      }),
      prisma.investmentAsset.findMany({
        where: { userId: session.user.id },
      }),
      prisma.tradeHistory.findMany({
        where: { userId: session.user.id },
        include: { asset: { select: { symbol: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.recurringRule.findMany({
        where: { userId: session.user.id },
      }),
      prisma.savingsGoal.findMany({
        where: { userId: session.user.id },
      }),
    ]);

    // Create a JSON backup
    const backup = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      data: {
        accounts,
        transactions: transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          currency: t.currency,
          exchangeRate: t.exchangeRate,
          type: t.type,
          description: t.description,
          date: t.date,
          accountName: t.account.name,
          categoryName: t.category?.name || null,
          toAccountName: t.toAccount?.name || null,
        })),
        categories,
        budgets: budgets.map((b) => ({
          id: b.id,
          name: b.name,
          amount: b.amount,
          period: b.period,
          startDate: b.startDate,
          endDate: b.endDate,
          isActive: b.isActive,
          categoryName: b.category?.name || null,
        })),
        investmentAssets,
        tradeHistory: tradeHistory.map((t) => ({
          id: t.id,
          type: t.type,
          quantity: t.quantity,
          pricePerUnit: t.pricePerUnit,
          totalAmount: t.totalAmount,
          fees: t.fees,
          date: t.date,
          notes: t.notes,
          symbol: t.asset.symbol,
        })),
        recurringRules,
        savingsGoals,
      },
    };

    return {
      success: true,
      data: JSON.stringify(backup, null, 2),
      filename: `finhealth-backup-${format(new Date(), "yyyy-MM-dd-HHmmss")}.json`,
      summary: {
        accounts: accounts.length,
        transactions: transactions.length,
        categories: categories.length,
        budgets: budgets.length,
        investmentAssets: investmentAssets.length,
        tradeHistory: tradeHistory.length,
        recurringRules: recurringRules.length,
        savingsGoals: savingsGoals.length,
      },
    };
  } catch (error) {
    console.error("Export all data error:", error);
    return { success: false, error: "Failed to export data" };
  }
}

/**
 * Export accounts to CSV format
 */
export async function exportAccountsCSV() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const accounts = await prisma.financialAccount.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });

    // CSV Headers
    const headers = [
      "Name",
      "Type",
      "Currency",
      "Balance",
      "Description",
      "Is Active",
      "Created At",
    ];

    // CSV Rows
    const rows = accounts.map((a) => [
      a.name,
      a.type,
      a.currency,
      a.balance.toString(),
      a.description || "",
      a.isActive ? "Yes" : "No",
      format(new Date(a.createdAt), "yyyy-MM-dd"),
    ]);

    // Combine headers and rows
    const csv = [
      headers.map((h) => sanitizeCsvCell(h)).join(","),
      ...rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(",")),
    ].join("\n");

    return {
      success: true,
      data: csv,
      filename: `accounts-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`,
      count: accounts.length,
    };
  } catch (error) {
    console.error("Export accounts error:", error);
    return { success: false, error: "Failed to export accounts" };
  }
}

/**
 * Export budgets to CSV format
 */
export async function exportBudgetsCSV() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const budgets = await prisma.budget.findMany({
      where: { userId: session.user.id },
      include: {
        category: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // CSV Headers
    const headers = [
      "Name",
      "Amount",
      "Period",
      "Category",
      "Start Date",
      "End Date",
      "Is Active",
    ];

    // CSV Rows
    const rows = budgets.map((b) => [
      b.name,
      b.amount.toString(),
      b.period,
      b.category?.name || "",
      format(new Date(b.startDate), "yyyy-MM-dd"),
      b.endDate ? format(new Date(b.endDate), "yyyy-MM-dd") : "",
      b.isActive ? "Yes" : "No",
    ]);

    // Combine headers and rows
    const csv = [
      headers.map((h) => sanitizeCsvCell(h)).join(","),
      ...rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(",")),
    ].join("\n");

    return {
      success: true,
      data: csv,
      filename: `budgets-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`,
      count: budgets.length,
    };
  } catch (error) {
    console.error("Export budgets error:", error);
    return { success: false, error: "Failed to export budgets" };
  }
}

/**
 * Export categories to CSV format
 */
export async function exportCategoriesCSV() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const categories = await prisma.category.findMany({
      where: {
        OR: [{ userId: session.user.id }, { isSystem: true }],
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    // CSV Headers
    const headers = ["Name", "Type", "Icon", "Color", "Is System"];

    // CSV Rows
    const rows = categories.map((c) => [
      c.name,
      c.type,
      c.icon || "",
      c.color || "",
      c.isSystem ? "Yes" : "No",
    ]);

    // Combine headers and rows
    const csv = [
      headers.map((h) => sanitizeCsvCell(h)).join(","),
      ...rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(",")),
    ].join("\n");

    return {
      success: true,
      data: csv,
      filename: `categories-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`,
      count: categories.length,
    };
  } catch (error) {
    console.error("Export categories error:", error);
    return { success: false, error: "Failed to export categories" };
  }
}

/**
 * Export investment assets to CSV format
 */
export async function exportInvestmentsCSV() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const investments = await prisma.investmentAsset.findMany({
      where: { userId: session.user.id },
      include: {
        account: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // CSV Headers
    const headers = [
      "Symbol",
      "Name",
      "Quantity",
      "Average Buy Price",
      "Currency",
      "Account",
      "Created At",
    ];

    // CSV Rows
    const rows = investments.map((i) => [
      i.symbol,
      i.name || "",
      i.quantity.toString(),
      i.avgBuyPrice.toString(),
      i.currency,
      i.account?.name || "",
      format(new Date(i.createdAt), "yyyy-MM-dd"),
    ]);

    // Combine headers and rows
    const csv = [
      headers.map((h) => sanitizeCsvCell(h)).join(","),
      ...rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(",")),
    ].join("\n");

    return {
      success: true,
      data: csv,
      filename: `investments-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`,
      count: investments.length,
    };
  } catch (error) {
    console.error("Export investments error:", error);
    return { success: false, error: "Failed to export investments" };
  }
}

/**
 * Export recurring rules to CSV format
 */
export async function exportRecurringRulesCSV() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const rules = await prisma.recurringRule.findMany({
      where: { userId: session.user.id },
      orderBy: { nextDueDate: "asc" },
    });

    // CSV Headers
    const headers = [
      "Name",
      "Amount",
      "Currency",
      "Type",
      "Interval",
      "Next Due Date",
      "End Date",
      "Description",
      "Is Active",
    ];

    // CSV Rows
    const rows = rules.map((r) => [
      r.name,
      r.amount.toString(),
      r.currency,
      r.type,
      r.interval,
      format(new Date(r.nextDueDate), "yyyy-MM-dd"),
      r.endDate ? format(new Date(r.endDate), "yyyy-MM-dd") : "",
      r.description || "",
      r.isActive ? "Yes" : "No",
    ]);

    // Combine headers and rows
    const csv = [
      headers.map((h) => sanitizeCsvCell(h)).join(","),
      ...rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(",")),
    ].join("\n");

    return {
      success: true,
      data: csv,
      filename: `recurring-rules-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`,
      count: rules.length,
    };
  } catch (error) {
    console.error("Export recurring rules error:", error);
    return { success: false, error: "Failed to export recurring rules" };
  }
}
