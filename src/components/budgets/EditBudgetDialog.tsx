"use client";

import { useUpdateBudget } from "@/hooks/useBudgetQueries";
import { BudgetCategoryMultiSelect } from "@/components/budgets/BudgetCategoryMultiSelect";
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
import { Switch } from "@/components/ui/switch";
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const editBudgetFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    amount: z.number().positive("Amount must be positive"),
    period: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
    startDate: z.date(),
    endDate: z.date().optional().nullable(),
    categoryIds: z.array(z.string()),
    isActive: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return data.endDate > data.startDate;
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    }
  );

type EditBudgetFormValues = z.infer<typeof editBudgetFormSchema>;

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: string;
}

interface Budget {
  id: string;
  name: string;
  amount: number;
  period: string;
  scope: "CATEGORIES" | "LEGACY_GLOBAL";
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  categoryIds: string[];
  categories: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  }>;
}

interface EditBudgetDialogProps {
  budget: Budget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Renders a dialog containing a form to edit an existing budget.
 *
 * Pre-populates the form with the budget's current data and allows editing
 * name, amount, period, startDate, endDate, isActive, and category.
 * On success, the dialog closes and the optional callback is invoked.
 *
 * @param budget - The budget to edit, or null if no budget is selected
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback to control dialog open state
 * @param onSuccess - Optional callback invoked after a budget is successfully updated
 * @returns The Edit Budget dialog React element
 */
export function EditBudgetDialog({
  budget,
  open,
  onOpenChange,
  onSuccess,
}: EditBudgetDialogProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const updateMutation = useUpdateBudget();

  const form = useForm<EditBudgetFormValues>({
    resolver: zodResolver(editBudgetFormSchema),
    defaultValues: {
      name: "",
      amount: 0,
      period: "MONTHLY",
      startDate: new Date(),
      endDate: null,
      isActive: true,
      categoryIds: [],
    },
  });

  // Load categories when dialog opens
  useEffect(() => {
    /**
     * Load expense categories from the server and update the component state.
     *
     * Fetches data from `/api/categories`, filters the results to categories with `type === "EXPENSE"`,
     * and calls `setCategories` with the filtered list. Any fetch or parsing errors are logged to the console.
     */
    async function loadCategories() {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const data = await response.json();
          // Filter to only EXPENSE categories since budgets are for expenses
          const expenseCategories = data.filter(
            (cat: Category) => cat.type === "EXPENSE"
          );
          setCategories(expenseCategories);
        }
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    }
    if (open) {
      loadCategories();
    }
  }, [open]);

  // Reset form with budget data when budget changes
  useEffect(() => {
    if (budget && open) {
      form.reset({
        name: budget.name,
        amount: budget.amount,
        period: budget.period as "MONTHLY" | "QUARTERLY" | "YEARLY",
        startDate: new Date(budget.startDate),
        endDate: budget.endDate ? new Date(budget.endDate) : null,
        isActive: budget.isActive,
        categoryIds: budget.categoryIds,
      });
    }
  }, [budget, open, form]);

  const onSubmit = async (data: EditBudgetFormValues) => {
    if (!budget) return;

    if (budget.scope !== "LEGACY_GLOBAL" && data.categoryIds.length === 0) {
      form.setError("categoryIds", {
        message: "Select at least one category",
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: budget.id,
        data: {
          name: data.name,
          amount: data.amount,
          period: data.period,
          startDate: data.startDate,
          endDate: data.endDate || undefined,
          categoryIds: data.categoryIds,
          isActive: data.isActive,
        },
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to update budget",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Budget</DialogTitle>
          <DialogDescription>
            Update the budget details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Groceries Budget" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
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
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="categoryIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categories</FormLabel>
                  <FormControl>
                    <BudgetCategoryMultiSelect
                      legacyGlobal={
                        budget?.scope === "LEGACY_GLOBAL" && field.value.length === 0
                      }
                      onChange={field.onChange}
                      options={categories}
                      value={field.value}
                    />
                  </FormControl>
                  {budget?.scope === "LEGACY_GLOBAL" ? (
                    <p className="text-xs text-muted-foreground">
                      This legacy budget still covers all spending. Choose categories and save to convert it.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Select one or more expense categories for this budget.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
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
                        selected={field.value}
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
              name="endDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>End Date (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>No end date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
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
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
                disabled={updateMutation.isPending}
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
