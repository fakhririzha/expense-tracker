"use client";

import dynamic from "next/dynamic";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function DebtPayoffPlannerSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border p-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-3/4" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const DebtPayoffPlanner = dynamic(
  () =>
    import("@/components/liability/DebtPayoffPlanner").then(
      (module) => module.DebtPayoffPlanner
    ),
  {
    loading: () => <DebtPayoffPlannerSkeleton />,
  }
);

/**
 * Client boundary for the interactive payoff planner. Keeping this dynamic
 * import outside the server page preserves server rendering for the rest of
 * the liabilities surface.
 */
export function DebtPayoffPlannerSection() {
  return <DebtPayoffPlanner />;
}
