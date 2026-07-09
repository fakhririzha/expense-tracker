export const ACCOUNT_TYPES = [
  "BANK",
  "CASH",
  "INVESTMENT",
  "DEPOSITO",
  "LOAN",
  "CREDIT_CARD",
  "LOAN_RECEIVABLE",
] as const;

export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountTypeValue, string> = {
  BANK: "Bank Account",
  CASH: "Cash",
  INVESTMENT: "Investment",
  DEPOSITO: "Deposito",
  LOAN: "Loan",
  CREDIT_CARD: "Credit Card",
  LOAN_RECEIVABLE: "Loans Receivable",
};

export const ASSET_ACCOUNT_TYPES = [
  "BANK",
  "CASH",
  "INVESTMENT",
  "DEPOSITO",
  "LOAN_RECEIVABLE",
] as const satisfies readonly AccountTypeValue[];

export const LIABILITY_ACCOUNT_TYPES = [
  "LOAN",
  "CREDIT_CARD",
] as const satisfies readonly AccountTypeValue[];

export const LIQUID_ACCOUNT_TYPES = [
  "BANK",
  "CASH",
] as const satisfies readonly AccountTypeValue[];

export const TRANSFER_ACCOUNT_TYPES = [
  "BANK",
  "CASH",
  "INVESTMENT",
] as const satisfies readonly AccountTypeValue[];

/** Account types eligible as savings-goal funding sources. */
export const GOAL_SOURCE_ACCOUNT_TYPES = [
  "BANK",
  "CASH",
  "INVESTMENT",
] as const satisfies readonly AccountTypeValue[];

export function isAssetAccountType(type: string): boolean {
  return (ASSET_ACCOUNT_TYPES as readonly string[]).includes(type);
}

export function isLiabilityAccountType(type: string): boolean {
  return (LIABILITY_ACCOUNT_TYPES as readonly string[]).includes(type);
}

export function isLiquidAccountType(type: string): boolean {
  return (LIQUID_ACCOUNT_TYPES as readonly string[]).includes(type);
}

export function isTransferAccountType(type: string): boolean {
  return (TRANSFER_ACCOUNT_TYPES as readonly string[]).includes(type);
}

export function isGoalSourceAccountType(type: string): boolean {
  return (GOAL_SOURCE_ACCOUNT_TYPES as readonly string[]).includes(type);
}

export function isLoanReceivableAccountType(type: string): boolean {
  return type === "LOAN_RECEIVABLE";
}

export function isDepositoAccountType(type: string): boolean {
  return type === "DEPOSITO";
}

export function normalizeAccountBalanceForType(
  type: string,
  balance: number
): number {
  if (isLiabilityAccountType(type)) {
    return Math.abs(balance) * -1;
  }

  if (isLoanReceivableAccountType(type)) {
    return Math.abs(balance);
  }

  return balance;
}
