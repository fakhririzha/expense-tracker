"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { decryptAccountName } from "@/lib/account-crypto";
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  addDays,
  isSameDay,
} from "date-fns";
import { TransactionType } from "@/generated/prisma/client/client";

// Types for calendar events
export interface CalendarEvent {
  id: string;
  name: string;
  amount: number;
  currency: string;
  type: TransactionType;
  date: Date;
  category?: {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
  } | null;
  account?: {
    id: string;
    name: string;
  } | null;
  source: "recurring" | "transaction";
  recurringRuleId?: string;
}

export interface CalendarDayEvents {
  date: Date;
  events: CalendarEvent[];
}

export interface MonthSummary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  currency: string;
}

async function getAccountMap(userId: string, accountIds: string[]) {
  if (accountIds.length === 0) {
    return new Map<string, { id: string; name: string }>();
  }

  const accounts = await prisma.financialAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, nameEncrypted: true },
  });

  const entries = await Promise.all(
    accounts.map(async (account) => [
      account.id,
      {
        id: account.id,
        name: await decryptAccountName(userId, account.nameEncrypted),
      },
    ] as const)
  );

  return new Map(entries);
}

/**
 * Retrieve calendar events for a given month, including active recurring rules due in that month and scheduled transactions.
 *
 * @param params.year - The calendar year to query.
 * @param params.month - The calendar month to query (1-12).
 * @param params.accountId - Optional account id to filter events by account.
 * @param params.type - Optional transaction type to filter events.
 * @returns An object with a `success` flag and `data` containing an array of `CalendarEvent` entries for the month; on failure `success` is `false` and `error` contains a human-readable message.
 */
export async function getCalendarEvents(params: {
  year: number;
  month: number; // 1-12
  accountId?: string;
  type?: TransactionType;
}): Promise<{ success: boolean; data: CalendarEvent[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, data: [], error: "Unauthorized" };
    }

    const { year, month, accountId, type } = params;

    // Create date range for the month
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);

    const events: CalendarEvent[] = [];

    // 1. Get active recurring rules with nextDueDate in the month
    const recurringRules = await prisma.recurringRule.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        nextDueDate: {
          gte: monthStart,
          lte: monthEnd,
        },
        ...(accountId && { accountId }),
        ...(type && { type }),
      },
    });

    // Get unique category IDs and account IDs from recurring rules
    const categoryIds = new Set(
      recurringRules.map((r) => r.categoryId).filter(Boolean) as string[]
    );
    const accountIds = new Set(
      recurringRules.map((r) => r.accountId).filter(Boolean) as string[]
    );

    // Fetch categories and accounts
    const [categories, accounts] = await Promise.all([
      categoryIds.size > 0
        ? prisma.category.findMany({
            where: { id: { in: Array.from(categoryIds) } },
            select: { id: true, name: true, icon: true, color: true },
          })
        : [],
      accountIds.size > 0
        ? getAccountMap(session.user.id, Array.from(accountIds))
        : [],
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const accountMap =
      accounts instanceof Map
        ? accounts
        : new Map<string, { id: string; name: string }>();

    // Add recurring rules as events
    for (const rule of recurringRules) {
      events.push({
        id: `recurring-${rule.id}`,
        name: rule.name,
        amount: rule.amount,
        currency: rule.currency,
        type: rule.type,
        date: rule.nextDueDate,
        category: rule.categoryId ? categoryMap.get(rule.categoryId) : null,
        account: rule.accountId ? accountMap.get(rule.accountId) : null,
        source: "recurring",
        recurringRuleId: rule.id,
      });
    }

    // 2. Get scheduled transactions in the month
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
        ...(accountId && { accountId }),
        ...(type && { type }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        account: {
          select: {
            id: true,
            nameEncrypted: true,
          },
        },
      },
    });

    // Add transactions as events (avoid duplicates with recurring rules)
    for (const tx of transactions) {
      // Skip if this transaction is already represented by a recurring rule
      if (tx.recurringRuleId) {
        const existingRecurring = events.find(
          (e) =>
            e.source === "recurring" &&
            e.recurringRuleId === tx.recurringRuleId &&
            isSameDay(e.date, tx.date)
        );
        if (existingRecurring) continue;
      }

      events.push({
        id: `transaction-${tx.id}`,
        name: tx.description || "Transaction",
        amount: tx.amount,
        currency: tx.currency,
        type: tx.type,
        date: tx.date,
        category: tx.category,
        account: {
          ...tx.account,
          name: await decryptAccountName(session.user.id, tx.account.nameEncrypted),
        },
        source: "transaction",
        recurringRuleId: tx.recurringRuleId || undefined,
      });
    }

    // Sort events by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    return { success: true, data: events };
  } catch (error) {
    console.error("Get calendar events error:", error);
    return { success: false, data: [], error: "Failed to fetch calendar events" };
  }
}

