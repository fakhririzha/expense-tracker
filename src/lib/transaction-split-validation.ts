import { TransactionType } from "@/generated/prisma/client/client";

export const MAX_TRANSACTION_SPLITS = 20;

export interface TransactionSplitInput {
  categoryId?: string | null;
  amount: number;
  description?: string | null;
  sortOrder?: number;
}

export interface NormalizedTransactionSplitInput {
  categoryId: string | null;
  amount: number;
  description: string | null;
  sortOrder: number;
}

function normalizeOptionalText(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getCurrencyScale(currency: string): number {
  const normalizedCurrency = currency.trim().toUpperCase();

  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: normalizedCurrency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

function toMinorUnit(value: number, currency: string): number {
  const scale = getCurrencyScale(currency);
  const factor = 10 ** scale;
  return Math.round(value * factor);
}

export function normalizeTransactionSplits(
  splits: TransactionSplitInput[] | undefined
): NormalizedTransactionSplitInput[] {
  if (!splits?.length) {
    return [];
  }

  return splits
    .map((split, index) => ({
      categoryId: split.categoryId?.trim() || null,
      amount: split.amount,
      description: normalizeOptionalText(split.description),
      sortOrder: split.sortOrder ?? index,
    }))
    .filter((split) => split.categoryId !== null || split.description !== null || split.amount > 0);
}

export function validateTransactionSplits(args: {
  type: string;
  amount: number;
  currency: string;
  splits?: TransactionSplitInput[];
}) {
  const normalized = normalizeTransactionSplits(args.splits);

  if (normalized.length === 0) {
    return {
      success: true as const,
      data: [],
    };
  }

  if (args.type !== TransactionType.EXPENSE && args.type !== "EXPENSE") {
    return {
      success: false as const,
      error: "Transaction splits are only supported for expense transactions.",
    };
  }

  if (normalized.length < 2) {
    return {
      success: false as const,
      error: "Split transactions require at least two split rows.",
    };
  }

  if (normalized.length > MAX_TRANSACTION_SPLITS) {
    return {
      success: false as const,
      error: `Split transactions support at most ${MAX_TRANSACTION_SPLITS} rows.`,
    };
  }

  for (const split of normalized) {
    if (!split.categoryId) {
      return {
        success: false as const,
        error: "Each split row must have a category.",
      };
    }

    if (!Number.isFinite(split.amount) || split.amount <= 0) {
      return {
        success: false as const,
        error: "Each split row amount must be greater than zero.",
      };
    }
  }

  const parentMinorUnits = toMinorUnit(args.amount, args.currency);
  const splitMinorUnits = normalized.reduce(
    (sum, split) => sum + toMinorUnit(split.amount, args.currency),
    0
  );

  if (parentMinorUnits !== splitMinorUnits) {
    return {
      success: false as const,
      error: "Split amounts must exactly equal the parent transaction amount.",
    };
  }

  return {
    success: true as const,
    data: normalized,
  };
}

export function transactionHasSplits(
  transaction: { splits?: Array<unknown> | null } | null | undefined
): boolean {
  return !!transaction?.splits?.length;
}
