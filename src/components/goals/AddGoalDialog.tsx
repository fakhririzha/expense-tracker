"use client";

import { useCreateGoal } from "@/hooks/useGoalQueries";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
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

const goalFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetAmount: z.number().positive("Target must be positive"),
  currentAmount: z.number().min(0),
  targetDate: z.date().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface AddGoalDialogProps {
  onSuccess?: () => void;
}

/**
 * Render a dialog for creating a savings goal.
 *
 * Loads asset-type accounts when opened, validates input against the goal schema,
 * submits the form to create the goal, and surfaces submission errors at the form root.
 * On successful creation the dialog closes, the form resets, and the optional callback is invoked.
 *
 * @param onSuccess - Optional callback invoked after a goal is successfully created
 */
export function AddGoalDialog({ onSuccess }: AddGoalDialogProps) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const createMutation = useCreateGoal();

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
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

  useEffect(() => {
    /**
     * Load asset accounts from the API and update the component's accounts state.
     *
     * Fetches account data, filters for accounts whose type is "BANK", "CASH", or "INVESTMENT",
     * and calls `setAccounts` with the filtered list. Any network or parsing errors are logged
     * to the console.
     */
    async function loadAccounts() {
      try {
        const response = await fetch("/api/accounts/by-type");
        if (response.ok) {
          const data = await response.json();
          // Filter to asset accounts (BANK, CASH, INVESTMENT)
          const assetAccounts = data?.accounts?.filter(
            (acc: Account) =>
              acc.type === "BANK" || acc.type === "CASH" || acc.type === "INVESTMENT"
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

  const onSubmit = async (data: GoalFormValues) => {
    try {
      await createMutation.mutateAsync(data);
      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to create goal",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Goal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Savings Goal</DialogTitle>
          <DialogDescription>
            Create a new savings goal to track your progress towards a financial target.
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

            {/* Current Amount (Optional) */}
            <FormField
              control={form.control}
              name="currentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Amount (Optional)</FormLabel>
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
                        disabled={(date) => date < new Date()}
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
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Goal"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
