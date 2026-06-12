"use client";

import { useAccounts } from "@/hooks/useAccountQueries";
import { useCategories } from "@/hooks/useCategoryQueries";
import { useUpdateRecurringRule } from "@/hooks/useRecurringQueries";
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
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const editRecurringRuleFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  interval: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  nextDueDate: z.date(),
  endDate: z.date().optional().nullable(),
  isActive: z.boolean(),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
});

type EditRecurringRuleFormValues = z.infer<typeof editRecurringRuleFormSchema>;

interface CategoryOption {
  id: string;
  name: string;
  icon: string | null;
}

interface RecurringRule {
  id: string;
  name: string;
  amount: number;
  currency: string;
  type: string;
  interval: string;
  nextDueDate: Date;
  endDate: Date | null;
  isActive: boolean;
  description: string | null;
  categoryId: string | null;
  accountId: string | null;
}

interface EditRecurringRuleDialogProps {
  rule: RecurringRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Renders a dialog containing a form to edit an existing recurring rule.
 *
 * Pre-populates the form with the rule's current data and allows editing
 * name, amount, currency, type, interval, nextDueDate, endDate, isActive,
 * description, and account. On success, the dialog closes and the optional
 * callback is invoked.
 *
 * @param rule - The recurring rule to edit, or null if no rule is selected
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback to control dialog open state
 * @param onSuccess - Optional callback invoked after a rule is successfully updated
 * @returns The Edit Recurring Rule dialog React element
 */
export function EditRecurringRuleDialog({
  rule,
  open,
  onOpenChange,
  onSuccess,
}: EditRecurringRuleDialogProps) {
  const { data: accountsData = [] } = useAccounts();
  const updateMutation = useUpdateRecurringRule();
  const form = useForm<EditRecurringRuleFormValues>({
    resolver: zodResolver(editRecurringRuleFormSchema),
    defaultValues: {
      name: "",
      amount: 0,
      currency: "IDR",
      type: "EXPENSE",
      interval: "MONTHLY",
      nextDueDate: new Date(),
      endDate: null,
      isActive: true,
      description: "",
      categoryId: null,
      accountId: null,
    },
  });
  const selectedType = useWatch({
    control: form.control,
    name: "type",
    defaultValue: "EXPENSE",
  });
  const { data: categoriesData = [], isLoading: isLoadingCategories } = useCategories(selectedType);

  const accounts = accountsData.map((a: { id: string; name: string }) => ({
    id: a.id,
    name: a.name,
  }));
  const categories = categoriesData.map((category: CategoryOption) => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
  }));

  // Reset form with rule data when rule changes
  useEffect(() => {
    if (rule && open) {
      form.reset({
        name: rule.name,
        amount: rule.amount,
        currency: rule.currency,
        type: rule.type as EditRecurringRuleFormValues["type"],
        interval: rule.interval as EditRecurringRuleFormValues["interval"],
        nextDueDate: new Date(rule.nextDueDate),
        endDate: rule.endDate ? new Date(rule.endDate) : null,
        isActive: rule.isActive,
        description: rule.description || "",
        categoryId: rule.categoryId || null,
        accountId: rule.accountId || null,
      });
    }
  }, [rule, open, form]);

  useEffect(() => {
    const currentCategoryId = form.getValues("categoryId");
    if (!currentCategoryId) {
      return;
    }

    if (selectedType === "TRANSFER") {
      form.setValue("categoryId", null, { shouldDirty: true, shouldValidate: true });
      return;
    }

    if (!isLoadingCategories && !categories.some((category) => category.id === currentCategoryId)) {
      form.setValue("categoryId", null, { shouldDirty: true, shouldValidate: true });
    }
  }, [categories, form, isLoadingCategories, selectedType]);

  const onSubmit = async (data: EditRecurringRuleFormValues) => {
    if (!rule) return;

    try {
      await updateMutation.mutateAsync({
        id: rule.id,
        data: {
          name: data.name,
          amount: data.amount,
          currency: data.currency,
          type: data.type,
          interval: data.interval,
          nextDueDate: data.nextDueDate,
          endDate: data.endDate || undefined,
          isActive: data.isActive,
          description: data.description || undefined,
          categoryId: data.type === "TRANSFER" ? "" : data.categoryId || undefined,
          accountId: data.accountId || undefined,
        },
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to update recurring rule",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Recurring Rule</DialogTitle>
          <DialogDescription>
            Update the recurring transaction rule details.
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
                    <Input placeholder="Monthly Rent" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INCOME">Income</SelectItem>
                        <SelectItem value="EXPENSE">Expense</SelectItem>
                        <SelectItem value="TRANSFER">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interval</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select interval" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
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
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="IDR">IDR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="SGD">SGD</SelectItem>
                        <SelectItem value="JPY">JPY</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedType !== "TRANSFER" && (
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.icon ? `${category.icon} ` : ""}
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
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
              name="nextDueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Next Due Date</FormLabel>
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
                        onSelect={(selected) => {
                          if (selected) {
                            field.onChange(selected);
                          }
                        }}
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
                        selected={field.value || undefined}
                        onSelect={(date) => field.onChange(date || null)}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter description"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
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
                    <p className="text-sm text-muted-foreground">
                      When active, this rule will generate transactions automatically
                    </p>
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
