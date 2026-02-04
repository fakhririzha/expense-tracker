# Investment Balance Snapshot Fix Plan

## Problem
In `createInvestmentAsset`, balance snapshots (`balanceBefore` and `balanceAfter`) are computed **outside** the DB transaction and then used inside the transaction for `tradeHistory` records. This causes race conditions where:
1. Validation reads account balance at time T1
2. Another transaction modifies the balance at time T2
3. Current transaction commits at time T3 with stale balance snapshots

## Solution
Re-read account balance **inside** the transaction and compute `balanceBefore`/`balanceAfter` immediately before writing `tradeHistory`.

## Changes Required

### File: `src/actions/investment-actions.ts`

#### 1. Update Existing Asset Flow (lines 122-206)

**Current (BUG):**
```typescript
const { account, balanceBefore } = validationResult.data!;
const balanceAfter = balanceBefore - totalAmount;

// ... later inside transaction ...
await tx.tradeHistory.create({
  data: {
    // ...
    balanceBefore,      // STALE VALUE
    balanceAfter,       // STALE VALUE
  },
});
```

**Fixed:**
```typescript
const { account } = validationResult.data!;

// Remove: const balanceBefore = ...
// Remove: const balanceAfter = ...

// Inside withSerializableTransaction:
const lockedAccount = await tx.financialAccount.findUnique({
  where: { id: accountId },
});

if (!lockedAccount || lockedAccount.balance < totalAmount) {
  throw new Error("Insufficient funds or account not found");
}

const balanceBefore = lockedAccount.balance;  // FRESH READ

// ... asset update operations ...

// Deduct balance from account
const updatedAccount = await tx.financialAccount.update({
  where: { id: accountId },
  data: { balance: { decrement: totalAmount } },
});

const balanceAfter = updatedAccount.balance;  // COMPUTED AFTER DEBIT

// Create trade history with FRESH snapshots
await tx.tradeHistory.create({
  data: {
    // ...
    balanceBefore,      // FRESH VALUE
    balanceAfter,       // FRESH VALUE
  },
});
```

#### 2. Update New Asset Flow (lines 209-283)

**Current (BUG):**
```typescript
const { account, balanceBefore } = validationResult.data!;
const balanceAfter = balanceBefore - totalAmount;

// ... later inside transaction ...
await tx.tradeHistory.create({
  data: {
    // ...
    balanceBefore,      // STALE VALUE
    balanceAfter,       // STALE VALUE
  },
});
```

**Fixed:**
```typescript
const { account } = validationResult.data!;

// Remove: const balanceBefore = ...
// Remove: const balanceAfter = ...

// Inside withSerializableTransaction:
const lockedAccount = await tx.financialAccount.findUnique({
  where: { id: accountId },
});

if (!lockedAccount || lockedAccount.balance < totalAmount) {
  throw new Error("Insufficient funds or account not found");
}

const balanceBefore = lockedAccount.balance;  // FRESH READ

// ... asset creation ...

// Deduct balance from account
const updatedAccount = await tx.financialAccount.update({
  where: { id: accountId },
  data: { balance: { decrement: totalAmount } },
});

const balanceAfter = updatedAccount.balance;  // COMPUTED AFTER DEBIT

// Create trade history with FRESH snapshots
await tx.tradeHistory.create({
  data: {
    // ...
    balanceBefore,      // FRESH VALUE
    balanceAfter,       // FRESH VALUE
  },
});
```

#### 3. Return Statement Updates

After both flows, update return statements to use the freshly computed values:
```typescript
return { 
  success: true, 
  data: updatedAsset, 
  updated: true,
  account: {
    id: account.id,
    name: account.name,
    balanceBefore,    // FRESH VALUE
    balanceAfter,     // FRESH VALUE
  }
};
```

## Transaction Isolation Note
The `withSerializableTransaction` helper (lines 47-72) already uses:
- `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`
- `maxWait: 5000` (5 seconds)
- `timeout: 10000` (10 seconds)
- Retry logic with exponential backoff for P2023/P2034 errors

This pattern is consistent with `liability-payment-actions.ts`.

## Summary of Files Changed
- `src/actions/investment-actions.ts`:
  - `createInvestmentAsset` function (lines 80-290)
  - Remove stale `balanceBefore`/`balanceAfter` computation before transaction
  - Re-read account inside transaction
  - Compute `balanceBefore` from fresh read
  - Compute `balanceAfter` after debit, before tradeHistory

## No Changes Required
- `recordTrade` function already computes `balanceBefore` fresh inside transaction
- `validateBuyTransaction`/`validateSellTransaction` remain unchanged
- `liability-payment-actions.ts` pattern already correct
