"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma/client/client";
import { revalidatePath } from "next/cache";
import {
  ACCOUNT_TYPES,
  type AccountTypeValue,
  normalizeAccountBalanceForType,
} from "@/lib/account-types";

// Column mapping types
export type ColumnMapping = {
  date?: string;
  amount?: string;
  type?: string;
  category?: string;
  account?: string;
  toAccount?: string;
  description?: string;
  location?: string;
  latitude?: string;
  longitude?: string;
  googleMapsLink?: string;
  currency?: string;
};

// Parsed transaction from CSV
export type ParsedTransaction = {
  date: string;
  amount: number;
  type: string;
  category?: string;
  account: string;
  toAccount?: string;
  description?: string;
  location?: string;
  latitude?: string;
  longitude?: string;
  googleMapsLink?: string;
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

/**
 * Prevent CSV/Excel formula injection by prefixing values that start with `=`, `+`, `-`, or `@` with a zero-width space.
 *
 * @param value - The cell content to sanitize; may be `null` or `undefined`.
 * @returns The sanitized string, or `undefined` if `value` is `null`, `undefined`, or an empty string.
 */
function sanitizeCsvCell(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  // Prefix with zero-width space to prevent formula injection
  if (/^[=+\-@]/.test(value)) {
    return '\u200B' + value;
  }
  return value;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Parse CSV content into row objects and a normalized list of header names.
 *
 * @returns An object containing:
 *  - `success`: `true` if parsing succeeded, `false` otherwise.
 *  - `data`: An array of row objects (each key is a header name and each value is a string).
 *  - `headers`: An array of header names converted to lowercase.
 *  - `error`: An optional error message present when `success` is `false`.
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
        error: (error: { message: string }) => {
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
 * Detects CSV headers that correspond to known import fields.
 *
 * Matches provided header names against common patterns for date, amount, type,
 * category, account, destination account (toAccount), description, location,
 * coordinates, maps link, and currency, and selects the first matching header for each field.
 *
 * @param headers - The list of CSV header names to analyze
 * @returns A ColumnMapping where each key is assigned the first matching header name, or remains undefined if no match was found
 */
export async function detectColumnMapping(headers: string[]): Promise<ColumnMapping> {
  const mapping: ColumnMapping = {};

  const datePatterns = ["date", "transaction_date", "trans_date", "tx_date"];
  const amountPatterns = ["amount", "value", "sum", "total"];
  const typePatterns = ["type", "transaction_type", "trans_type", "tx_type"];
  const categoryPatterns = ["category", "cat", "category_name"];
  const accountPatterns = ["account", "account_name", "from_account", "source"];
  const toAccountPatterns = ["to_account", "to account", "destination", "dest_account", "target_account"];
  const descriptionPatterns = ["description", "desc", "memo", "note", "notes"];
  const locationPatterns = ["location", "place", "address", "venue"];
  const latitudePatterns = ["latitude", "lat"];
  const longitudePatterns = ["longitude", "lng", "lon"];
  const mapsLinkPatterns = ["google maps link", "google_maps_link", "maps link", "maps url", "google maps url"];
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
    } else if (!mapping.toAccount && toAccountPatterns.some((p) => h.includes(p))) {
      mapping.toAccount = header;
    } else if (
      !mapping.description &&
      descriptionPatterns.some((p) => h.includes(p))
    ) {
      mapping.description = header;
    } else if (!mapping.location && locationPatterns.some((p) => h.includes(p))) {
      mapping.location = header;
    } else if (!mapping.latitude && latitudePatterns.some((p) => h.includes(p))) {
      mapping.latitude = header;
    } else if (!mapping.longitude && longitudePatterns.some((p) => h.includes(p))) {
      mapping.longitude = header;
    } else if (
      !mapping.googleMapsLink &&
      mapsLinkPatterns.some((p) => h.includes(p))
    ) {
      mapping.googleMapsLink = header;
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
 * Convert parsed CSV rows into validated ParsedTransaction objects.
 *
 * Each returned entry contains extracted fields, a boolean `isValid`, a list of `errors`
 * discovered during validation, and `rowNumber` reflecting the original CSV row (1-based plus header).
 *
 * @param data - Array of CSV rows where each row is a mapping from header name to cell value
 * @param mapping - Mapping from logical transaction fields to CSV header names
 * @returns An array of ParsedTransaction objects with validation results and source row numbers
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
    // Sanitize text fields to prevent CSV/Excel formula injection
    const categoryValue = sanitizeCsvCell(mapping.category ? row[mapping.category] : undefined);
    const accountValue = sanitizeCsvCell(mapping.account ? row[mapping.account] : "") ?? "";
    const toAccountValue = sanitizeCsvCell(mapping.toAccount ? row[mapping.toAccount] : undefined);
    const descriptionValue = sanitizeCsvCell(mapping.description
      ? row[mapping.description]
      : undefined);
    const locationValue = sanitizeCsvCell(mapping.location ? row[mapping.location] : undefined);
    const latitudeValue = mapping.latitude ? row[mapping.latitude]?.trim() || undefined : undefined;
    const longitudeValue = mapping.longitude ? row[mapping.longitude]?.trim() || undefined : undefined;
    const googleMapsLinkValue = sanitizeCsvCell(
      mapping.googleMapsLink ? row[mapping.googleMapsLink] : undefined
    );
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

    // Validate TRANSFER type requires toAccount
    if (typeValue === "TRANSFER" && !toAccountValue) {
      errors.push("To Account is required for TRANSFER transactions");
    }

    // Validate TRANSFER source and destination are different
    if (typeValue === "TRANSFER" && toAccountValue && accountValue.toLowerCase() === toAccountValue.toLowerCase()) {
      errors.push("Source and destination accounts must be different for TRANSFER");
    }

    // Validate date format
    if (dateValue) {
      const parsedDate = new Date(dateValue);
      if (isNaN(parsedDate.getTime())) {
        errors.push("Invalid date format");
      }
    }

    if (latitudeValue && parseOptionalNumber(latitudeValue) === undefined) {
      errors.push("Latitude must be a valid number");
    }

    if (longitudeValue && parseOptionalNumber(longitudeValue) === undefined) {
      errors.push("Longitude must be a valid number");
    }

    transactions.push({
      date: dateValue,
      amount,
      type: typeValue,
      category: categoryValue,
      account: accountValue,
      toAccount: toAccountValue,
      description: descriptionValue,
      location: locationValue,
      latitude: latitudeValue,
      longitude: longitudeValue,
      googleMapsLink: googleMapsLinkValue,
      currency: currencyValue || "IDR",
      isValid: errors.length === 0,
      errors,
      rowNumber: i + 2, // +2 for 1-based index and header row
    });
  }

  return transactions;
}

/**
 * Produce a preview of parsing and mapping for a CSV import without persisting any data.
 *
 * @param csvContent - Raw CSV text to parse
 * @param mapping - Mapping from logical fields to CSV column names used to convert rows into transactions
 * @returns An object containing `success`, an array of mapped `transactions`, a `summary` with `total`, `valid`, and `invalid` counts, and an optional `error` message when parsing or mapping fails
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
 * Persist an array of parsed transactions to the database, creating related entities as allowed.
 *
 * Processes each ParsedTransaction: invalid rows are recorded as failures; valid rows are inserted as transactions,
 * accounts and categories are looked up or optionally created, and account balances are updated atomically.
 *
 * @param transactions - Array of parsed transaction rows (each with fields like date, amount, type, account, toAccount, category, description, currency, isValid, errors, rowNumber). Rows with `isValid === false` are recorded as failures and not persisted.
 * @param options.createMissingCategories - When true, missing categories referenced by transactions will be created for the user.
 * @param options.createMissingAccounts - When true, missing accounts referenced by transactions will be created for the user.
 * @returns An ImportResult summarizing the operation: `success` is `true` if one or more transactions were imported, `imported` is the count of successfully persisted rows, `failed` is the count of rows that failed to import, and `errors` lists per-row error details.
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
        where: { userId: session.user.id },
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
        // Find or create source account
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

        // For TRANSFER type, find or create destination account
        let toAccount = null;
        if (tx.type === "TRANSFER" && tx.toAccount) {
          toAccount = accountMap.get(tx.toAccount.toLowerCase());

          if (!toAccount && options?.createMissingAccounts) {
            // Create new destination account
            toAccount = await prisma.financialAccount.create({
              data: {
                name: tx.toAccount,
                type: "BANK", // Default type
                currency: tx.currency || "IDR",
                balance: 0,
                userId: session.user.id,
              },
            });
            accountMap.set(tx.toAccount.toLowerCase(), toAccount);
          } else if (!toAccount) {
            result.failed++;
            result.errors.push({
              row: tx.rowNumber,
              error: `Destination account "${tx.toAccount}" not found`,
            });
            continue;
          }
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

        // Create transaction and update account balance(s) atomically
        await prisma.$transaction(async (txClient: Prisma.TransactionClient) => {
          // Create transaction
        await txClient.transaction.create({
          data: {
            amount: tx.amount,
            currency: tx.currency || account!.currency,
            exchangeRate: 1,
            type: tx.type as "INCOME" | "EXPENSE" | "TRANSFER",
            description: tx.description,
            location: tx.location,
            latitude: parseOptionalNumber(tx.latitude) ?? null,
            longitude: parseOptionalNumber(tx.longitude) ?? null,
            googleMapsLink: tx.googleMapsLink,
            date: parsedDate,
            accountId: account!.id,
            toAccountId: tx.type === "TRANSFER" ? toAccount!.id : null,
            categoryId: category?.id || null,
            userId: session.user.id,
            },
          });

          if (tx.type === "TRANSFER") {
            // For transfers: decrement source account, increment destination account
            await txClient.financialAccount.update({
              where: { id: account!.id },
              data: { balance: { decrement: tx.amount } },
            });

            await txClient.financialAccount.update({
              where: { id: toAccount!.id },
              data: { balance: { increment: tx.amount } },
            });
          } else {
            // For income/expense: update single account balance
            const balanceChange = tx.type === "INCOME" ? tx.amount : -tx.amount;
            await txClient.financialAccount.update({
              where: { id: account!.id },
              data: { balance: { increment: balanceChange } },
            });
          }
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
 * Import multiple account records, validating each row and creating accounts for the authenticated user.
 *
 * Validates required `name` and allowed account `type`, skips rows with errors or duplicate names, creates new accounts with optional `currency`, `balance`, and `description`, and triggers dashboard accounts revalidation.
 *
 * @param accounts - Array of account objects to import. Each object should include:
 *   - `name`: account display name (required)
 *   - `type`: account type (required; one of the supported financial account types)
 *   - `currency`: optional ISO currency code (defaults to "IDR")
 *   - `balance`: optional starting balance (defaults to 0)
 *   - `description`: optional description text
 * @returns An ImportResult summarizing the operation: counts of imported and failed rows and per-row error details. `success` is `true` if at least one account was imported, `false` otherwise.
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

    const validTypes = ACCOUNT_TYPES as readonly string[];

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

        const accountType = acc.type.toUpperCase() as AccountTypeValue;

        await prisma.financialAccount.create({
          data: {
            name: acc.name,
            type: accountType,
            currency: acc.currency || "IDR",
            balance: normalizeAccountBalanceForType(accountType, acc.balance || 0),
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
 * Import multiple budgets and create corresponding budget records for the authenticated user.
 *
 * Each input row is validated and either created or reported as a failure. Validation rules:
 * - `name` is required.
 * - `amount` must be greater than zero.
 * - `period` must be one of `MONTHLY`, `QUARTERLY`, or `YEARLY` (case-insensitive).
 * If `category` is provided, the function attempts to link it to one of the current user's categories; if not found, the budget is created without a category. Row numbers in reported errors start at 2 (header = row 1).
 *
 * @param budgets - Array of budget records to import. Each item should contain:
 *   - `name`: display name of the budget
 *   - `amount`: positive numeric budget amount
 *   - `period`: budget period (`MONTHLY` | `QUARTERLY` | `YEARLY`)
 *   - `category` (optional): category name to link the budget to
 *   - `startDate` (optional): ISO date string for the budget start (defaults to now)
 *   - `endDate` (optional): ISO date string for the budget end
 * @returns The import result including counts (`imported`, `failed`), per-row `errors`, and `success` which is `true` if at least one budget was created.
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
      where: { userId: session.user.id },
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
 * Return a CSV template string for the requested import type.
 *
 * @param type - The import template type: "transactions", "accounts", or "budgets"
 * @returns A CSV-formatted template string matching the requested `type`
 */
export async function getImportTemplate(type: "transactions" | "accounts" | "budgets") {
  const templates = {
    transactions: `Date,Amount,Type,Category,Account,To Account,Description,Location,Latitude,Longitude,Google Maps Link,Currency
2024-01-15,50000,INCOME,Salary,Bank Account,,Monthly salary,Office,-6.200000,106.816666,https://www.google.com/maps/search/?api=1&query=-6.200000%2C106.816666,IDR
2024-01-16,25000,EXPENSE,Food,Cash,,Groceries,Restaurant,,,,IDR
2024-01-17,10000,EXPENSE,Transport,Bank Account,,Taxi fare,Train station,-6.175110,106.865036,https://www.google.com/maps/search/?api=1&query=-6.175110%2C106.865036,IDR
2024-01-18,30000,TRANSFER,,Bank Account,Savings,Transfer to savings,,,,,IDR`,
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
