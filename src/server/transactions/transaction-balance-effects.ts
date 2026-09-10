export interface TransactionBalanceEffect {
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "LIABILITY_PAYMENT";
  accountId: string;
  toAccountId: string | null;
}

export interface AccountBalanceDelta {
  accountId: string;
  amount: number;
}

export function getTransactionBalanceDeltas(
  transaction: TransactionBalanceEffect,
  direction: "apply" | "reverse"
): AccountBalanceDelta[] {
  const multiplier = direction === "apply" ? 1 : -1;

  if (transaction.type === "TRANSFER") {
    if (!transaction.toAccountId) {
      throw new Error("To account is required for transfers");
    }

    return [
      { accountId: transaction.accountId, amount: -transaction.amount * multiplier },
      { accountId: transaction.toAccountId, amount: transaction.amount * multiplier },
    ];
  }

  const signedAmount =
    transaction.type === "INCOME" ? transaction.amount : -transaction.amount;
  return [
    { accountId: transaction.accountId, amount: signedAmount * multiplier },
  ];
}

export function getTransactionUpdateBalanceDeltas(
  previous: TransactionBalanceEffect,
  next: TransactionBalanceEffect
): AccountBalanceDelta[] {
  return [
    ...getTransactionBalanceDeltas(previous, "reverse"),
    ...getTransactionBalanceDeltas(next, "apply"),
  ];
}
