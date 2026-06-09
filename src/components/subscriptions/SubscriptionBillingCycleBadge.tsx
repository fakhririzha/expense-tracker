"use client";

import {
  SUBSCRIPTION_BILLING_CYCLE_LABELS,
  type SubscriptionBillingCycleValue,
} from "@/lib/subscription-constants";
import { Badge } from "@/components/ui/badge";

export function SubscriptionBillingCycleBadge({
  billingCycle,
}: {
  billingCycle: SubscriptionBillingCycleValue;
}) {
  return (
    <Badge variant="outline" className="font-medium">
      {SUBSCRIPTION_BILLING_CYCLE_LABELS[billingCycle]}
    </Badge>
  );
}
