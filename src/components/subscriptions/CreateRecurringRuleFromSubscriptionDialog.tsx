"use client";

import { useCreateRecurringRuleFromSubscription } from "@/hooks/useSubscriptionQueries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CreateRecurringRuleFromSubscriptionDialogProps {
  subscriptionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRecurringRuleFromSubscriptionDialog({
  subscriptionId,
  open,
  onOpenChange,
}: CreateRecurringRuleFromSubscriptionDialogProps) {
  const createMutation = useCreateRecurringRuleFromSubscription();

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync(subscriptionId);
      onOpenChange(false);
    } catch {
      // Mutation error is shown inline below.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Recurring Rule</DialogTitle>
          <DialogDescription>
            This will create an expense recurring rule from the subscription billing details and link it automatically.
          </DialogDescription>
        </DialogHeader>

        {createMutation.error && (
          <p className="text-sm text-destructive">{createMutation.error.message}</p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create and Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
