import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { FinancialInsightsSkeleton } from "./FinancialInsightsSkeleton";

function WeeklyAiInsightsSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-md border p-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-2 h-3 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function InsightsPageSkeleton() {
  return (
    <div className="space-y-6 p-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-2/3" />
      </div>
      <WeeklyAiInsightsSkeleton />
      <FinancialInsightsSkeleton />
    </div>
  );
}