/**
 * Retrieve upcoming bills and scheduled transactions occurring within the next `days` days.
 *
 * Returns calendar events representing active recurring rules due in the date range and scheduled transactions;
 * when a transaction corresponds to a recurring rule on the same day it is omitted to avoid duplication.
 *
 * @param params.days - Number of days from today to include (inclusive)
 * @param params.accountId - Optional account ID to limit results to a specific financial account
 * @returns An object with `success` (operation result), `data` (an array of `CalendarEvent` items sorted by date ascending), and an optional `error` message (e.g., `"Unauthorized"` when the user is not authenticated)
 */
export async function getUpcomingBills(params: {
  days: number;
  accountId?: string;
}): Promise<{ success: boolean; data: CalendarEvent[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, data: [], error: "Unauthorized" };
    }

    const { days, accountId } = params;

    const today = startOfDay(new Date());
    const endDate = endOfDay(addDays(today, days));

    const events: CalendarEvent[] = [];

    // Get active recurring rules due within the range
    const recurringRules = await prisma.recurringRule.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        nextDueDate: {
          gte: today,
          lte: endDate,
        },
        ...(accountId && { accountId }),
      },
    });

    // Get unique category IDs and account IDs from recurring rules
    const categoryIds = new Set(
      recurringRules.map((r) => r.categoryId).filter(Boolean) as string[]
    );
    const accountIds = new Set(
      recurringRules.map((r) => r.accountId).filter(Boolean) as string[]
    );

    // Fetch categories and accounts
    const [categories, accounts] = await Promise.all([
      categoryIds.size > 0
        ? prisma.category.findMany({
            where: { id: { in: Array.from(categoryIds) } },
            select: { id: true, name: true, icon: true, color: true },
          })
        : [],
      accountIds.size > 0
        ? getAccountMap(session.user.id, Array.from(accountIds))
        : [],
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const accountMap =
      accounts instanceof Map
        ? accounts
        : new Map<string, { id: string; name: string }>();

    for (const rule of recurringRules) {
      events.push({
        id: `recurring-${rule.id}`,
        name: rule.name,
        amount: rule.amount,
        currency: rule.currency,
        type: rule.type,
        date: rule.nextDueDate,
        category: rule.categoryId ? categoryMap.get(rule.categoryId) : null,
        account: rule.accountId ? accountMap.get(rule.accountId) : null,
        source: "recurring",
        recurringRuleId: rule.id,
      });
    }

    // Get scheduled transactions in the range
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: today,
          lte: endDate,
        },
        ...(accountId && { accountId }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        account: {
          select: {
            id: true,
            nameEncrypted: true,
          },
        },
      },
    });

    for (const tx of transactions) {
      // Skip if already represented by recurring rule
      if (tx.recurringRuleId) {
        const existingRecurring = events.find(
          (e) =>
            e.source === "recurring" &&
            e.recurringRuleId === tx.recurringRuleId &&
            isSameDay(e.date, tx.date)
        );
        if (existingRecurring) continue;
      }

      events.push({
        id: `transaction-${tx.id}`,
        name: tx.description || "Transaction",
        amount: tx.amount,
        currency: tx.currency,
        type: tx.type,
        date: tx.date,
        category: tx.category,
        account: {
          ...tx.account,
          name: await decryptAccountName(session.user.id, tx.account.nameEncrypted),
        },
        source: "transaction",
        recurringRuleId: tx.recurringRuleId || undefined,
      });
    }

    // Sort by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    return { success: true, data: events };
  } catch (error) {
    console.error("Get upcoming bills error:", error);
    return { success: false, data: [], error: "Failed to fetch upcoming bills" };
  }
}

/**
 * Retrieve calendar events scheduled for a specific date.
 *
 * Includes active recurring rules due on that date and transactions dated that day. If a transaction is linked to a recurring rule that is also present for the same day, the transaction is omitted to avoid duplication. Results are sorted by amount in descending order.
 *
 * @param date - The target date to fetch events for (day-level).
 * @param accountId - Optional financial account ID to filter events.
 * @returns An object with `success` indicating the operation result, `data` containing the list of `CalendarEvent` entries for the date (recurring events and transactions, sorted by amount descending), and an optional `error` message (for example `"Unauthorized"` when the user is not authenticated). 
 */
