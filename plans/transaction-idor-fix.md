# Transaction IDOR Vulnerability Fix Plan

## Vulnerability Summary

The [`createTransaction`](src/actions/transaction-actions.ts:67) server action accepts `categoryId` and `recurringRuleId` from the client without verifying these resources belong to the authenticated user. An attacker could provide IDs belonging to other users, leading to unauthorized data association (IDOR vulnerability).

## Affected Functions

1. **[`createTransaction`](src/actions/transaction-actions.ts:67)** - Primary vulnerability (lines 124-136)
2. **[`updateTransaction`](src/actions/transaction-actions.ts:178)** - Same pattern, needs same fix
3. **[`createRecurringRule`](src/actions/recurring-actions.ts:25)** - Accepts `categoryId` without validation
4. **[`updateRecurringRule`](src/actions/recurring-actions.ts:57)** - Same pattern, needs same fix

## Root Cause Analysis

- `categoryId` can reference categories owned by other users OR system categories (`isSystem: true`)
- `recurringRuleId` must belong to the authenticated user (no system-wide recurring rules)
- Current code only validates `accountId` ownership, not these foreign keys

## Fix Strategy

### 1. Create Validation Helper Functions

Add helper functions to validate resource ownership:

```typescript
// Validate category exists and belongs to user OR is a system category
async function validateCategory(
  categoryId: string | null,
  userId: string
): Promise<boolean>

// Validate recurring rule belongs to user
async function validateRecurringRule(
  recurringRuleId: string | null,
  userId: string
): Promise<boolean>
```

### 2. Fix `createTransaction`

Add validation after account validation (around line 119):

```typescript
// Validate category if provided
const categoryId = rest.categoryId?.trim() || null;
if (categoryId) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [{ userId: session.user.id }, { isSystem: true }],
    },
  });
  if (!category) {
    return { success: false, error: "Category not found" };
  }
}

// Validate recurring rule if provided
const recurringRuleId = rest.recurringRuleId?.trim() || null;
if (recurringRuleId) {
  const recurringRule = await prisma.recurringRule.findFirst({
    where: { id: recurringRuleId, userId: session.user.id },
  });
  if (!recurringRule) {
    return { success: false, error: "Recurring rule not found" };
  }
}
```

### 3. Fix `updateTransaction`

Add same validations for `categoryId` and `recurringRuleId` in the update function.

### 4. Fix `createRecurringRule` and `updateRecurringRule`

Add validation for `categoryId` when creating/updating recurring rules.

## Implementation Order

1. **Phase 1**: Create validation helper functions (optional, for reusability)
2. **Phase 2**: Fix `createTransaction` function
3. **Phase 3**: Fix `updateTransaction` function  
4. **Phase 4**: Fix `createRecurringRule` function
5. **Phase 5**: Fix `updateRecurringRule` function

## Security Considerations

- Always use `findFirst` with `userId` condition (never trust client IDs)
- For categories, allow both user-owned and system categories
- For recurring rules, only allow user-owned rules
- Return generic "Not found" errors to avoid information disclosure

## Testing Recommendations

1. Test with valid user-owned category/recurring rule
2. Test with valid system category (`isSystem: true`)
3. Test with category/recurring rule from another user (should fail)
4. Test with invalid ID format (should fail)
