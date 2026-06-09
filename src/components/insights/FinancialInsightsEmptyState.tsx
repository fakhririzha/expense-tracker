import Link from "next/link";

import { Button } from "@/components/ui/button";

export function FinancialInsightsEmptyState() {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
      <p className="text-base font-semibold">No urgent insights right now</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Add more activity to unlock richer guidance across budgets, goals, and reports.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/transactions">Add transactions</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/budgets">Review budgets</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/goals">Open goals</Link>
        </Button>
      </div>
    </div>
  );
}
