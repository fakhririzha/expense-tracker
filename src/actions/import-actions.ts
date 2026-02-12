"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Column mapping types
export type ColumnMapping = {
  date?: string;
  amount?: string;
  type?: string;
  category?: string;
  account?: string;
  description?: string;
  currency?: string;
};

// Parsed transaction from CSV
export type ParsedTransaction = {
  date: string;
  amount: number;
  type: string;
  category?: string;
  account: string;
  description?: string;
  currency?: string;
  isValid: boolean;
  errors: string[];
  rowNumber: number;
};

// Import result type
export type ImportResult = {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
};

// Validation schema for transaction import
const transactionImportSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.number().positive("Amount must be positive"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  category: z.string().optional(),
  account: z.string().min(1, "Account is required"),
  description: z.string().optional(),
  currency: z.string().default("IDR"),
});

/**
 * Parse CSV content and return structured data
 */
export async function parseCSVContent(csvContent: string) {
  try {
    // Dynamic import for PapaParse (client-side library)
    const Papa = await import("papaparse");

    return new Promise<{
      success: boolean;
      data: Record<string, string>[];
      headers: string[];
      error?: string;
    }>((resolve) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
        complete: (results) => {
          if (results.errors.length > 0) {
            resolve({
              success: false,
              data: [],
              headers: [],
              error: results.errors[0].message,
            });
            return;
          }

          const headers =
            results.meta.fields?.map((h) => h.toLowerCase()) || [];
          resolve({
            success: true,
            data: results.data as Record<string, string>[],
            headers,
          });
        },
        error: (error) => {
          resolve({
            success: false,
            data: [],
            headers: [],
            error: error.message,
          });
        },
      });
    });
  } catch (error) {
    console.error("Parse CSV error:", error);
    return {
      success: false,
      data: [],
      headers: [],
      error: "Failed to parse CSV content",
    };
  }
}

/**
 * Auto-detect column mapping from headers
 */
export async function detectColumnMapping(headers: string[]): Promise<ColumnMapping> {
  const mapping: ColumnMapping = {};

  const datePatterns = ["date", "transaction_date", "trans_date", "tx_date"];
  const amountPatterns = ["amount", "value", "sum", "total"];
  const typePatterns = ["type", "transaction_type", "trans_type", "tx_type"];
  const categoryPatterns = ["category", "cat", "category_name"];
  const accountPatterns = ["account", "account_name", "from_account", "source"];
  const descriptionPatterns = ["description", "desc", "memo", "note", "notes"];
  const currencyPatterns = ["currency", "curr", "ccy"];

  for (const header of headers) {
    const h = header.toLowerCase();

    if (!mapping.date && datePatterns.some((p) => h.includes(p))) {
      mapping.date = header;
    } else if (!mapping.amount && amountPatterns.some((p) => h.includes(p))) {
      mapping.amount = header;
    } else if (!mapping.type && typePatterns.some((p) => h.includes(p))) {
      mapping.type = header;
    } else if (!mapping.category && categoryPatterns.some((p) => h.includes(p))) {
      mapping.category = header;
    } else if (!mapping.account && accountPatterns.some((p) => h.includes(p))) {
      mapping.account = header;
    } else if (
      !mapping.description &&
      descriptionPatterns.some((p) => h.includes(p))
    ) {
      mapping.description = header;
    } else if (
      !mapping.currency &&
      currencyPatterns.some((p) => h.includes(p))
    ) {
      mapping.currency = header;
    }
  }

  return mapping;
}

/**
 * Map parsed CSV data to transactions with validation
 */
export async function mapToTransactions(
  data: Record<string, string>[],
  mapping: ColumnMapping
): Promise<ParsedTransaction[]> {
  const transactions: ParsedTransaction[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const errors: string[] = [];

    // Extract values using mapping
    const dateValue = mapping.date ? row[mapping.date] : "";
    const amountValue = mapping.amount ? row[mapping.amount] : "";
    const typeValue = mapping.type ? row[mapping.type]?.toUpperCase() : "";
    const categoryValue = mapping.category ? row[mapping.category] : undefined;
    const accountValue = mapping.account ? row[mapping.account] : "";
    const descriptionValue = mapping.description
      ? row[mapping.description]
      : undefined;
    const currencyValue = mapping.currency ? row[mapping.currency] : "IDR";

    // Validate required fields
    if (!dateValue) errors.push("Date is required");
    if (!amountValue) errors.push("Amount is required");
    if (!typeValue) errors.push("Type is required");
    if (!accountValue) errors.push("Account is required");

    // Parse and validate amount
    let amount = 0;
    if (amountValue) {
      const parsed = parseFloat(amountValue.replace(/[^0-9.-]/g, ""));
      if (isNaN(parsed) || parsed <= 0) {
        errors.push("Amount must be a positive number");
      } else {
        amount = parsed;
      }
    }

    // Validate type
    if (typeValue && !["INCOME", "EXPENSE", "TRANSFER"].includes(typeValue)) {
      errors.push("Type must be INCOME, EXPENSE, or TRANSFER");
    }

    // Validate date format
    if (dateValue) {
      const parsedDate = new Date(dateValue);
      if (isNaN(parsedDate.getTime())) {
        errors.push("Invalid date format");
      }
    }

    transactions.push({
      date: dateValue,
      amount,
      type: typeValue,
      category: categoryValue,
      account: accountValue,
      description: descriptionValue,
      currency: currencyValue || "IDR",
      isValid: errors.length === 0,
      errors,
      rowNumber: i + 2, // +2 for 1-based index and header row
    });
  }

  return transactions;
}

