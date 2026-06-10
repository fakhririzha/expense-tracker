"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import type { SubscriptionListItem } from "@/actions/subscription-actions";
import { UpcomingBankPressureAlert } from "@/components/alerts/UpcomingBankPressureAlert";
import { SubscriptionDetailDrawer } from "@/components/subscriptions/SubscriptionDetailDrawer";
import { SubscriptionFormDialog } from "@/components/subscriptions/SubscriptionFormDialog";
import { SubscriptionPageHeader } from "@/components/subscriptions/SubscriptionPageHeader";
import { SubscriptionSummaryCards } from "@/components/subscriptions/SubscriptionSummaryCards";
import { SubscriptionTable } from "@/components/subscriptions/SubscriptionTable";
import { TrialEndingSoonCard } from "@/components/subscriptions/TrialEndingSoonCard";
import { UpcomingRenewalsCard } from "@/components/subscriptions/UpcomingRenewalsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteSubscription, useSubscriptions, useSubscriptionSummary } from "@/hooks/useSubscriptionQueries";
import { useUpcomingBankPressure } from "@/hooks/useUpcomingBankPressure";
import { type SubscriptionStatusFilter } from "@/lib/subscription-constants";

export function SubscriptionManager() {
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatusFilter>("ALL");
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionListItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: subscriptions = [], isLoading } = useSubscriptions({
    status: statusFilter,
  });
  const { data: summary } = useSubscriptionSummary();
  const { data: bankPressureAlerts = [] } = useUpcomingBankPressure();
  const deleteMutation = useDeleteSubscription();

  const handleSelect = (subscriptionId: string) => {
    setSelectedSubscriptionId(subscriptionId);
    setDrawerOpen(true);
  };

  const handleEdit = (subscription: SubscriptionListItem) => {
    setEditingSubscription(subscription);
    setIsEditOpen(true);
  };

  const handleDelete = async (subscription: SubscriptionListItem) => {
    const confirmed = confirm(
      `Delete "${subscription.name}" from the tracker? This does not remove past transactions or any linked recurring rule.`
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(subscription.id);
      if (selectedSubscriptionId === subscription.id) {
        setDrawerOpen(false);
        setSelectedSubscriptionId(null);
      }
    } catch {
      // Mutation error is shown near the table.
    }
  };

  return (
    <>
      <div className="space-y-6">
        <SubscriptionPageHeader
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        <SubscriptionSummaryCards summary={summary} />

        <UpcomingBankPressureAlert alerts={bankPressureAlerts} />

        <div className="grid gap-6 lg:grid-cols-2">
          <UpcomingRenewalsCard items={summary?.upcomingRenewals ?? []} />
          <TrialEndingSoonCard items={summary?.trialEndingSoon ?? []} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Tracker</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <SubscriptionTable
                subscriptions={subscriptions as SubscriptionListItem[]}
                onSelect={handleSelect}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}

            {deleteMutation.error && (
              <p className="mt-4 text-sm text-destructive">
                {deleteMutation.error.message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <SubscriptionDetailDrawer
        subscriptionId={selectedSubscriptionId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <SubscriptionFormDialog
        mode="edit"
        subscription={editingSubscription}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  );
}
