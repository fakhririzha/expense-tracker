import Papa from "papaparse";
import { z } from "zod";

export const MAX_CSV_BYTES = 512 * 1024;
export const MAX_CSV_ROWS = 1000;
export const MAX_CSV_COLUMNS = 32;
export const MAX_CSV_HEADER_CHARS = 128;
export const MAX_CSV_CELL_CHARS = 2048;

const SUPPORTED_MAPPING_KEYS = [
  "date",
  "amount",
  "type",
  "category",
  "account",
  "toAccount",
  "description",
  "location",
  "latitude",
  "longitude",
  "googleMapsLink",
  "currency",
] as const;

const REQUIRED_MAPPING_KEYS = ["date", "amount", "type", "account"] as const;

export type ColumnMapping = {
  [Key in (typeof SUPPORTED_MAPPING_KEYS)[number]]?: string;
};

export interface ParsedTransaction {
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
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export interface ImportTransactionsInput {
  csvContent: string;
  mapping: ColumnMapping;
  options?: {
    createMissingCategories?: boolean;
    createMissingAccounts?: boolean;
  };
  confirmation?: {
    code: string;
  };
}

interface ParseCSVResult {
  success: boolean;
  data: Record<string, string>[];
  headers: string[];
  error?: string;
}

interface PreviewImportResult {
  success: boolean;
  transactions: ParsedTransaction[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  error?: string;
}

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function failure(error: string): ParseCSVResult {
  return { success: false, data: [], headers: [], error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeHeader(header: string, index: number): string {
  const withoutBom = index === 0 ? header.replace(/^\uFEFF/, "") : header;
  return withoutBom.trim().toLowerCase();
}

function sanitizeCsvCell(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^\u200B+/, "");
  if (!trimmed) return undefined;
  return trimmed;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseCSVContent(csvContent: string): ParseCSVResult {
  const byteLength = new TextEncoder().encode(csvContent).byteLength;
  if (byteLength === 0) {
    return failure("CSV file is empty.");
  }

  if (byteLength > MAX_CSV_BYTES) {
    return failure("CSV file must be 512 KB or smaller.");
  }

  if (!csvContent.trim()) {
    return failure("CSV file is empty.");
  }

  const parsed = Papa.parse<string[]>(csvContent, {
    skipEmptyLines: "greedy",
  });

  if (parsed.errors.length > 0 || parsed.data.length === 0) {
    return failure("CSV contains invalid formatting.");
  }

  const rawHeaders = parsed.data[0];
  if (rawHeaders.length > MAX_CSV_COLUMNS) {
    return failure("CSV can contain at most 32 columns.");
  }

  if (rawHeaders.some((header) => header.length > MAX_CSV_HEADER_CHARS)) {
    return failure("CSV headers must be 128 characters or fewer.");
  }

  const headers = rawHeaders.map(normalizeHeader);
  if (headers.some((header) => header.length === 0)) {
    return failure("CSV column headers cannot be blank.");
  }

  if (new Set(headers).size !== headers.length) {
    return failure("CSV contains duplicate column headers.");
  }

  const rows = parsed.data.slice(1);
  if (rows.length > MAX_CSV_ROWS) {
    return failure("CSV can contain at most 1,000 transaction rows.");
  }

  if (rows.some((row) => row.length > headers.length)) {
    return failure("CSV rows must not contain more values than the header row.");
  }

  if (rows.some((row) => row.some((cell) => cell.length > MAX_CSV_CELL_CHARS))) {
    return failure("CSV cells must be 2,048 characters or fewer.");
  }

  const data = rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );

  return { success: true, data, headers };
}

export function validateColumnMapping(
  mapping: unknown,
  headers?: string[]
): ValidationResult<ColumnMapping> {
  if (!isRecord(mapping)) {
    return {
      success: false,
      error: "Column mapping contains an unknown field or header.",
    };
  }

  const supportedKeys = new Set<string>(SUPPORTED_MAPPING_KEYS);
  const headerSet = headers ? new Set(headers) : null;
  const validated: ColumnMapping = {};

  for (const [key, value] of Object.entries(mapping)) {
    if (
      !supportedKeys.has(key) ||
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > MAX_CSV_HEADER_CHARS ||
      (headerSet !== null && !headerSet.has(value))
    ) {
      return {
        success: false,
        error: "Column mapping contains an unknown field or header.",
      };
    }

    validated[key as keyof ColumnMapping] = value;
  }

  if (REQUIRED_MAPPING_KEYS.some((key) => !validated[key])) {
    return {
      success: false,
      error: "Map the required Date, Amount, Type, and Account columns.",
    };
  }

  const mappedHeaders = Object.values(validated);
  if (new Set(mappedHeaders).size !== mappedHeaders.length) {
    return { success: false, error: "Each CSV column can only be mapped once." };
  }

  return { success: true, data: validated };
}

export function validateImportTransactionsInput(
  input: unknown
): ValidationResult<ImportTransactionsInput> {
  const inputResult = z
    .strictObject({
      csvContent: z.string(),
      mapping: z.unknown(),
      options: z
        .strictObject({
          createMissingCategories: z.boolean().optional(),
          createMissingAccounts: z.boolean().optional(),
        })
        .optional(),
      confirmation: z
        .strictObject({
          code: z.string().min(1),
        })
        .optional(),
    })
    .safeParse(input);

  if (!inputResult.success) {
    return { success: false, error: "Invalid import request." };
  }

  const mappingResult = validateColumnMapping(inputResult.data.mapping);
  if (!mappingResult.success) return mappingResult;

  return {
    success: true,
    data: {
      csvContent: inputResult.data.csvContent,
      mapping: mappingResult.data,
      ...(inputResult.data.options ? { options: inputResult.data.options } : {}),
      ...(inputResult.data.confirmation
        ? { confirmation: inputResult.data.confirmation }
        : {}),
    },
  };
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const patterns: Array<{
    field: keyof ColumnMapping;
    values: string[];
  }> = [
    { field: "date", values: ["date", "transaction_date", "trans_date", "tx_date"] },
    { field: "amount", values: ["amount", "value", "sum", "total"] },
    { field: "type", values: ["type", "transaction_type", "trans_type", "tx_type"] },
    { field: "category", values: ["category", "cat", "category_name"] },
    {
      field: "toAccount",
      values: ["to_account", "to account", "destination", "dest_account", "target_account"],
    },
    { field: "account", values: ["account", "account_name", "from_account", "source"] },
    { field: "description", values: ["description", "desc", "memo", "note", "notes"] },
    { field: "location", values: ["location", "place", "address", "venue"] },
    { field: "latitude", values: ["latitude", "lat"] },
    { field: "longitude", values: ["longitude", "lng", "lon"] },
    {
      field: "googleMapsLink",
      values: ["google maps link", "google_maps_link", "maps link", "maps url", "google maps url"],
    },
    { field: "currency", values: ["currency", "curr", "ccy"] },
  ];

  for (const header of headers) {
    const normalized = header.toLowerCase();
    const match = patterns.find(
      ({ field, values }) =>
        !mapping[field] && values.some((pattern) => normalized.includes(pattern))
    );
    if (match) mapping[match.field] = header;
  }

  return mapping;
}

export function mapToTransactions(
  data: Record<string, string>[],
  mapping: ColumnMapping
): ParsedTransaction[] {
  return data.map((row, index) => {
    const errors: string[] = [];
    const dateValue = mapping.date ? row[mapping.date]?.trim() ?? "" : "";
    const amountValue = mapping.amount ? row[mapping.amount]?.trim() ?? "" : "";
    const typeValue = mapping.type
      ? row[mapping.type]?.trim().toUpperCase() ?? ""
      : "";
    const categoryValue = sanitizeCsvCell(
      mapping.category ? row[mapping.category] : undefined
    );
    const accountValue =
      sanitizeCsvCell(mapping.account ? row[mapping.account] : undefined) ?? "";
    const toAccountValue = sanitizeCsvCell(
      mapping.toAccount ? row[mapping.toAccount] : undefined
    );
    const descriptionValue = sanitizeCsvCell(
      mapping.description ? row[mapping.description] : undefined
    );
    const locationValue = sanitizeCsvCell(
      mapping.location ? row[mapping.location] : undefined
    );
    const latitudeValue = mapping.latitude
      ? row[mapping.latitude]?.trim() || undefined
      : undefined;
    const longitudeValue = mapping.longitude
      ? row[mapping.longitude]?.trim() || undefined
      : undefined;
    const googleMapsLinkValue = sanitizeCsvCell(
      mapping.googleMapsLink ? row[mapping.googleMapsLink] : undefined
    );
    const rawCurrency = mapping.currency ? row[mapping.currency]?.trim() : "IDR";
    const currencyValue = (rawCurrency || "IDR").toUpperCase();

    if (!dateValue) errors.push("Date is required");
    if (!amountValue) errors.push("Amount is required");
    if (!typeValue) errors.push("Type is required");
    if (!accountValue) errors.push("Account is required");

    let amount = 0;
    if (amountValue) {
      const parsedAmount = Number(amountValue.replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        errors.push("Amount must be a positive number");
      } else {
        amount = parsedAmount;
      }
    }

    if (typeValue && !["INCOME", "EXPENSE", "TRANSFER"].includes(typeValue)) {
      errors.push("Type must be INCOME, EXPENSE, or TRANSFER");
    }

    if (typeValue === "TRANSFER" && !toAccountValue) {
      errors.push("To Account is required for TRANSFER transactions");
    }

    if (
      typeValue === "TRANSFER" &&
      toAccountValue &&
      accountValue.toLowerCase() === toAccountValue.toLowerCase()
    ) {
      errors.push("Source and destination accounts must be different for TRANSFER");
    }

    if (dateValue) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
      const parsedDate = match
        ? new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`)
        : null;
      if (
        !parsedDate ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== dateValue
      ) {
        errors.push("Invalid date format");
      }
    }

    if (latitudeValue && parseOptionalNumber(latitudeValue) === undefined) {
      errors.push("Latitude must be a valid number");
    }

    if (longitudeValue && parseOptionalNumber(longitudeValue) === undefined) {
      errors.push("Longitude must be a valid number");
    }

    if (!/^[A-Z]{3}$/.test(currencyValue)) {
      errors.push("Currency must be a 3-letter code");
    }

    return {
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
      currency: currencyValue,
      isValid: errors.length === 0,
      errors,
      rowNumber: index + 2,
    };
  });
}

export function previewImport(
  csvContent: string,
  mapping: unknown
): PreviewImportResult {
  const parseResult = parseCSVContent(csvContent);
  if (!parseResult.success) {
    return {
      success: false,
      transactions: [],
      summary: { total: 0, valid: 0, invalid: 0 },
      error: parseResult.error,
    };
  }

  const mappingResult = validateColumnMapping(mapping, parseResult.headers);
  if (!mappingResult.success) {
    return {
      success: false,
      transactions: [],
      summary: { total: 0, valid: 0, invalid: 0 },
      error: mappingResult.error,
    };
  }

  const transactions = mapToTransactions(parseResult.data, mappingResult.data);
  const valid = transactions.filter((transaction) => transaction.isValid).length;

  return {
    success: true,
    transactions,
    summary: {
      total: transactions.length,
      valid,
      invalid: transactions.length - valid,
    },
  };
}

export function getImportTemplate(): string {
  return `Date,Amount,Type,Category,Account,To Account,Description,Location,Latitude,Longitude,Google Maps Link,Currency
2024-01-15,50000,INCOME,Salary,Bank Account,,Monthly salary,Office,-6.200000,106.816666,https://www.google.com/maps/search/?api=1&query=-6.200000%2C106.816666,IDR
2024-01-16,25000,EXPENSE,Food,Cash,,Groceries,Restaurant,,,,IDR
2024-01-17,10000,EXPENSE,Transport,Bank Account,,Taxi fare,Train station,-6.175110,106.865036,https://www.google.com/maps/search/?api=1&query=-6.175110%2C106.865036,IDR
2024-01-18,30000,TRANSFER,,Bank Account,Savings,Transfer to savings,,,,,IDR`;
}
