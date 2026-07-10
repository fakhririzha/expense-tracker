import Link from "next/link";

import { ContextualEmptyState } from "@/components/onboarding/ContextualEmptyState";
import { Button } from "@/components/ui/button";

export function FinancialInsightsEmptyState() {
  return (
    <ContextualEmptyState
      title="No insights yet"
      description="Insights appear after FinHealth has enough activity to analyze."
      embedded
      action={
        <>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/transactions">Add transactions</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/budgets">Review budgets</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/goals">Open goals</Link>
        </Button>
        </>
      }
    />
  );
}
