import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

function SupportCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-3">
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

export function DashboardMoneyPlanSkeleton() {
  return (
    <section className="space-y-4" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Card>
        <CardHeader className="gap-4 md:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <Skeleton className="h-8 w-32" />
        </CardHeader>
        <CardContent className="space-y-5">
          <Skeleton className="h-12 w-56" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SupportCardSkeleton />
        <SupportCardSkeleton />
      </div>
    </section>
  );
}

export function DashboardPositionSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <section className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <SupportCardSkeleton />
        <SupportCardSkeleton />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-36" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardHomeSkeleton() {
  return (
    <div className="space-y-6 p-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>
      <DashboardMoneyPlanSkeleton />
      <DashboardPositionSkeleton />
    </div>
  );
}
