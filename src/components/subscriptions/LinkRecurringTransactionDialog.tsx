"use client";

import { useMemo, useState } from "react";

import { useLinkSubscriptionToRecurringRule } from "@/hooks/useSubscriptionQueries";
import { useRecurringRules } from "@/hooks/useRecurringQueries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RecurringRuleOption {
  id: string;
  name: string;
  type: string;
  subscriptionId: string | null;
}

interface LinkRecurringTransactionDialogProps {
  subscriptionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkRecurringTransactionDialog({
  subscriptionId,
  open,
  onOpenChange,
}: LinkRecurringTransactionDialogProps) {
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");
  const { data: rules = [] } = useRecurringRules();
  const linkMutation = useLinkSubscriptionToRecurringRule();

  const eligibleRules = useMemo(
    () =>
      (rules as RecurringRuleOption[]).filter(
        (rule) => rule.type === "EXPENSE" && !rule.subscriptionId
      ),
    [rules]
  );

  const handleLink = async () => {
    if (!selectedRuleId) {
      return;
    }

    try {
      await linkMutation.mutateAsync({
        subscriptionId,
        recurringRuleId: selectedRuleId,
      });
      setSelectedRuleId("");
      onOpenChange(false);
    } catch {
      // The mutation error is shown in the footer.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedRuleId("");
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Existing Recurring Rule</DialogTitle>
          <DialogDescription>
            Choose an expense recurring rule. Its billing details will be synced from this subscription.
          </DialogDescription>
        </DialogHeader>

        {eligibleRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No eligible expense recurring rules are available to link.
          </p>
        ) : (
          <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a recurring rule" />
            </SelectTrigger>
            <SelectContent>
              {eligibleRules.map((rule) => (
                <SelectItem key={rule.id} value={rule.id}>
                  {rule.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {linkMutation.error && (
          <p className="text-sm text-destructive">{linkMutation.error.message}</p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={linkMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleLink}
            disabled={!selectedRuleId || linkMutation.isPending || eligibleRules.length === 0}
          >
            {linkMutation.isPending ? "Linking..." : "Link Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
