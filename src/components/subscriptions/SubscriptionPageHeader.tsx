"use client";

import { SubscriptionFormDialog } from "@/components/subscriptions/SubscriptionFormDialog";
import { Button } from "@/components/ui/button";
import { type SubscriptionStatusFilter } from "@/lib/subscription-constants";
import { cn } from "@/lib/utils";

const FILTERS: SubscriptionStatusFilter[] = [
  "ALL",
  "ACTIVE",
  "TRIAL",
  "PAUSED",
  "CANCELLED",
  "EXPIRED",
];

interface SubscriptionPageHeaderProps {
  statusFilter: SubscriptionStatusFilter;
  onStatusFilterChange: (status: SubscriptionStatusFilter) => void;
}

export function SubscriptionPageHeader({
  statusFilter,
  onStatusFilterChange,
}: SubscriptionPageHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">
            Track memberships, SaaS, and trials without creating a second billing engine.
          </p>
        </div>
        <SubscriptionFormDialog mode="create" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Button
            key={filter}
            type="button"
            variant={statusFilter === filter ? "default" : "outline"}
            size="sm"
            className={cn(statusFilter === filter && "shadow-none")}
            onClick={() => onStatusFilterChange(filter)}
          >
            {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>
    </div>
  );
}
