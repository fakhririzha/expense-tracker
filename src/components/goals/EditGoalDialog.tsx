"use client";

import { useUpdateGoal } from "@/hooks/useGoalQueries";
import { GoalAccountMultiSelect } from "@/components/goals/GoalAccountMultiSelect";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { isGoalSourceAccountType } from "@/lib/account-types";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const GOAL_ICONS = [
  { value: "🏖️", label: "Vacation" },
  { value: "🚗", label: "Car" },
  { value: "🏠", label: "House" },
  { value: "💰", label: "Savings" },
  { value: "🎓", label: "Education" },
  { value: "💍", label: "Wedding" },
  { value: "🎮", label: "Gaming" },
  { value: "📱", label: "Electronics" },
  { value: "🛡️", label: "Emergency Fund" },
  { value: "🎁", label: "Gift" },
  { value: "✈️", label: "Travel" },
  { value: "🚴", label: "Fitness" },
];

const GOAL_COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
];

const editGoalFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetAmount: z.number().positive("Target must be positive"),
  targetDate: z.date().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  accountIds: z.array(z.string()).min(1, "Select at least one account"),
});

type EditGoalFormValues = z.infer<typeof editGoalFormSchema>;

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: Date | null;
  icon: string | null;
  color: string | null;
  description: string | null;
  accounts: Array<{
    id: string;
    name: string;
    currency: string;
  }>;
}

interface EditGoalDialogProps {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Dialog for editing a savings goal and its linked account sources.
 */
export function EditGoalDialog({
  goal,
  open,
  onOpenChange,
  onSuccess,
}: EditGoalDialogProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const updateMutation = useUpdateGoal();

  const form = useForm<EditGoalFormValues>({
    resolver: zodResolver(editGoalFormSchema),
    defaultValues: {
      name: "",
      targetAmount: 0,
      targetDate: null,
      icon: "💰",
      color: "#22c55e",
      description: "",
      accountIds: [],
    },
  });

  useEffect(() => {
    async function loadAccounts() {
      try {
        const response = await fetch("/api/accounts/by-type");
        if (response.ok) {
          const data = await response.json();
          const assetAccounts =
            data?.accounts?.filter((acc: Account) =>
              isGoalSourceAccountType(acc.type)
            ) ?? [];
          setAccounts(assetAccounts);
        }
      } catch (error) {
        console.error("Failed to load accounts:", error);
      }
    }
    if (open) {
      loadAccounts();
    }
  }, [open]);

  useEffect(() => {
    if (goal && open) {
      form.reset({
        name: goal.name,
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
        icon: goal.icon || "💰",
        color: goal.color || "#22c55e",
        description: goal.description || "",
        accountIds: goal.accounts.map((account) => account.id),
      });
    }
  }, [goal, open, form]);

  // Ensure already-linked accounts still appear even if inactive/missing from the active list
  const accountOptions = (() => {
    if (!goal) return accounts;
    const byId = new Map(accounts.map((account) => [account.id, account]));
    for (const linked of goal.accounts) {
      if (!byId.has(linked.id)) {
        byId.set(linked.id, {
          id: linked.id,
          name: linked.name,
          type: "BANK",
          currency: linked.currency,
        });
      }
    }
    return Array.from(byId.values());
  })();

  const onSubmit = async (data: EditGoalFormValues) => {
    if (!goal) return;

    try {
      await updateMutation.mutateAsync({ id: goal.id, data });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to update goal",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Savings Goal</DialogTitle>
          <DialogDescription>
            Update your goal details and which account balances count toward progress.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Emergency Fund" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Amount</FormLabel>
                  <FormControl>
                    <MoneyInput
                      placeholder="0.00"
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      onValueChange={(value) => field.onChange(value ?? 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Sources</FormLabel>
                  <FormControl>
                    <GoalAccountMultiSelect
                      options={accountOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select one or more accounts"
                      emptyMessage="No Bank, Cash, Investment, or Deposito accounts found."
                    />
                  </FormControl>
                  <FormDescription>
                    Progress is the total balance of the selected accounts.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Date (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an icon">
                          {field.value ? (
                            <span className="flex items-center gap-2">
                              <span className="text-lg">{field.value}</span>
                              {GOAL_ICONS.find((i) => i.value === field.value)?.label ||
                                "Custom"}
                            </span>
                          ) : (
                            "Select an icon"
                          )}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GOAL_ICONS.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          <span className="flex items-center gap-2">
                            <span className="text-lg">{icon.value}</span>
                            {icon.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex gap-2 flex-wrap">
                    {GOAL_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          field.value === color.value
                            ? "border-primary scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color.value }}
                        onClick={() => field.onChange(color.value)}
                        title={color.label}
                      />
                    ))}
                  </div>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="#22c55e"
                      {...field}
                      value={field.value || ""}
                      className="mt-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What are you saving for?"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
