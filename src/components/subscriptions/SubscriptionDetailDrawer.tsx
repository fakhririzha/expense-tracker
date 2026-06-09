"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  CalendarClock,
  ExternalLink,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { useState } from "react";

import { SubscriptionBillingCycleBadge } from "@/components/subscriptions/SubscriptionBillingCycleBadge";
import { CreateRecurringRuleFromSubscriptionDialog } from "@/components/subscriptions/CreateRecurringRuleFromSubscriptionDialog";
import { LinkRecurringTransactionDialog } from "@/components/subscriptions/LinkRecurringTransactionDialog";
import { SubscriptionFormDialog } from "@/components/subscriptions/SubscriptionFormDialog";
import { SubscriptionStatusBadge } from "@/components/subscriptions/SubscriptionStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useSubscription,
  useUnlinkSubscriptionFromRecurringRule,
  useUpdateSubscription,
} from "@/hooks/useSubscriptionQueries";
import { formatCurrency } from "@/lib/utils";

interface SubscriptionDetailDrawerProps {
  subscriptionId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function SubscriptionDetailDrawer({
  subscriptionId,
  open,
  onOpenChange,
}: SubscriptionDetailDrawerProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [createRecurringOpen, setCreateRecurringOpen] = useState(false);

  const { data: subscription, isLoading } = useSubscription(
    open ? subscriptionId ?? undefined : undefined
  );
  const updateMutation = useUpdateSubscription();
  const unlinkMutation = useUnlinkSubscriptionFromRecurringRule();

  const handleLifecycleChange = async (nextStatus: "ACTIVE" | "PAUSED" | "CANCELLED") => {
    if (!subscriptionId) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: subscriptionId,
        data: {
          status: nextStatus,
          cancellationDate: nextStatus === "CANCELLED" ? new Date() : null,
        },
      });
    } catch {
      // Mutation error is shown below the actions.
    }
  };

  const handleUnlink = async () => {
    if (!subscriptionId) {
      return;
    }

    if (!confirm("Unlink this recurring rule from the subscription?")) {
      return;
    }

    try {
      await unlinkMutation.mutateAsync(subscriptionId);
    } catch {
      // Mutation error is shown below the actions.
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              {subscription?.name ?? "Subscription"}
            </SheetTitle>
            <SheetDescription>
              Review billing details, lifecycle status, and recurring-rule linkage.
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !subscription ? (
            <div className="py-8 text-sm text-muted-foreground">
              Select a subscription to see its details.
            </div>
          ) : (
            <div className="mt-6 space-y-6 px-4">
              <div className="flex flex-wrap items-center gap-2">
                <SubscriptionStatusBadge status={subscription.effectiveStatus} />
                <SubscriptionBillingCycleBadge billingCycle={subscription.billingCycle} />
                {subscription.recurringRule && (
                  <span className="text-sm text-muted-foreground">
                    {subscription.recurringSyncStatus === "in_sync"
                      ? "Recurring rule is synced"
                      : "Recurring rule needs review"}
                  </span>
                )}
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Billing amount</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(subscription.amount, subscription.currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Monthly equivalent</p>
                    <p className="font-semibold">
                      {formatCurrency(
                        subscription.monthlyEquivalent,
                        subscription.currency
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <DetailRow
                  label="Provider"
                  value={subscription.provider || "No provider"}
                />
                <DetailRow
                  label="Next billing date"
                  value={format(new Date(subscription.nextBillingDate), "MMM d, yyyy")}
                />
                <DetailRow
                  label="Payment account"
                  value={subscription.account?.name ?? "No account"}
                />
                <DetailRow
                  label="Category"
                  value={subscription.category?.name ?? "No category"}
                />
                <DetailRow
                  label="Start date"
                  value={
                    subscription.startDate
                      ? format(new Date(subscription.startDate), "MMM d, yyyy")
                      : "Not set"
                  }
                />
                <DetailRow
                  label="Trial end"
                  value={
                    subscription.trialEndDate
                      ? format(new Date(subscription.trialEndDate), "MMM d, yyyy")
                      : "Not set"
                  }
                />
                <DetailRow
                  label="Cancellation date"
                  value={
                    subscription.cancellationDate
                      ? format(new Date(subscription.cancellationDate), "MMM d, yyyy")
                      : "Not set"
                  }
                />
              </div>

              {subscription.description && (
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="mt-2 text-sm">{subscription.description}</p>
                </div>
              )}

              {subscription.notes && (
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="mt-2 text-sm">{subscription.notes}</p>
                </div>
              )}

              {subscription.cancellationUrl && (
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Cancellation link</p>
                  <Link
                    href={subscription.cancellationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    Open cancellation page
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              )}

              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="font-medium">Recurring Rule</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.recurringRule
                      ? `${subscription.recurringRule.name} • next due ${format(
                          new Date(subscription.recurringRule.nextDueDate),
                          "MMM d, yyyy"
                        )}`
                      : "No recurring rule linked yet"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {subscription.recurringRule ? (
                    <Button type="button" variant="outline" onClick={handleUnlink}>
                      <Unplug className="mr-2 h-4 w-4" />
                      Unlink recurring rule
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setLinkDialogOpen(true)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Link existing rule
                      </Button>
                      <Button type="button" onClick={() => setCreateRecurringOpen(true)}>
                        Create recurring rule
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                  Edit subscription
                </Button>

                {subscription.effectiveStatus === "ACTIVE" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleLifecycleChange("PAUSED")}
                  >
                    <PauseCircle className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                )}

                {(subscription.effectiveStatus === "PAUSED" ||
                  subscription.effectiveStatus === "CANCELLED" ||
                  subscription.effectiveStatus === "EXPIRED") && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleLifecycleChange("ACTIVE")}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Reactivate
                  </Button>
                )}

                {(subscription.effectiveStatus === "ACTIVE" ||
                  subscription.effectiveStatus === "TRIAL") && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleLifecycleChange("CANCELLED")}
                  >
                    Cancel subscription
                  </Button>
                )}
              </div>

              {(updateMutation.error || unlinkMutation.error) && (
                <p className="text-sm text-destructive">
                  {updateMutation.error?.message || unlinkMutation.error?.message}
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {subscription && (
        <>
          <SubscriptionFormDialog
            mode="edit"
            subscription={subscription}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          <LinkRecurringTransactionDialog
            subscriptionId={subscription.id}
            open={linkDialogOpen}
            onOpenChange={setLinkDialogOpen}
          />
          <CreateRecurringRuleFromSubscriptionDialog
            subscriptionId={subscription.id}
            open={createRecurringOpen}
            onOpenChange={setCreateRecurringOpen}
          />
        </>
      )}
    </>
  );
}