/**
 * Preview import without actually importing
 */
export async function previewImport(
  csvContent: string,
  mapping: ColumnMapping
): Promise<{
  success: boolean;
  transactions: ParsedTransaction[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  error?: string;
}> {
  try {
    const parseResult = await parseCSVContent(csvContent);

    if (!parseResult.success) {
      return {
        success: false,
        transactions: [],
        summary: { total: 0, valid: 0, invalid: 0 },
        error: parseResult.error,
      };
    }

    const transactions = await mapToTransactions(parseResult.data, mapping);

    const valid = transactions.filter((t) => t.isValid).length;
    const invalid = transactions.length - valid;

    return {
      success: true,
      transactions,
      summary: {
        total: transactions.length,
        valid,
        invalid,
      },
    };
  } catch (error) {
    console.error("Preview import error:", error);
    return {
      success: false,
      transactions: [],
      summary: { total: 0, valid: 0, invalid: 0 },
      error: "Failed to preview import",
    };
  }
}

/**
 * Import transactions from parsed data
 */
export async function importTransactions(
  transactions: ParsedTransaction[],
  options?: {
    createMissingCategories?: boolean;
    createMissingAccounts?: boolean;
  }
): Promise<ImportResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, error: "Unauthorized" }],
      };
    }

    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
    };

    // Get existing accounts and categories for the user
    const [existingAccounts, existingCategories] = await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId: session.user.id },
        select: { id: true, name: true, currency: true },
      }),
      prisma.category.findMany({
        where: {
          OR: [{ userId: session.user.id }, { isSystem: true }],
        },
        select: { id: true, name: true, type: true },
      }),
    ]);

    // Create lookup maps
    const accountMap = new Map(
      existingAccounts.map((a) => [a.name.toLowerCase(), a])
    );
    const categoryMap = new Map(
      existingCategories.map((c) => [c.name.toLowerCase(), c])
    );

    // Process each transaction
    for (const tx of transactions) {
      if (!tx.isValid) {
        result.failed++;
        result.errors.push({
          row: tx.rowNumber,
          error: tx.errors.join(", "),
        });
        continue;
      }

      try {
        // Find or create account
        let account = accountMap.get(tx.account.toLowerCase());

        if (!account && options?.createMissingAccounts) {
          // Create new account
          account = await prisma.financialAccount.create({
            data: {
              name: tx.account,
              type: "BANK", // Default type
              currency: tx.currency || "IDR",
              balance: 0,
              userId: session.user.id,
            },
          });
          accountMap.set(tx.account.toLowerCase(), account);
        } else if (!account) {
          result.failed++;
          result.errors.push({
            row: tx.rowNumber,
            error: `Account "${tx.account}" not found`,
          });
          continue;
        }

        // Find or create category
        let category = tx.category
          ? categoryMap.get(tx.category.toLowerCase())
          : null;

        if (!category && tx.category && options?.createMissingCategories) {
          // Create new category
          category = await prisma.category.create({
            data: {
              name: tx.category,
              type: tx.type as "INCOME" | "EXPENSE" | "TRANSFER",
              userId: session.user.id,
            },
          });
          categoryMap.set(tx.category.toLowerCase(), category);
        }

        // Parse date
        const parsedDate = new Date(tx.date);

        // Calculate balance change
        const balanceChange = tx.type === "INCOME" ? tx.amount : -tx.amount;

        // Create transaction and update account balance atomically
        await prisma.$transaction(async (txClient: Prisma.TransactionClient) => {
          // Create transaction
          await txClient.transaction.create({
            data: {
              amount: tx.amount,
              currency: tx.currency || account!.currency,
              exchangeRate: 1,
              type: tx.type as "INCOME" | "EXPENSE" | "TRANSFER",
              description: tx.description,
              date: parsedDate,
              accountId: account!.id,
              categoryId: category?.id || null,
              userId: session.user.id,
            },
          });

          // Update account balance
          await txClient.financialAccount.update({
            where: { id: account!.id },
            data: { balance: { increment: balanceChange } },
          });
        });

        result.imported++;
      } catch (error) {
        console.error(`Error importing row ${tx.rowNumber}:`, error);
        result.failed++;
        result.errors.push({
          row: tx.rowNumber,
          error: "Failed to import transaction",
        });
      }
    }

    // Revalidate paths
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/accounts");

    result.success = result.imported > 0;
    return result;
  } catch (error) {
    console.error("Import transactions error:", error);
    return {
      success: false,
      imported: 0,
      failed: transactions.length,
      errors: [{ row: 0, error: "Failed to import transactions" }],
    };
  }
}

