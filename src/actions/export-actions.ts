"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { format } from "date-fns";

/**
 * Sanitizes a CSV cell to prevent spreadsheet formula injection.
 *
 * Detects the first non-whitespace character and checks if it's a formula injection
 * character ("=", "+", "-", or "@"). If so, inserts a single quote immediately after
 * any leading whitespace to neutralize the formula. Internal double quotes are escaped
 * by doubling them, and the entire cell is wrapped in double quotes.
 *
 * @param value - The input value to sanitize
 * @returns The sanitized CSV cell as a quoted string
 */
function sanitizeCsvCell(value: string): string {
  const strValue = String(value);
  // Capture leading whitespace and check the first non-whitespace character
  const leadingWhitespaceMatch = strValue.match(/^(\s*)/);
  const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : "";
  const restOfString = strValue.slice(leadingWhitespace.length);
  // Check if the first non-whitespace character is a formula injection character
  const hasDangerousPrefix = /^[=+\-@]/.test(restOfString);
  // Double any internal quotes
  const escaped = strValue.replace(/"/g, '""');
  // Insert single quote after leading whitespace if dangerous, then wrap in double quotes
  return `"${leadingWhitespace}${hasDangerousPrefix ? "'" : ""}${escaped.slice(leadingWhitespace.length)}"`;
}

/**
 * Export the current user's transactions filtered by the provided parameters as a CSV string.
 *
 * @param params - Optional filters for the export: `startDate` and `endDate` restrict the transaction date range, `accountId` limits to a specific account, and `type` filters by transaction type.
 * @returns An object with `success: true` containing `data` (the CSV string), `filename` (generated filename), and `count` (number of exported transactions) when the export succeeds; otherwise `success: false` with an `error` message.
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
 * Create a complete JSON backup of the authenticated user's data.
 *
 * The backup includes accounts, transactions (with account, category and to-account names), categories, budgets (with category name), investment assets, trade history (with asset symbol), recurring rules, and savings goals. The function returns serialized JSON, a generated filename, and a summary of record counts for each dataset, or an error object if export fails or the user is unauthorized.
 *
 * @returns An object with `success: true`, `data` (the backup as a formatted JSON string), `filename` (generated backup filename), and `summary` (counts per dataset); or an object with `success: false` and an `error` message on failure.
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
 * Export the current user's accounts as a CSV string.
 *
 * Fetches the authenticated user's financial accounts and constructs a CSV containing
 * the columns: Name, Type, Currency, Balance, Description, Is Active, Created At.
 *
 * @returns An object with:
 * - `success`: `true` if export succeeded, `false` otherwise.
 * - `data`: the CSV string when `success` is `true`.
 * - `filename`: generated filename for the CSV when `success` is `true`.
 * - `count`: number of exported accounts when `success` is `true`.
 * - `error`: error message when `success` is `false`.
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
 * Export the current user's budgets as a CSV string.
 *
 * @returns On success, an object with `success: true`, `data` (the CSV content), `filename` (generated filename), and `count` (number of budgets exported); on failure, an object with `success: false` and an `error` message (for example `"Unauthorized"` or `"Failed to export budgets"`).
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
 * Export the current user's categories to a CSV-formatted string.
 *
 * Authenticates the caller, retrieves categories that belong to the user or are system-wide,
 * and returns a CSV containing Name, Type, Icon, Color, and Is System columns. Cells are sanitized
 * to prevent CSV formula injection.
 *
 * @returns An object with `success: true` containing `data` (CSV string), `filename` (generated filename), and `count` (number of categories) on success; otherwise `success: false` with an `error` message such as `"Unauthorized"` or a generic failure message.
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
 * Export the current user's investment assets as a CSV string suitable for download.
 *
 * @returns An object with `success: true` containing `data` (CSV content), `filename` (generated filename), and `count` (number of records) on success; `success: false` with an `error` message on failure or if unauthorized.
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
 * Export the user's recurring rules as a CSV string suitable for download.
 *
 * @returns On success, an object with `success: true`, `data` containing the CSV text, `filename` with a timestamped filename, and `count` of exported rules; on failure, an object with `success: false` and an `error` message.
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