"use server";

import { auth } from "@/auth";
import {
  decryptAccountName,
  decryptAccountRecords,
} from "@/lib/account-crypto";
import { decryptBudgetRecords } from "@/lib/budget-crypto";
import {
  decryptOptionalCompanion,
  decryptRequiredCompanion,
} from "@/lib/encrypted-companion-crypto";
import prisma from "@/lib/db";
import { format } from "date-fns";
import { decryptUserField } from "@/lib/user-encryption";

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

async function decryptPersonalAssetFields<
  T extends {
    name: string | null;
    nameEncrypted: string | null;
    notes: string | null;
    notesEncrypted: string | null;
  }
>(userId: string, asset: T): Promise<T & { name: string; notes: string | null }> {
  const [name, notes] = await Promise.all([
    decryptRequiredCompanion(userId, "personalAsset.name", asset.nameEncrypted, asset.name),
    decryptOptionalCompanion(userId, "personalAsset.notes", asset.notesEncrypted, asset.notes),
  ]);

  return { ...asset, name, notes };
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
          select: { nameEncrypted: true, currency: true },
        },
        category: {
          select: { name: true },
        },
        toAccount: {
          select: { nameEncrypted: true },
        },
        splits: {
          include: {
            category: {
              select: { id: true, name: true },
            },
          },
          orderBy: { sortOrder: "asc" },
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
      "Location",
      "Latitude",
      "Longitude",
      "Google Maps Link",
      "Currency",
      "Exchange Rate",
      "Is Recurring",
      "Payment Status",
      "Is Overpayment",
      "Is Split",
      "Split Count",
      "Split Allocations",
    ];

    // CSV Rows
    const rows = await Promise.all(
      transactions.map(async (t) => {
        const description = t.descriptionEncrypted
          ? await decryptUserField(session.user.id, "transaction.description", t.descriptionEncrypted).catch(() => t.description || "")
          : (t.description || "");
        const splitAllocations = await Promise.all(
          t.splits.map(async (split) => {
            const splitDescription = split.descriptionEncrypted
              ? await decryptUserField(
                  session.user.id,
                  "transactionSplit.description",
                  split.descriptionEncrypted
                ).catch(() => split.description || "")
              : (split.description || "");
            return `${split.category?.name || "Uncategorized"}:${split.amount}${splitDescription ? ` (${splitDescription})` : ""}`;
          })
        );

        return [
          format(new Date(t.date), "yyyy-MM-dd"),
          t.amount.toString(),
          t.type,
          t.category?.name || "",
          await decryptAccountName(session.user.id, t.account.nameEncrypted),
          t.toAccount
            ? await decryptAccountName(session.user.id, t.toAccount.nameEncrypted)
            : "",
          description,
          t.location || "",
          t.latitude?.toString() || "",
          t.longitude?.toString() || "",
          t.googleMapsLink || "",
          t.currency,
          t.exchangeRate.toString(),
          t.isRecurring ? "Yes" : "No",
          t.paymentStatus,
          t.isOverpayment ? "Yes" : "No",
          t.splits.length > 0 ? "Yes" : "No",
          t.splits.length.toString(),
          splitAllocations.join(" | "),
        ];
      })
    );

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
 * Create a complete, non-restorable JSON archive of the authenticated user's financial data.
 *
 * The archive contains readable, decrypted financial records and relation names without encryption ciphertext,
 * internal user identifiers, or push-subscription secrets.
 *
 * @returns An object with `success: true`, `data` (the archive as formatted JSON), `filename`, and record counts; or an error result.
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
      personalAssets,
      subscriptions,
      depositoAccounts,
      debtPlans,
      liabilityPaymentAudits,
      netWorthSnapshots,
    ] = await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId: session.user.id },
      }),
      prisma.transaction.findMany({
        where: { userId: session.user.id },
        include: {
          account: { select: { nameEncrypted: true } },
          category: { select: { name: true } },
          toAccount: { select: { nameEncrypted: true } },
          splits: {
            include: {
              category: { select: { id: true, name: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { date: "desc" },
      }),
      prisma.category.findMany({
        where: { userId: session.user.id },
      }),
      prisma.budget.findMany({
        where: { userId: session.user.id },
        include: {
          categories: {
            include: {
              category: { select: { name: true } },
            },
          },
        },
      }),
      prisma.investmentAsset.findMany({
        where: { userId: session.user.id },
        include: {
          account: { select: { nameEncrypted: true } },
        },
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
        include: {
          accounts: {
            select: {
              accountId: true,
              account: {
                select: {
                  id: true,
                  currency: true,
                  balance: true,
                },
              },
            },
          },
        },
      }),
      prisma.personalAsset.findMany({
        where: { userId: session.user.id },
        include: {
          valuations: {
            orderBy: [{ valuedAt: "desc" }, { createdAt: "desc" }],
          },
        },
      }),
      prisma.subscription.findMany({
        where: { userId: session.user.id },
        include: {
          account: { select: { nameEncrypted: true } },
          category: { select: { name: true } },
          recurringRule: { select: { name: true, nameEncrypted: true } },
        },
      }),
      prisma.depositoAccount.findMany({
        where: { userId: session.user.id },
        include: {
          account: { select: { nameEncrypted: true } },
          interestPostings: {
            include: { transaction: { select: { date: true } } },
            orderBy: { postingDate: "asc" },
          },
        },
      }),
      prisma.debtPlan.findMany({
        where: { userId: session.user.id },
        include: {
          items: {
            include: { account: { select: { nameEncrypted: true } } },
          },
        },
      }),
      prisma.liabilityPaymentAudit.findMany({
        where: { transaction: { userId: session.user.id } },
        include: { transaction: { select: { date: true } } },
      }),
      prisma.netWorthSnapshot.findMany({
        where: { userId: session.user.id },
        orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
      }),
    ]);

    const [
      decryptedAccounts,
      decryptedTransactions,
      decryptedBudgets,
      decryptedPersonalAssets,
    ] =
      await Promise.all([
        decryptAccountRecords(session.user.id, accounts),
        Promise.all(
          transactions.map(async (t) => ({
            ...t,
            description: t.descriptionEncrypted
              ? await decryptUserField(
                  session.user.id,
                  "transaction.description",
                  t.descriptionEncrypted
                ).catch(() => t.description)
              : t.description,
            referenceNumber: t.referenceNumberEncrypted
              ? await decryptUserField(
                  session.user.id,
                  "transaction.referenceNumber",
                  t.referenceNumberEncrypted
                ).catch(() => t.referenceNumber)
              : t.referenceNumber,
            accountName: await decryptAccountName(
              session.user.id,
              t.account.nameEncrypted
            ),
            toAccountName: t.toAccount
              ? await decryptAccountName(session.user.id, t.toAccount.nameEncrypted)
              : null,
            splits: await Promise.all(
              t.splits.map(async (split) => ({
                ...split,
                description: split.descriptionEncrypted
                  ? await decryptUserField(
                      session.user.id,
                      "transactionSplit.description",
                      split.descriptionEncrypted
                    ).catch(() => split.description)
                  : split.description,
              }))
            ),
          }))
        ),
        decryptBudgetRecords(session.user.id, budgets),
        Promise.all(
      personalAssets.map((asset) => decryptPersonalAssetFields(session.user.id, asset))
        ),
      ]);
    const decryptedAccountMap = new Map(
      decryptedAccounts.map((account) => [account.id, account.name])
    );
    const categoryNameMap = new Map(
      categories.map((category) => [category.id, category.name])
    );
    const [decryptedRecurringRules, decryptedSavingsGoals] = await Promise.all([
      Promise.all(
        recurringRules.map(async (rule) => ({
          ...rule,
          name: await decryptRequiredCompanion(
            session.user.id,
            "recurringRule.name",
            rule.nameEncrypted,
            rule.name
          ),
          description: await decryptOptionalCompanion(
            session.user.id,
            "recurringRule.description",
            rule.descriptionEncrypted,
            rule.description
          ),
        }))
      ),
      Promise.all(
        savingsGoals.map(async (goal) => ({
          ...goal,
          name: await decryptRequiredCompanion(
            session.user.id,
            "savingsGoal.name",
            goal.nameEncrypted,
            goal.name
          ),
          description: await decryptOptionalCompanion(
            session.user.id,
            "savingsGoal.description",
            goal.descriptionEncrypted,
            goal.description
          ),
        }))
      ),
    ]);
    const [decryptedSubscriptions, decryptedTradeHistory] = await Promise.all([
      Promise.all(
        subscriptions.map(async (subscription) => ({
          ...subscription,
          name: await decryptRequiredCompanion(
            session.user.id,
            "subscription.name",
            subscription.nameEncrypted,
            subscription.name
          ),
          provider: await decryptOptionalCompanion(
            session.user.id,
            "subscription.provider",
            subscription.providerEncrypted,
            subscription.provider
          ),
          description: await decryptOptionalCompanion(
            session.user.id,
            "subscription.description",
            subscription.descriptionEncrypted,
            subscription.description
          ),
          cancellationUrl: await decryptOptionalCompanion(
            session.user.id,
            "subscription.cancellationUrl",
            subscription.cancellationUrlEncrypted,
            subscription.cancellationUrl
          ),
          notes: await decryptOptionalCompanion(
            session.user.id,
            "subscription.notes",
            subscription.notesEncrypted,
            subscription.notes
          ),
        }))
      ),
      Promise.all(
        tradeHistory.map(async (trade) => ({
          ...trade,
          notes: trade.notesEncrypted
            ? await decryptUserField(
                session.user.id,
                "tradeHistory.notes",
                trade.notesEncrypted
              ).catch(() => trade.notes)
            : trade.notes,
        }))
      ),
    ]);

    // Create a readable archive without encryption ciphertext or internal identifiers.
    const backup = {
      exportDate: new Date().toISOString(),
      version: "2.0",
      restoreSupported: false,
      data: {
        accounts: decryptedAccounts.map((account) => ({
          name: account.name,
          type: account.type,
          currency: account.currency,
          balance: account.balance,
          description: account.description,
          isActive: account.isActive,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        })),
        transactions: decryptedTransactions.map((t) => ({
          amount: t.amount,
          currency: t.currency,
          exchangeRate: t.exchangeRate,
          type: t.type,
          description: t.description,
          referenceNumber: t.referenceNumber,
          location: t.location,
          latitude: t.latitude,
          longitude: t.longitude,
          googleMapsLink: t.googleMapsLink,
          date: t.date,
          isRecurring: t.isRecurring,
          paymentStatus: t.paymentStatus,
          isOverpayment: t.isOverpayment,
          processedAt: t.processedAt,
          accountName: t.accountName,
          categoryName: t.category?.name || null,
          toAccountName: t.toAccountName,
          splits: t.splits.map((split) => ({
            amount: split.amount,
            description: split.description,
            sortOrder: split.sortOrder,
            categoryName: split.category?.name || null,
          })),
        })),
        categories: categories.map((category) => ({
          name: category.name,
          type: category.type,
          icon: category.icon,
          color: category.color,
          isSystem: category.isSystem,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        })),
        budgets: decryptedBudgets.map((b) => ({
          name: b.name,
          amount: b.amount,
          period: b.period,
          scope: b.scope,
          startDate: b.startDate,
          endDate: b.endDate,
          isActive: b.isActive,
          categoryNames: b.categories.map((entry) => entry.category.name),
        })),
        investmentAssets: await Promise.all(
          investmentAssets.map(async (asset) => ({
            symbol: asset.symbol,
            name: asset.name,
            quantity: asset.quantity,
            avgBuyPrice: asset.avgBuyPrice,
            currency: asset.currency,
            unitType: asset.unitType,
            accountName: asset.account
              ? await decryptAccountName(session.user.id, asset.account.nameEncrypted)
              : null,
            createdAt: asset.createdAt,
            updatedAt: asset.updatedAt,
          }))
        ),
        tradeHistory: decryptedTradeHistory.map((trade) => ({
          type: trade.type,
          quantity: trade.quantity,
          pricePerUnit: trade.pricePerUnit,
          totalAmount: trade.totalAmount,
          fees: trade.fees,
          date: trade.date,
          notes: trade.notes,
          unitType: trade.unitType,
          realizedPnL: trade.realizedPnL,
          symbol: trade.asset.symbol,
          accountName: trade.accountId
            ? decryptedAccountMap.get(trade.accountId) ?? null
            : null,
          balanceBefore: trade.balanceBefore,
          balanceAfter: trade.balanceAfter,
          createdAt: trade.createdAt,
          updatedAt: trade.updatedAt,
        })),
        recurringRules: await Promise.all(
          decryptedRecurringRules.map(async (rule) => ({
            name: rule.name,
            amount: rule.amount,
            currency: rule.currency,
            type: rule.type,
            interval: rule.interval,
            nextDueDate: rule.nextDueDate,
            endDate: rule.endDate,
            isActive: rule.isActive,
            description: rule.description,
            categoryName: rule.categoryId
              ? categoryNameMap.get(rule.categoryId) ?? null
              : null,
            accountName: rule.accountId
              ? decryptedAccountMap.get(rule.accountId) ?? null
              : null,
            createdAt: rule.createdAt,
            updatedAt: rule.updatedAt,
          }))
        ),
        savingsGoals: decryptedSavingsGoals.map((goal) => ({
          name: goal.name,
          targetAmount: goal.targetAmount,
          targetDate: goal.targetDate,
          icon: goal.icon,
          color: goal.color,
          description: goal.description,
          accounts: goal.accounts.map((link) => ({
            name: decryptedAccountMap.get(link.accountId) ?? "Unknown account",
            currency: link.account.currency,
            balance: link.account.balance,
          })),
          createdAt: goal.createdAt,
          updatedAt: goal.updatedAt,
        })),
        personalAssets: decryptedPersonalAssets.map((asset) => ({
          name: asset.name,
          category: asset.category,
          currentValue: asset.currentValue,
          currency: asset.currency,
          currentValuedAt: asset.currentValuedAt,
          purchaseDate: asset.purchaseDate,
          purchasePrice: asset.purchasePrice,
          purchaseCurrency: asset.purchaseCurrency,
          notes: asset.notes,
          disposedAt: asset.disposedAt,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
          valuations: asset.valuations.map((valuation) => ({
            value: valuation.value,
            currency: valuation.currency,
            valuedAt: valuation.valuedAt,
            createdAt: valuation.createdAt,
          })),
        })),
        subscriptions: await Promise.all(
          decryptedSubscriptions.map(async (subscription) => ({
            name: subscription.name,
            provider: subscription.provider,
            description: subscription.description,
            amount: subscription.amount,
            currency: subscription.currency,
            billingCycle: subscription.billingCycle,
            nextBillingDate: subscription.nextBillingDate,
            startDate: subscription.startDate,
            trialEndDate: subscription.trialEndDate,
            cancellationDate: subscription.cancellationDate,
            status: subscription.status,
            cancellationUrl: subscription.cancellationUrl,
            notes: subscription.notes,
            categoryName: subscription.category?.name || null,
            accountName: subscription.account
              ? await decryptAccountName(session.user.id, subscription.account.nameEncrypted)
              : null,
            recurringRuleName: subscription.recurringRule
              ? await decryptRequiredCompanion(
                  session.user.id,
                  "recurringRule.name",
                  subscription.recurringRule.nameEncrypted,
                  subscription.recurringRule.name
                )
              : null,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt,
          }))
        ),
        depositoAccounts: await Promise.all(
          depositoAccounts.map(async (deposito) => ({
            accountName: await decryptAccountName(
              session.user.id,
              deposito.account.nameEncrypted
            ),
            startDate: deposito.startDate,
            principalAmount: deposito.principalAmount,
            interestFrequency: deposito.interestFrequency,
            interestRate: deposito.interestRate,
            taxRate: deposito.taxRate,
            termMode: deposito.termMode,
            maturityDate: deposito.maturityDate,
            nextInterestDate: deposito.nextInterestDate,
            status: deposito.status,
            closedAt: deposito.closedAt,
            interestPostings: deposito.interestPostings.map((posting) => ({
              postingDate: posting.postingDate,
              grossInterest: posting.grossInterest,
              taxAmount: posting.taxAmount,
              netInterest: posting.netInterest,
              balanceBefore: posting.balanceBefore,
              balanceAfter: posting.balanceAfter,
              transactionDate: posting.transaction.date,
              createdAt: posting.createdAt,
            })),
            createdAt: deposito.createdAt,
            updatedAt: deposito.updatedAt,
          }))
        ),
        debtPlans: await Promise.all(
          debtPlans.map(async (plan) => ({
            name: plan.name,
            strategy: plan.strategy,
            extraMonthlyAmount: plan.extraMonthlyAmount,
            currency: plan.currency,
            isActive: plan.isActive,
            items: await Promise.all(
              plan.items.map(async (item) => ({
                accountName: await decryptAccountName(
                  session.user.id,
                  item.account.nameEncrypted
                ),
                annualInterestRate: item.annualInterestRate,
                minimumPayment: item.minimumPayment,
                priorityOverride: item.priorityOverride,
                paymentDayOfMonth: item.paymentDayOfMonth,
              }))
            ),
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt,
          }))
        ),
        liabilityPaymentAudits: liabilityPaymentAudits.map((audit) => ({
          transactionDate: audit.transaction.date,
          sourceAccountName:
            decryptedAccountMap.get(audit.sourceAccountId) ?? "Unknown account",
          sourceBalanceBefore: audit.sourceBalanceBefore,
          sourceBalanceAfter: audit.sourceBalanceAfter,
          targetAccountName:
            decryptedAccountMap.get(audit.targetAccountId) ?? "Unknown account",
          targetBalanceBefore: audit.targetBalanceBefore,
          targetBalanceAfter: audit.targetBalanceAfter,
          paymentAmount: audit.paymentAmount,
          currency: audit.currency,
          exchangeRate: audit.exchangeRate,
          executedAt: audit.executedAt,
          isRolledBack: audit.isRolledBack,
          rolledBackAt: audit.rolledBackAt,
          rollbackReason: audit.rollbackReason,
        })),
        netWorthSnapshots: netWorthSnapshots.map((snapshot) => ({
          periodYear: snapshot.periodYear,
          periodMonth: snapshot.periodMonth,
          snapshotDate: snapshot.snapshotDate,
          currency: snapshot.currency,
          totalAssets: snapshot.totalAssets,
          totalLiabilities: snapshot.totalLiabilities,
          netWorth: snapshot.netWorth,
          cashTotal: snapshot.cashTotal,
          bankTotal: snapshot.bankTotal,
          investmentCashTotal: snapshot.investmentCashTotal,
          investmentHoldingTotal: snapshot.investmentHoldingTotal,
          investmentTotal: snapshot.investmentTotal,
          personalAssetTotal: snapshot.personalAssetTotal,
          receivableTotal: snapshot.receivableTotal,
          loanLiabilityTotal: snapshot.loanLiabilityTotal,
          creditCardTotal: snapshot.creditCardTotal,
          liabilityOverpayTotal: snapshot.liabilityOverpayTotal,
          sourceBreakdownJson: snapshot.sourceBreakdownJson,
          exchangeRateJson: snapshot.exchangeRateJson,
          calculationVersion: snapshot.calculationVersion,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt,
        })),
      },
    };

    return {
      success: true,
      data: JSON.stringify(backup, null, 2),
      filename: `finhealth-financial-archive-${format(new Date(), "yyyy-MM-dd-HHmmss")}.json`,
      summary: {
        accounts: accounts.length,
        transactions: transactions.length,
        transactionSplits: transactions.reduce(
          (count, transaction) => count + transaction.splits.length,
          0
        ),
        categories: categories.length,
        budgets: budgets.length,
        investmentAssets: investmentAssets.length,
        tradeHistory: tradeHistory.length,
        recurringRules: recurringRules.length,
        savingsGoals: savingsGoals.length,
        personalAssets: personalAssets.length,
        personalAssetValuations: personalAssets.reduce(
          (count, asset) => count + asset.valuations.length,
          0
        ),
        subscriptions: subscriptions.length,
        depositoAccounts: depositoAccounts.length,
        depositoInterestPostings: depositoAccounts.reduce(
          (count, deposito) => count + deposito.interestPostings.length,
          0
        ),
        debtPlans: debtPlans.length,
        debtPlanItems: debtPlans.reduce(
          (count, plan) => count + plan.items.length,
          0
        ),
        liabilityPaymentAudits: liabilityPaymentAudits.length,
        netWorthSnapshots: netWorthSnapshots.length,
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
    const decryptedAccounts = await decryptAccountRecords(session.user.id, accounts);

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
    const rows = decryptedAccounts.map((a) => [
      a.name,
      a.type,
      a.currency,
      a.balance.toString(),
      a.description ?? "",
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
      count: decryptedAccounts.length,
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
        categories: {
          include: {
            category: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // CSV Headers
    const headers = [
      "Name",
      "Amount",
      "Period",
      "Scope",
      "Categories",
      "Start Date",
      "End Date",
      "Is Active",
    ];

    // CSV Rows
    const decryptedBudgets = await decryptBudgetRecords(session.user.id, budgets);
    const rows = decryptedBudgets.map((b) => [
      b.name,
      b.amount.toString(),
      b.period,
      b.scope,
      b.categories.map((entry) => entry.category.name).join("|"),
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
      where: { userId: session.user.id },
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
        account: { select: { nameEncrypted: true } },
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
      "Unit Type",
      "Account",
      "Created At",
    ];

    // CSV Rows
    const rows = await Promise.all(
      investments.map(async (i) => [
        i.symbol,
        i.name || "",
        i.quantity.toString(),
        i.avgBuyPrice.toString(),
        i.currency,
        i.unitType,
        i.account
          ? await decryptAccountName(session.user.id, i.account.nameEncrypted)
          : "",
        format(new Date(i.createdAt), "yyyy-MM-dd"),
      ])
    );

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
 * Export the user's personal asset inventory as a CSV snapshot.
 */
export async function exportPersonalAssetsCSV() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const assets = await prisma.personalAsset.findMany({
      where: { userId: session.user.id },
      orderBy: [{ disposedAt: "asc" }, { createdAt: "asc" }],
    });
    const decryptedAssets = await Promise.all(
      assets.map((asset) => decryptPersonalAssetFields(session.user.id, asset))
    );

    const headers = [
      "Name",
      "Category",
      "Current Value",
      "Currency",
      "Valued At",
      "Purchase Date",
      "Purchase Price",
      "Purchase Currency",
      "Notes",
      "Status",
      "Disposed At",
      "Created At",
    ];

    const rows = decryptedAssets.map((asset) => [
      asset.name,
      asset.category,
      asset.currentValue.toString(),
      asset.currency,
      format(new Date(asset.currentValuedAt), "yyyy-MM-dd"),
      asset.purchaseDate ? format(new Date(asset.purchaseDate), "yyyy-MM-dd") : "",
      asset.purchasePrice?.toString() ?? "",
      asset.purchaseCurrency ?? "",
      asset.notes ?? "",
      asset.disposedAt ? "Archived" : "Active",
      asset.disposedAt ? format(new Date(asset.disposedAt), "yyyy-MM-dd") : "",
      format(new Date(asset.createdAt), "yyyy-MM-dd"),
    ]);

    const csv = [
      headers.map((header) => sanitizeCsvCell(header)).join(","),
      ...rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(",")),
    ].join("\n");

    return {
      success: true,
      data: csv,
      filename: `personal-assets-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`,
      count: assets.length,
    };
  } catch (error) {
    console.error("Export personal assets error:", error);
    return { success: false, error: "Failed to export personal assets" };
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

    const [rules, accounts, categories] = await Promise.all([
      prisma.recurringRule.findMany({
        where: { userId: session.user.id },
        orderBy: { nextDueDate: "asc" },
      }),
      prisma.financialAccount.findMany({
        where: { userId: session.user.id },
        select: { id: true, nameEncrypted: true },
      }),
      prisma.category.findMany({
        where: { userId: session.user.id },
        select: { id: true, name: true },
      }),
    ]);
    const accountNameMap = new Map(
      await Promise.all(
        accounts.map(async (account) => [
          account.id,
          await decryptAccountName(session.user.id, account.nameEncrypted),
        ] as const)
      )
    );
    const categoryNameMap = new Map(
      categories.map((category) => [category.id, category.name])
    );

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
      "Account",
      "Category",
      "Is Active",
    ];

    // CSV Rows
    const decryptedRules = await Promise.all(
      rules.map(async (rule) => ({
        ...rule,
        name: await decryptRequiredCompanion(
          session.user.id,
          "recurringRule.name",
          rule.nameEncrypted,
          rule.name
        ),
        description: await decryptOptionalCompanion(
          session.user.id,
          "recurringRule.description",
          rule.descriptionEncrypted,
          rule.description
        ),
      }))
    );
    const rows = decryptedRules.map((rule) => [
        rule.name,
        rule.amount.toString(),
        rule.currency,
        rule.type,
        rule.interval,
        format(new Date(rule.nextDueDate), "yyyy-MM-dd"),
        rule.endDate ? format(new Date(rule.endDate), "yyyy-MM-dd") : "",
        rule.description || "",
        rule.accountId ? accountNameMap.get(rule.accountId) ?? "" : "",
        rule.categoryId ? categoryNameMap.get(rule.categoryId) ?? "" : "",
        rule.isActive ? "Yes" : "No",
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
