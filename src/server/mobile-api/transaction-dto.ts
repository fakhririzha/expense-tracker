import type { MobileTransaction } from "@finhealth/contracts";

interface ServiceTransaction {
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
  account: MobileTransaction["account"];
  toAccount?: MobileTransaction["toAccount"];
  category: MobileTransaction["category"];
  splits: MobileTransaction["splits"];
  capabilities: MobileTransaction["capabilities"];
}

export function toMobileTransaction(
  transaction: ServiceTransaction
): MobileTransaction {
  return {
    id: transaction.id,
    amount: transaction.amount,
    currency: transaction.currency,
    exchangeRate: transaction.exchangeRate,
    type: transaction.type,
    description: transaction.description,
    location: transaction.location,
    latitude: transaction.latitude,
    longitude: transaction.longitude,
    googleMapsLink: transaction.googleMapsLink,
    date: transaction.date.toISOString(),
    isRecurring: transaction.isRecurring,
    isManagedByDeposito: transaction.isManagedByDeposito,
    toAccountId: transaction.toAccountId,
    account: transaction.account,
    toAccount: transaction.toAccount ?? null,
    category: transaction.category,
    splits: transaction.splits,
    capabilities: transaction.capabilities,
  };
}
