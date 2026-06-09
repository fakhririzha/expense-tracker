import { PaymentStatus, TransactionType } from "@/generated/prisma/client/client";
import { isLiquidAccountType } from "@/lib/account-types";
import { getDateKey } from "@/lib/forecasting/forecast-periods";
import type {
  ForecastEvent,
  ForecastEventConfidence,
  ForecastEventDirection,
  ForecastEventSource,
  ForecastEventType,
} from "@/lib/forecasting/forecast-types";

export interface ForecastAccountRef {
  id: string;
  name: string;
  type: string;
  currency: string;
  isActive: boolean;
}

export interface TransactionForecastSource {
  id: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  type: TransactionType;
  date: Date;
  categoryId: string | null;
  isRecurring: boolean;
  recurringRuleId: string | null;
  paymentStatus: PaymentStatus;
  account: ForecastAccountRef;
  toAccount: ForecastAccountRef | null;
  category?: { name: string } | null;
}

interface BaseForecastEventInput {
  id: string;
  date: Date;
  type: ForecastEventType;
  label: string;
  amount: number;
  currency: string;
  direction: ForecastEventDirection;
  confidence: ForecastEventConfidence;
  source: ForecastEventSource;
  sourceId?: string;
  categoryId?: string | null;
  accountId?: string | null;
  amountInMainCurrency: number | null;
  conversionRate?: number | null;
  conversionSource?: ForecastEvent["conversionSource"];
  excludedFromProjection?: boolean;
}

export function buildForecastEvent(
  input: BaseForecastEventInput
): ForecastEvent {
  return {
    ...input,
    dateKey: getDateKey(input.date),
  };
}

export function getEventSortPriority(source: ForecastEventSource): number {
  switch (source) {
    case "transaction":
    case "liability":
    case "receivable":
      return 0;
    case "recurring_transaction":
      return 1;
    case "subscription":
      return 2;
    case "budget":
    case "historical_average":
      return 3;
    default:
      return 4;
  }
}

export function isTrackedLiquidAccount(
  account: ForecastAccountRef | null | undefined,
  trackedAccountIds: Set<string>
): boolean {
  if (!account || !account.isActive || !isLiquidAccountType(account.type)) {
    return false;
  }

  return trackedAccountIds.has(account.id);
}

export function classifyTransactionEventShape(
  transaction: TransactionForecastSource,
  trackedAccountIds: Set<string>
): {
  direction: ForecastEventDirection;
  type: ForecastEventType;
  source: ForecastEventSource;
  label: string;
  accountId?: string | null;
  excludedFromProjection?: boolean;
} | null {
  const fromLiquid = isTrackedLiquidAccount(transaction.account, trackedAccountIds);
  const toLiquid = isTrackedLiquidAccount(transaction.toAccount, trackedAccountIds);

  switch (transaction.type) {
    case TransactionType.INCOME:
      if (!fromLiquid) return null;
      return {
        direction: "inflow",
        type: "income",
        source: "transaction",
        label: transaction.category?.name || "Scheduled income",
        accountId: transaction.account.id,
      };
    case TransactionType.EXPENSE:
      if (!fromLiquid) return null;
      return {
        direction: "outflow",
        type: "expense",
        source: "transaction",
        label: transaction.category?.name || "Scheduled expense",
        accountId: transaction.account.id,
      };
    case TransactionType.TRANSFER:
      if (fromLiquid && toLiquid) {
        return {
          direction: "outflow",
          type: "transfer_out",
          source: "transaction",
          label: `Transfer: ${transaction.account.name} to ${transaction.toAccount?.name ?? "account"}`,
          accountId: transaction.account.id,
          excludedFromProjection: true,
        };
      }
      if (fromLiquid) {
        return {
          direction: "outflow",
          type:
            transaction.toAccount?.type === "LOAN_RECEIVABLE"
              ? "transfer_out"
              : "transfer_out",
          source: "transaction",
          label:
            transaction.toAccount?.type === "LOAN_RECEIVABLE"
              ? `Loans receivable transfer: ${transaction.toAccount.name}`
              : `Transfer to ${transaction.toAccount?.name ?? "account"}`,
          accountId: transaction.account.id,
        };
      }
      if (toLiquid) {
        return {
          direction: "inflow",
          type:
            transaction.account.type === "LOAN_RECEIVABLE"
              ? "receivable_repayment"
              : "transfer_in",
          source:
            transaction.account.type === "LOAN_RECEIVABLE"
              ? "receivable"
              : "transaction",
          label:
            transaction.account.type === "LOAN_RECEIVABLE"
              ? `Receivable repayment: ${transaction.account.name}`
              : `Transfer from ${transaction.account.name}`,
          accountId: transaction.toAccount?.id ?? null,
        };
      }
      return null;
    case TransactionType.LIABILITY_PAYMENT:
      if (!fromLiquid || transaction.paymentStatus === PaymentStatus.ROLLED_BACK) {
        return null;
      }
      return {
        direction: "outflow",
        type: "liability_payment",
        source: "liability",
        label: transaction.toAccount
          ? `Liability payment: ${transaction.toAccount.name}`
          : "Liability payment",
        accountId: transaction.account.id,
      };
    default:
      return null;
  }
}
