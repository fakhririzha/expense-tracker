"use client";

import { useAccounts } from "@/hooks/useAccountQueries";
import { useCategories } from "@/hooks/useCategoryQueries";
import { useCreateRecurringRule } from "@/hooks/useRecurringQueries";
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
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const recurringRuleFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  interval: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  nextDueDate: z.date(),
  endDate: z.date().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
});

type RecurringRuleFormValues = z.infer<typeof recurringRuleFormSchema>;

interface CategoryOption {
  id: string;
  name: string;
  icon: string | null;
}

interface AddRecurringRuleDialogProps {
  onSuccess?: () => void;
}

/**
 * Render a dialog that lets the user create a recurring financial rule.
 *
 * The dialog loads available accounts when opened, validates input against
 * the recurring rule schema, submits the form to create the rule, and surfaces
 * any submission errors at the form root. On successful creation the dialog
 * closes, the form resets, and the optional `onSuccess` callback is invoked.
 *
 * @param onSuccess - Optional callback invoked after a recurring rule is successfully created
 * @returns The Add Recurring Rule dialog component
 */
export function AddRecurringRuleDialog({ onSuccess }: AddRecurringRuleDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: accountsData = [] } = useAccounts();
  const createMutation = useCreateRecurringRule();
  const form = useForm<RecurringRuleFormValues>({
    resolver: zodResolver(recurringRuleFormSchema),
    defaultValues: {
      name: "",
      amount: 0,
      currency: "IDR",
      type: "EXPENSE",
      interval: "MONTHLY",
      nextDueDate: new Date(),
      description: "",
      categoryId: "",
      accountId: "",
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

  useEffect(() => {
    const currentCategoryId = form.getValues("categoryId");
    if (!currentCategoryId) {
      return;
    }

    if (selectedType === "TRANSFER") {
      form.setValue("categoryId", "", { shouldDirty: true, shouldValidate: true });
      return;
    }

    if (!isLoadingCategories && !categories.some((category) => category.id === currentCategoryId)) {
      form.setValue("categoryId", "", { shouldDirty: true, shouldValidate: true });
    }
  }, [categories, form, isLoadingCategories, selectedType]);

  const onSubmit = async (data: RecurringRuleFormValues) => {
    try {
      await createMutation.mutateAsync({
        ...data,
        categoryId: data.type === "TRANSFER" ? "" : data.categoryId,
      });
      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to create recurring rule",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="max-md:w-full">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Recurring Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Recurring Rule</DialogTitle>
          <DialogDescription>
            Create a rule to automatically generate recurring transactions.
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
                      defaultValue={field.value}
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
                      defaultValue={field.value}
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
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedType !== "TRANSFER" && (
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
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
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter description" {...field} />
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
                onClick={() => setOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
