export const DEFAULT_TRANSACTION_PAGE = 1;
export const DEFAULT_TRANSACTION_PAGE_SIZE = 25;
export const TRANSACTION_PAGE_SIZES = [10, 25, 50, 100] as const;

export type TransactionSortField = "date" | "amount";
export type TransactionSortOrder = "asc" | "desc";

export interface TransactionListItem {
  id: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "LIABILITY_PAYMENT";
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsLink: string | null;
  date: Date;
  isRecurring: boolean;
  isManagedByDeposito: boolean;
  toAccountId: string | null;
  account: {
    id: string;
    name: string;
    type: string;
  };
  toAccount?: {
    id: string;
    name: string | null;
    type: string;
  } | null;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  splits: Array<{
    id: string;
    amount: number;
    description: string | null;
    sortOrder: number;
    categoryId: string | null;
    category: {
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
    } | null;
  }>;
}

export interface TransactionListQueryParams {
  accountId?: string;
  categoryId?: string;
  type?: TransactionListItem["type"];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
  sortBy?: TransactionSortField;
  sortOrder?: TransactionSortOrder;
}

export interface PaginatedTransactionsData {
  transactions: TransactionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
