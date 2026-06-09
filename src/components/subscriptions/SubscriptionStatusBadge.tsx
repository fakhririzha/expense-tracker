"use client";

import {
  SUBSCRIPTION_STATUS_LABELS,
  type SubscriptionStatusValue,
} from "@/lib/subscription-constants";
import { Badge } from "@/components/ui/badge";

const STATUS_CLASSNAMES: Record<SubscriptionStatusValue, string> = {
  ACTIVE: "bg-green-100 text-green-700 hover:bg-green-100",
  TRIAL: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  PAUSED: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  CANCELLED: "bg-red-100 text-red-700 hover:bg-red-100",
  EXPIRED: "bg-muted text-muted-foreground hover:bg-muted",
};

export function SubscriptionStatusBadge({
  status,
}: {
  status: SubscriptionStatusValue;
}) {
  return (
    <Badge variant="secondary" className={STATUS_CLASSNAMES[status]}>
      {SUBSCRIPTION_STATUS_LABELS[status]}
    </Badge>
  );
}
