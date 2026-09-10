import {
  isDepositoAccountType,
  isTransferAccountType,
} from "@/lib/account-types";

export interface TransactionAccountFacts {
  id: string;
  type: string;
  currency: string;
  isActive: boolean;
}

export function validateNewTransactionAccounts(input: {
  type: string;
  accountId: string;
  toAccountId?: string | null;
  account: TransactionAccountFacts | null;
  toAccount: TransactionAccountFacts | null;
}): { success: true } | { success: false; error: string } {
  const { type, accountId, toAccountId, account, toAccount } = input;
  if (!account) return { success: false, error: "Account not found" };
  if (!account.isActive) {
    return {
      success: false,
      error: "Account is inactive. Please choose an active account.",
    };
  }
  if (isDepositoAccountType(account.type)) {
    return {
      success: false,
      error: "Deposito transactions must be managed from the Deposito Tracker page.",
    };
  }

  if (type !== "TRANSFER") return { success: true };
  if (!toAccountId) {
    return { success: false, error: "To account is required for transfers" };
  }
  if (!toAccount) return { success: false, error: "To account not found" };
  if (!toAccount.isActive) {
    return {
      success: false,
      error: "Destination account is inactive. Please choose an active account.",
    };
  }
  if (isDepositoAccountType(toAccount.type)) {
    return {
      success: false,
      error: "Deposito transfers must be managed from the Deposito Tracker page.",
    };
  }
  if (!isTransferAccountType(toAccount.type)) {
    return {
      success: false,
      error: "Transfers can only be made to bank, cash, or investment accounts",
    };
  }
  if (!isTransferAccountType(account.type)) {
    return {
      success: false,
      error: "Transfers can only be made from bank, cash, or investment accounts",
    };
  }
  if (accountId === toAccountId) {
    return { success: false, error: "Cannot transfer to the same account" };
  }
  if (account.currency !== toAccount.currency) {
    return {
      success: false,
      error:
        "Transfers require source and destination accounts to use the same currency.",
    };
  }

  return { success: true };
}