/**
 * Import accounts from CSV
 */
export async function importAccounts(
  accounts: Array<{
    name: string;
    type: string;
    currency?: string;
    balance?: number;
    description?: string;
  }>
): Promise<ImportResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, error: "Unauthorized" }],
      };
    }

    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
    };

    const validTypes = ["BANK", "CASH", "INVESTMENT", "LOAN", "CREDIT_CARD"];

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const rowNumber = i + 2;

      // Validate
      if (!acc.name) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: "Name is required" });
        continue;
      }

      if (!validTypes.includes(acc.type?.toUpperCase())) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: "Invalid account type",
        });
        continue;
      }

      try {
        // Check if account with same name exists
        const existing = await prisma.financialAccount.findFirst({
          where: {
            userId: session.user.id,
            name: acc.name,
          },
        });

        if (existing) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            error: `Account "${acc.name}" already exists`,
          });
          continue;
        }

        await prisma.financialAccount.create({
          data: {
            name: acc.name,
            type: acc.type.toUpperCase() as
              | "BANK"
              | "CASH"
              | "INVESTMENT"
              | "LOAN"
              | "CREDIT_CARD",
            currency: acc.currency || "IDR",
            balance: acc.balance || 0,
            description: acc.description,
            userId: session.user.id,
          },
        });

        result.imported++;
      } catch (error) {
        console.error(`Error importing account row ${rowNumber}:`, error);
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: "Failed to create account",
        });
      }
    }

    revalidatePath("/dashboard/accounts");
    result.success = result.imported > 0;
    return result;
  } catch (error) {
    console.error("Import accounts error:", error);
    return {
      success: false,
      imported: 0,
      failed: accounts.length,
      errors: [{ row: 0, error: "Failed to import accounts" }],
    };
  }
}

/**
 * Import budgets from CSV
 */
export async function importBudgets(
  budgets: Array<{
    name: string;
    amount: number;
    period: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  }>
): Promise<ImportResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, error: "Unauthorized" }],
      };
    }

    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
    };

    const validPeriods = ["MONTHLY", "QUARTERLY", "YEARLY"];

    // Get categories for lookup
    const categories = await prisma.category.findMany({
      where: {
        OR: [{ userId: session.user.id }, { isSystem: true }],
      },
      select: { id: true, name: true },
    });

    const categoryMap = new Map(
      categories.map((c) => [c.name.toLowerCase(), c])
    );

    for (let i = 0; i < budgets.length; i++) {
      const budget = budgets[i];
      const rowNumber = i + 2;

      // Validate
      if (!budget.name) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: "Name is required" });
        continue;
      }

      if (!budget.amount || budget.amount <= 0) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: "Amount must be positive",
        });
        continue;
      }

      if (!validPeriods.includes(budget.period?.toUpperCase())) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: "Period must be MONTHLY, QUARTERLY, or YEARLY",
        });
        continue;
      }

      try {
        // Find category if specified
        let categoryId: string | null = null;
        if (budget.category) {
          const category = categoryMap.get(budget.category.toLowerCase());
          if (category) {
            categoryId = category.id;
          }
        }

        await prisma.budget.create({
          data: {
            name: budget.name,
            amount: budget.amount,
            period: budget.period.toUpperCase() as "MONTHLY" | "QUARTERLY" | "YEARLY",
            startDate: budget.startDate ? new Date(budget.startDate) : new Date(),
            endDate: budget.endDate ? new Date(budget.endDate) : null,
            categoryId,
            userId: session.user.id,
          },
        });

        result.imported++;
      } catch (error) {
        console.error(`Error importing budget row ${rowNumber}:`, error);
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: "Failed to create budget",
        });
      }
    }

    revalidatePath("/dashboard/budgets");
    result.success = result.imported > 0;
    return result;
  } catch (error) {
    console.error("Import budgets error:", error);
    return {
      success: false,
      imported: 0,
      failed: budgets.length,
      errors: [{ row: 0, error: "Failed to import budgets" }],
    };
  }
}

/**
 * Get template CSV for download
 */
export async function getImportTemplate(type: "transactions" | "accounts" | "budgets") {
  const templates = {
    transactions: `Date,Amount,Type,Category,Account,Description,Currency
2024-01-15,50000,INCOME,Salary,Bank Account,Monthly salary,IDR
2024-01-16,25000,EXPENSE,Food,Cash,Groceries,IDR
2024-01-17,10000,EXPENSE,Transport,Bank Account,Taxi fare,IDR`,
    accounts: `Name,Type,Currency,Balance,Description
Bank Account,BANK,IDR,1000000,Main bank account
Cash,CASH,IDR,500000,Pocket money
Credit Card,CREDIT_CARD,IDR,-200000,Credit card debt`,
    budgets: `Name,Amount,Period,Category,Start Date,End Date
Food Budget,2000000,MONTHLY,Food,2024-01-01,
Transport,500000,MONTHLY,Transport,2024-01-01,
Savings,1000000,MONTHLY,,2024-01-01,`,
  };

  return templates[type];
}
