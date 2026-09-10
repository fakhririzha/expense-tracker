export interface TransactionCapabilities {
  canEdit: boolean;
  canDelete: boolean;
  reason?: string;
}

export interface TransactionCapabilityFacts {
  type: string;
  accountType: string;
  toAccountType?: string | null;
  hasSplits: boolean;
  isManagedByDeposito: boolean;
  isManagedByBankInterest: boolean;
}

const unavailable = (reason: string): TransactionCapabilities => ({
  canEdit: false,
  canDelete: false,
  reason,
});

export function deriveMobileTransactionCapabilities(
  facts: TransactionCapabilityFacts
): TransactionCapabilities {
  if (facts.isManagedByDeposito || facts.accountType === "DEPOSITO") {
    return unavailable("Manage this transaction from the Deposito Tracker on the web.");
  }

  if (facts.isManagedByBankInterest) {
    return unavailable("Automatic bank-interest transactions are managed on the web.");
  }

  if (facts.type === "LIABILITY_PAYMENT") {
    return unavailable("Manage liability payments from the Liabilities page on the web.");
  }

  if (
    facts.type === "TRANSFER" &&
    (facts.accountType === "LOAN_RECEIVABLE" ||
      facts.toAccountType === "LOAN_RECEIVABLE")
  ) {
    return unavailable("Manage loans-receivable transactions on the web.");
  }

  if (facts.hasSplits) {
    return unavailable("Split transactions are read-only in the mobile app.");
  }

  if (!["INCOME", "EXPENSE", "TRANSFER"].includes(facts.type)) {
    return unavailable("This transaction type is read-only in the mobile app.");
  }

  return { canEdit: true, canDelete: true };
}
