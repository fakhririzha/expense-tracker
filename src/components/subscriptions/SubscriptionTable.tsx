"use client";

import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";

import type { SubscriptionListItem } from "@/actions/subscription-actions";
import { SubscriptionBillingCycleBadge } from "@/components/subscriptions/SubscriptionBillingCycleBadge";
import { SubscriptionStatusBadge } from "@/components/subscriptions/SubscriptionStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface SubscriptionTableProps {
  subscriptions: SubscriptionListItem[];
  onSelect: (subscriptionId: string) => void;
  onEdit: (subscription: SubscriptionListItem) => void;
  onDelete: (subscription: SubscriptionListItem) => void;
}

export function SubscriptionTable({
  subscriptions,
  onSelect,
  onEdit,
  onDelete,
}: SubscriptionTableProps) {
  if (subscriptions.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <p className="font-bold">No subscriptions in this view</p>
        <p className="text-sm text-muted-foreground">
          Add your first subscription or change the current filter.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subscription</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Billing</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Next Renewal</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Recurring Rule</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((subscription) => (
            <TableRow
              key={subscription.id}
              className="cursor-pointer"
              onClick={() => onSelect(subscription.id)}
            >
              <TableCell className="min-w-56">
                <p className="font-bold">{subscription.name}</p>
                <p className="text-sm text-muted-foreground">
                  {subscription.provider || "No provider"}
                </p>
              </TableCell>
              <TableCell>
                <SubscriptionStatusBadge status={subscription.effectiveStatus} />
              </TableCell>
              <TableCell>
                <SubscriptionBillingCycleBadge billingCycle={subscription.billingCycle} />
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(subscription.amount, subscription.currency)}
              </TableCell>
              <TableCell>{format(new Date(subscription.nextBillingDate), "MMM d, yyyy")}</TableCell>
              <TableCell>{subscription.account?.name ?? "No account"}</TableCell>
              <TableCell>
                {subscription.recurringRule ? (
                  <div>
                    <p className="font-medium">{subscription.recurringRule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {subscription.recurringSyncStatus === "in_sync"
                        ? "Synced"
                        : "Needs review"}
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not linked</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(subscription);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(subscription);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
