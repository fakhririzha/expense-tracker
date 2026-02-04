# Liability Payment Race Condition Fix Plan

## Problem Statement

The current implementation in [`src/actions/liability-payment-actions.ts`](src/actions/liability-payment-actions.ts:86-168) reads account balances during validation (outside the transaction) and uses those stale values inside the transaction. This creates a race condition where:

1. Another payment transaction can modify account balances between validation and the transaction
2. The `isOverpayment` calculation uses a stale `targetBalanceBefore`
3. The audit trail records inconsistent "before" and "after" balances

## Required Changes

### 1. Re-read Accounts Inside Transaction (Lines 111-131)

At the start of the async tx callback, add fresh reads of both accounts:

```typescript
// Fresh read of accounts inside transaction
const sourceAccount = await tx.financialAccount.findUnique({
  where: { id: sourceAccountId },
});

const targetAccount = await tx.financialAccount.findUnique({
  where: { id: targetAccountId },
});

// Use fresh balances
const sourceBalanceBefore = sourceAccount.balance;
const targetBalanceBefore = targetAccount.balance;
```

### 2. Compute `isOverpayment` Using Fresh Balance (Line 123)

Update the `isOverpayment` calculation to use the freshly-read `targetBalanceBefore`:

```typescript
// Before (uses stale value from validation)
isOverpayment: allowOverpayment && amount > Math.abs(targetBalanceBefore),

// After (uses fresh value from tx)
isOverpayment: allowOverpayment && amount > Math.abs(targetBalanceBefore),
```

### 3. Update Audit Trail with Fresh "Before" Balances (Lines 148-163)

Use the fresh `sourceBalanceBefore` and `targetBalanceBefore` in the audit record:

```typescript
await tx.liabilityPaymentAudit.create({
  data: {
    transactionId: transaction.id,
    sourceAccountId,
    sourceBalanceBefore: sourceBalanceBefore,  // Fresh value
    sourceBalanceAfter: updatedSourceAccount.balance,
    targetAccountId,
    targetBalanceBefore: targetBalanceBefore,  // Fresh value
    targetBalanceAfter: updatedTargetAccount.balance,
    paymentAmount: amount,
    currency,
    exchangeRate,
    executedBy: userId,
    executedAt: new Date(),
  },
});
```

### 4. Keep "After" Balances from Transaction Updates

The current implementation correctly uses `updatedSourceAccount.balance` and `updatedTargetAccount.balance` for the "after" fields. No changes needed here.

## Files to Modify

| File | Changes |
|------|---------|
| `src/actions/liability-payment-actions.ts` | Re-read accounts inside transaction, use fresh balances for isOverpayment and audit |

## Implementation Order

1. Add fresh account reads at the start of the `prisma.$transaction` callback
2. Update `isOverpayment` calculation to use fresh `targetBalanceBefore`
3. Update `liabilityPaymentAudit` to use fresh `sourceBalanceBefore` and `targetBalanceBefore`
4. Remove or simplify the balance extraction from `validationResult.data` (lines 103-108)

## Code Flow After Fix

```mermaid
sequenceDiagram
    participant User
    participant Action
    participant Validation
    participant DB as Prisma Transaction

    User->>Action: createLiabilityPayment(data)
    Action->>Validation: validateLiabilityPayment()
    Validation-->>Action: validation result (no balances)
    
    Action->>DB: prisma.$transaction(async tx => {
        DB->>DB: tx.financialAccount.findUnique(sourceAccount)
        DB->>DB: tx.financialAccount.findUnique(targetAccount)
        DB->>DB: const sourceBalanceBefore = sourceAccount.balance
        DB->>DB: const targetBalanceBefore = targetAccount.balance
        
        DB->>DB: tx.transaction.create(isOverpayment: fresh calculation)
        DB->>DB: tx.financialAccount.update(source)
        DB->>DB: tx.financialAccount.update(target)
        DB->>DB: tx.liabilityPaymentAudit.create(fresh before/after balances)
        DB->>DB: tx.transaction.update(status: COMPLETED)
    })
    DB-->>Action: result
    Action-->>User: PaymentResult
```
