import type { AccountType } from "@/generated/prisma/client/client";
import type { TransactionCapabilities } from "@/server/transactions/transaction-capability-policy";
import type { PaginatedTransactionsData, TransactionListItem } from "@/types/transaction-list";

export type CapableTransactionListItem = Omit<TransactionListItem, "account" | "toAccount"> & {
  account: { id: string; name: string; type: AccountType };
  toAccount: { id: string; name: string; type: AccountType } | null;
  capabilities: TransactionCapabilities;
};

export type CapableTransactionPage = Omit<PaginatedTransactionsData, "transactions"> & {
  transactions: CapableTransactionListItem[];
};
