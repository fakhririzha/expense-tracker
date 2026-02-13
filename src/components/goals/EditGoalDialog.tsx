"use client";

import { updateGoal } from "@/actions/goal-actions";
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
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Common emoji icons for goals
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

// Color presets for goals
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
  currentAmount: z.number().min(0),
  targetDate: z.date().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
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
  currentAmount: number;
  targetDate: Date | null;
  icon: string | null;
  color: string | null;
  description: string | null;
  isCompleted: boolean;
  accountId: string | null;
  account?: {
    id: string;
    name: string;
    currency: string;
  } | null;
}

interface EditGoalDialogProps {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Renders a dialog containing a form to edit an existing goal.
 *
 * Pre-populates the form with the goal's current data and allows editing
 * name, targetAmount, currentAmount, targetDate, icon, color, description, and linked account.
 * On success, the dialog closes and the optional callback is invoked.
 *
 * @param goal - The goal to edit, or null if no goal is selected
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback to control dialog open state
 * @param onSuccess - Optional callback invoked after a goal is successfully updated
 * @returns The Edit Goal dialog React element
 */
export function EditGoalDialog({
  goal,
  open,
  onOpenChange,
  onSuccess,
}: EditGoalDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const form = useForm<EditGoalFormValues>({
    resolver: zodResolver(editGoalFormSchema),
    defaultValues: {
      name: "",
      targetAmount: 0,
      currentAmount: 0,
      targetDate: null,
      icon: "💰",
      color: "#22c55e",
      description: "",
      accountId: null,
    },
  });

  // Load accounts when dialog opens
  useEffect(() => {
    async function loadAccounts() {
      try {
        const response = await fetch("/api/accounts/by-type");
        if (response.ok) {
          const data = await response.json();
          // Filter to asset accounts (BANK, CASH, INVESTMENT)
          const assetAccounts = data.filter(
            (acc: Account) =>
              acc.type === "BANK" || acc.type === "CASH" || acc.type === "INVESTMENT"
          );
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

  // Reset form with goal data when goal changes
  useEffect(() => {
    if (goal && open) {
      form.reset({
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
        icon: goal.icon || "💰",
        color: goal.color || "#22c55e",
        description: goal.description || "",
        accountId: goal.accountId || null,
      });
    }
  }, [goal, open, form]);

  const onSubmit = async (data: EditGoalFormValues) => {
    if (!goal) return;

    setIsSubmitting(true);
    try {
      const result = await updateGoal(goal.id, data);

      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        form.setError("root", {
          message: result.error || "Failed to update goal",
        });
      }
    } catch (error) {
      form.setError("root", {
        message: "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Savings Goal</DialogTitle>
          <DialogDescription>
            Update your savings goal details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
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

            {/* Target Amount */}
            <FormField
              control={form.control}
              name="targetAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Current Amount */}
            <FormField
              control={form.control}
              name="currentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Date */}
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

            {/* Icon */}
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
                              {GOAL_ICONS.find((i) => i.value === field.value)?.label || "Custom"}
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

            {/* Color */}
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

            {/* Description */}
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

            {/* Linked Account */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Account (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
