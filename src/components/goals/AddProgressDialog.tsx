"use client";

import { addProgress, withdrawProgress } from "@/actions/goal-actions";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { GoalWithProgress } from "@/actions/goal-actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const progressFormSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  action: z.enum(["add", "withdraw"]),
});

type ProgressFormValues = z.infer<typeof progressFormSchema>;

interface AddProgressDialogProps {
  goal: GoalWithProgress | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Render a dialog that lets the user add to or withdraw progress from a savings goal.
 *
 * Displays current progress, a live preview of the resulting progress based on the entered amount and selected action, and submits the update to the server.
 *
 * @param goal - The goal to update, or `null` to render nothing
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback invoked when the dialog open state should change
 * @param onSuccess - Optional callback invoked after a successful update
 * @returns The dialog React element, or `null` when `goal` is `null`
 */
export function AddProgressDialog({
  goal,
  open,
  onOpenChange,
  onSuccess,
}: AddProgressDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProgressFormValues>({
    resolver: zodResolver(progressFormSchema),
    defaultValues: {
      amount: 0,
      action: "add",
    },
  });

  // Reset form when goal changes
  const resetForm = () => {
    form.reset({
      amount: 0,
      action: "add",
    });
  };

  const onSubmit = async (data: ProgressFormValues) => {
    if (!goal) return;

    setIsSubmitting(true);
    try {
      const result =
        data.action === "add"
          ? await addProgress(goal.id, data.amount)
          : await withdrawProgress(goal.id, data.amount);

      if (result.success) {
        onOpenChange(false);
        resetForm();
        onSuccess?.();
      } else {
        form.setError("root", {
          message: result.error || "Failed to update progress",
        });
      }
    } catch {
      form.setError("root", {
        message: "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAction = form.watch("action");
  const amountValue = form.watch("amount") || 0;

  // Calculate preview values
  const previewCurrentAmount = goal
    ? selectedAction === "add"
      ? goal.currentAmount + amountValue
      : goal.currentAmount - amountValue
    : 0;
  const previewPercentage = goal
    ? Math.min((previewCurrentAmount / goal.targetAmount) * 100, 100)
    : 0;

  if (!goal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{goal.icon || "💰"}</span>
            {goal.name}
          </DialogTitle>
          <DialogDescription>
            Add or withdraw progress from your savings goal.
          </DialogDescription>
        </DialogHeader>

        {/* Current Progress */}
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Progress</span>
            <span className="font-medium">{goal.percentage.toFixed(1)}%</span>
          </div>
          <Progress value={goal.percentage} className="h-2" />
          <div className="flex justify-between text-sm">
            <span>{formatCurrency(goal.currentAmount, "IDR")}</span>
            <span className="text-muted-foreground">
              of {formatCurrency(goal.targetAmount, "IDR")}
            </span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Action Selection */}
            <FormField
              control={form.control}
              name="action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === "add" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => field.onChange("add")}
                    >
                      <span className="mr-2">➕</span>
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "withdraw" ? "destructive" : "outline"}
                      className="flex-1"
                      onClick={() => field.onChange("withdraw")}
                    >
                      <span className="mr-2">➖</span>
                      Withdraw
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  {selectedAction === "withdraw" && amountValue > goal.currentAmount && (
                    <p className="text-sm text-destructive">
                      Cannot withdraw more than current amount ({formatCurrency(goal.currentAmount, "IDR")})
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview */}
            {amountValue > 0 && (
              <div className="space-y-2 p-3 border rounded-lg">
                <p className="text-sm font-medium">Preview</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">New Progress</span>
                    <span className="font-medium">{previewPercentage.toFixed(1)}%</span>
                  </div>
                  <Progress value={previewPercentage} className="h-2" />
                  <div className="flex justify-between text-sm">
                    <span>{formatCurrency(previewCurrentAmount, "IDR")}</span>
                    <span className="text-muted-foreground">
                      of {formatCurrency(goal.targetAmount, "IDR")}
                    </span>
                  </div>
                </div>
                {previewCurrentAmount >= goal.targetAmount && selectedAction === "add" && (
                  <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                    🎉 Goal will be completed!
                  </p>
                )}
              </div>
            )}

            {/* Error message */}
            {form.formState.errors.root && (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  (selectedAction === "withdraw" && amountValue > goal.currentAmount)
                }
                variant={selectedAction === "withdraw" ? "destructive" : "default"}
              >
                {isSubmitting
                  ? "Processing..."
                  : selectedAction === "add"
                  ? "Add Progress"
                  : "Withdraw"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}