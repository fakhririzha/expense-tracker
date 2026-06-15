export interface TransactionAllocationCategory {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface TransactionAllocationSplit {
  id: string;
  amount: number;
  description: string | null;
  categoryId: string | null;
  category: TransactionAllocationCategory | null;
  sortOrder: number;
}

export interface TransactionAllocationTransaction {
  id: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  type: string;
  categoryId: string | null;
  category: TransactionAllocationCategory | null;
  date: Date;
  accountId: string;
  toAccountId?: string | null;
  description?: string | null;
  paymentStatus?: string;
  splits?: TransactionAllocationSplit[];
}

export interface TransactionAllocationRow {
  transactionId: string;
  splitId: string | null;
  amount: number;
  normalizedAmount: number;
  currency: string;
  exchangeRate: number;
  type: string;
  date: Date;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  category: TransactionAllocationCategory | null;
  description: string | null;
  isSplit: boolean;
}

export function hasSplitAllocations(
  transaction: Pick<TransactionAllocationTransaction, "splits">
): boolean {
  return !!transaction.splits?.length;
}

export function getTransactionAllocationRows(
  transaction: TransactionAllocationTransaction
): TransactionAllocationRow[] {
  if (!hasSplitAllocations(transaction)) {
    return [
      {
        transactionId: transaction.id,
        splitId: null,
        amount: transaction.amount,
        normalizedAmount: transaction.amount * transaction.exchangeRate,
        currency: transaction.currency,
        exchangeRate: transaction.exchangeRate,
        type: transaction.type,
        date: transaction.date,
        accountId: transaction.accountId,
        toAccountId: transaction.toAccountId ?? null,
        categoryId: transaction.categoryId,
        category: transaction.category,
        description: transaction.description ?? null,
        isSplit: false,
      },
    ];
  }

  return [...(transaction.splits ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((split) => ({
      transactionId: transaction.id,
      splitId: split.id,
      amount: split.amount,
      normalizedAmount: split.amount * transaction.exchangeRate,
      currency: transaction.currency,
      exchangeRate: transaction.exchangeRate,
      type: transaction.type,
      date: transaction.date,
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId ?? null,
      categoryId: split.categoryId,
      category: split.category,
      description: split.description ?? transaction.description ?? null,
      isSplit: true,
    }));
}

export function flattenTransactionAllocationRows(
  transactions: TransactionAllocationTransaction[]
): TransactionAllocationRow[] {
  return transactions.flatMap((transaction) => getTransactionAllocationRows(transaction));
}

export function getSplitSummary(transaction: {
  category: TransactionAllocationCategory | null;
  splits?: Array<{
    category: TransactionAllocationCategory | null;
    sortOrder: number;
  }>;
}) {
  const splits = [...(transaction.splits ?? [])].sort(
    (left, right) => left.sortOrder - right.sortOrder
  );

  if (splits.length === 0) {
    return {
      label: transaction.category?.name ?? "Uncategorized",
      count: 0,
      isSplit: false,
    };
  }

  const firstCategory = splits[0]?.category?.name ?? "Uncategorized";
  return {
    label: splits.length === 1 ? firstCategory : `${firstCategory} +${splits.length - 1}`,
    count: splits.length,
    isSplit: true,
  };
}
