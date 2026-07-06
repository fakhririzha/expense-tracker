export type BudgetScopeValue = "CATEGORIES" | "LEGACY_GLOBAL";

export interface BudgetCategorySummary {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export function isLegacyGlobalBudget(scope: BudgetScopeValue): boolean {
  return scope === "LEGACY_GLOBAL";
}

export function formatBudgetCategorySummary(
  categories: Array<Pick<BudgetCategorySummary, "name">>,
  scope: BudgetScopeValue,
  maxVisible = 2
): string {
  if (isLegacyGlobalBudget(scope)) {
    return "All spending";
  }

  if (categories.length === 0) {
    return "No categories";
  }

  const visible = categories.slice(0, maxVisible).map((category) => category.name);
  const hiddenCount = categories.length - visible.length;

  if (hiddenCount <= 0) {
    return visible.join(", ");
  }

  return `${visible.join(", ")} +${hiddenCount} more`;
}
