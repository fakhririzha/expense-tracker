"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import {
  decryptAccountRecords,
  encryptAccountName,
} from "@/lib/account-crypto";
import { createTransaction } from "@/actions/transaction-actions";

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

type AccountLookupItem = {
  id: string;
  name: string;
  currency: string;
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
    const typeValue = mapping.type ? row[mapping.type]?.trim().toUpperCase() : "";
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
 * Parse and persist CSV transactions, creating related entities as allowed.
 *
 * Re-parses the uploaded CSV on the server so client preview state is never trusted. Invalid rows are reported as
 * failures; valid rows use the standard transaction action for validation, encryption, and balance updates.
 *
 * @param csvContent - Raw CSV content originally selected by the user.
 * @param mapping - Mapping from CSV headers to supported transaction fields.
 * @param options.createMissingCategories - When true, missing categories referenced by transactions will be created for the user.
 * @param options.createMissingAccounts - When true, missing accounts referenced by transactions will be created for the user.
 * @returns An ImportResult summarizing the operation: `success` is `true` if one or more transactions were imported, `imported` is the count of successfully persisted rows, `failed` is the count of rows that failed to import, and `errors` lists per-row error details.
 */
export async function importTransactions(
  csvContent: string,
  mapping: ColumnMapping,
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

    const preview = await previewImport(csvContent, mapping);
    if (!preview.success) {
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, error: preview.error || "Failed to parse CSV" }],
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
        select: {
          id: true,
          nameEncrypted: true,
          descriptionEncrypted: true,
          currency: true,
        },
      }),
      prisma.category.findMany({
        where: { userId: session.user.id },
        select: { id: true, name: true, type: true },
      }),
    ]);

    // Create lookup maps
    const decryptedAccounts = await decryptAccountRecords(
      session.user.id,
      existingAccounts
    );
    const accountMap = new Map<string, AccountLookupItem>(
      decryptedAccounts.map((a) => [a.name.toLowerCase(), a])
    );
    const categoryMap = new Map(
      existingCategories.map((category) => [
        `${category.type}:${category.name.toLowerCase()}`,
        category,
      ])
    );

    // Process each transaction
    for (const tx of preview.transactions) {
      if (!tx.isValid) {
        result.failed++;
        result.errors.push({
          row: tx.rowNumber,
          error: tx.errors.join(", "),
        });
        continue;
      }

      try {
        const accountName = tx.account.trim();
        // Find or create source account
        let account: AccountLookupItem | undefined = accountMap.get(
          accountName.toLowerCase()
        );

        if (!account && options?.createMissingAccounts) {
          // Create new account
          const createdAccount = await prisma.financialAccount.create({
            data: {
              nameEncrypted: await encryptAccountName(session.user.id, accountName),
              type: "BANK", // Default type
              currency: tx.currency || "IDR",
              balance: 0,
              userId: session.user.id,
            },
          });
          account = {
            id: createdAccount.id,
            name: accountName,
            currency: createdAccount.currency,
          };
          accountMap.set(accountName.toLowerCase(), account);
        } else if (!account) {
          result.failed++;
          result.errors.push({
            row: tx.rowNumber,
            error: `Account "${accountName}" not found`,
          });
          continue;
        }
        if (!account) {
          continue;
        }

        // For TRANSFER type, find or create destination account
        let toAccount: AccountLookupItem | null = null;
        if (tx.type === "TRANSFER" && tx.toAccount) {
          const toAccountName = tx.toAccount.trim();
          toAccount = accountMap.get(toAccountName.toLowerCase()) ?? null;

          if (!toAccount && options?.createMissingAccounts) {
            // Create new destination account
            const createdToAccount = await prisma.financialAccount.create({
              data: {
                nameEncrypted: await encryptAccountName(session.user.id, toAccountName),
                type: "BANK", // Default type
                currency: tx.currency || "IDR",
                balance: 0,
                userId: session.user.id,
              },
            });
            toAccount = {
              id: createdToAccount.id,
              name: toAccountName,
              currency: createdToAccount.currency,
            };
            accountMap.set(toAccountName.toLowerCase(), toAccount);
          } else if (!toAccount) {
            result.failed++;
            result.errors.push({
              row: tx.rowNumber,
              error: `Destination account "${toAccountName}" not found`,
            });
            continue;
          }
          if (!toAccount) {
            continue;
          }
        }

        let categoryId: string | undefined;
        if (tx.category) {
          if (tx.type === "TRANSFER") {
            result.failed++;
            result.errors.push({
              row: tx.rowNumber,
              error: "Transfers cannot include a category",
            });
            continue;
          }

          const categoryName = tx.category.trim();
          const categoryKey = `${tx.type}:${categoryName.toLowerCase()}`;
          let category = categoryMap.get(categoryKey);

          if (!category && options?.createMissingCategories) {
            category = await prisma.category.create({
              data: {
                name: categoryName,
                type: tx.type as "INCOME" | "EXPENSE",
                userId: session.user.id,
              },
            });
            categoryMap.set(categoryKey, category);
          }

          if (!category) {
            result.failed++;
            result.errors.push({
              row: tx.rowNumber,
              error: `Category "${categoryName}" not found`,
            });
            continue;
          }

          categoryId = category.id;
        }

        const transactionResult = await createTransaction({
          amount: tx.amount,
          currency: tx.currency || account.currency,
          exchangeRate: 1,
          type: tx.type as "INCOME" | "EXPENSE" | "TRANSFER",
          description: tx.description,
          location: tx.location,
          latitude: parseOptionalNumber(tx.latitude),
          longitude: parseOptionalNumber(tx.longitude),
          googleMapsLink: tx.googleMapsLink,
          date: new Date(tx.date),
          accountId: account.id,
          toAccountId: tx.type === "TRANSFER" ? toAccount?.id : undefined,
          categoryId,
          isRecurring: false,
        });

        if (!transactionResult.success) {
          result.failed++;
          result.errors.push({
            row: tx.rowNumber,
            error: transactionResult.error || "Failed to import transaction",
          });
          continue;
        }

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

    result.success = result.imported > 0;
    return result;
  } catch (error) {
    console.error("Import transactions error:", error);
    return {
      success: false,
      imported: 0,
      failed: 0,
      errors: [{ row: 0, error: "Failed to import transactions" }],
    };
  }
}

/**
 * Return the transaction CSV template used by the importer.
 */
export async function getImportTemplate() {
  return `Date,Amount,Type,Category,Account,To Account,Description,Location,Latitude,Longitude,Google Maps Link,Currency
2024-01-15,50000,INCOME,Salary,Bank Account,,Monthly salary,Office,-6.200000,106.816666,https://www.google.com/maps/search/?api=1&query=-6.200000%2C106.816666,IDR
2024-01-16,25000,EXPENSE,Food,Cash,,Groceries,Restaurant,,,,IDR
2024-01-17,10000,EXPENSE,Transport,Bank Account,,Taxi fare,Train station,-6.175110,106.865036,https://www.google.com/maps/search/?api=1&query=-6.175110%2C106.865036,IDR
2024-01-18,30000,TRANSFER,,Bank Account,Savings,Transfer to savings,,,,,IDR`;
}