export async function getEventsForDate(params: {
  date: Date;
  accountId?: string;
}): Promise<{ success: boolean; data: CalendarEvent[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, data: [], error: "Unauthorized" };
    }

    const { date, accountId } = params;

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const events: CalendarEvent[] = [];

    // Get recurring rules due on this date
    const recurringRules = await prisma.recurringRule.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        nextDueDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        ...(accountId && { accountId }),
      },
    });

    // Get unique category IDs and account IDs from recurring rules
    const categoryIds = new Set(
      recurringRules.map((r) => r.categoryId).filter(Boolean) as string[]
    );
    const accountIds = new Set(
      recurringRules.map((r) => r.accountId).filter(Boolean) as string[]
    );

    // Fetch categories and accounts
    const [categories, accounts] = await Promise.all([
      categoryIds.size > 0
        ? prisma.category.findMany({
            where: { id: { in: Array.from(categoryIds) } },
            select: { id: true, name: true, icon: true, color: true },
          })
        : [],
      accountIds.size > 0
        ? getAccountMap(session.user.id, Array.from(accountIds))
        : [],
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const accountMap =
      accounts instanceof Map
        ? accounts
        : new Map<string, { id: string; name: string }>();

    for (const rule of recurringRules) {
      events.push({
        id: `recurring-${rule.id}`,
        name: rule.name,
        amount: rule.amount,
        currency: rule.currency,
        type: rule.type,
        date: rule.nextDueDate,
        category: rule.categoryId ? categoryMap.get(rule.categoryId) : null,
        account: rule.accountId ? accountMap.get(rule.accountId) : null,
        source: "recurring",
        recurringRuleId: rule.id,
      });
    }

    // Get transactions on this date
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
        ...(accountId && { accountId }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        account: {
          select: {
            id: true,
            nameEncrypted: true,
          },
        },
      },
    });

    for (const tx of transactions) {
      // Skip if already represented by recurring rule
      if (tx.recurringRuleId) {
        const existingRecurring = events.find(
          (e) => e.source === "recurring" && e.recurringRuleId === tx.recurringRuleId
        );
        if (existingRecurring) continue;
      }

      events.push({
        id: `transaction-${tx.id}`,
        name: tx.description || "Transaction",
        amount: tx.amount,
        currency: tx.currency,
        type: tx.type,
        date: tx.date,
        category: tx.category,
        account: {
          ...tx.account,
          name: await decryptAccountName(session.user.id, tx.account.nameEncrypted),
        },
        source: "transaction",
        recurringRuleId: tx.recurringRuleId || undefined,
      });
    }

    // Sort by amount (largest first)
    events.sort((a, b) => b.amount - a.amount);

    return { success: true, data: events };
  } catch (error) {
    console.error("Get events for date error:", error);
    return { success: false, data: [], error: "Failed to fetch events for date" };
  }
}

/**
 * Compute income, expenses, and net totals for a specific month using the user's main currency.
 *
 * @param year - Calendar year (e.g., 2026)
 * @param month - Month number (1-12)
 * @param accountId - Optional account id to restrict transactions to a single account
 * @returns An object with `success` and `data`. When `success` is `true`, `data` is a `MonthSummary` containing `totalIncome`, `totalExpenses`, `net`, and `currency`; when `success` is `false`, `data` is `null`.
 */
export async function getMonthSummary(params: {
  year: number;
  month: number;
  accountId?: string;
}): Promise<{ success: boolean; data: MonthSummary | null; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, data: null, error: "Unauthorized" };
    }

    const { year, month, accountId } = params;

    // Get user's main currency
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mainCurrency: true },
    });

    const currency = user?.mainCurrency || "IDR";

    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);

    // Get transactions for the month
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
        type: {
          in: ["INCOME", "EXPENSE"],
        },
        ...(accountId && { accountId }),
      },
    });

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const tx of transactions) {
      const amountInMainCurrency = tx.amount * tx.exchangeRate;
      if (tx.type === "INCOME") {
        totalIncome += amountInMainCurrency;
      } else if (tx.type === "EXPENSE") {
        totalExpenses += amountInMainCurrency;
      }
    }

    return {
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        net: totalIncome - totalExpenses,
        currency,
      },
    };
  } catch (error) {
    console.error("Get month summary error:", error);
    return { success: false, data: null, error: "Failed to fetch month summary" };
  }
}
