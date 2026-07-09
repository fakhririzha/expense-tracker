"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import type { DebtPlanView } from "@/actions/debt-plan-actions";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateDebtPlan,
  useDebtPlanEligibleAccounts,
  useUpdateDebtPlan,
} from "@/hooks/useDebtPlanQueries";
import { formatCurrency } from "@/lib/utils";

const itemSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  annualInterestRate: z.number().min(0).max(100),
  minimumPayment: z.number().positive("Minimum payment must be positive"),
  priorityOverride: z.number().int().min(1).max(100).nullable().optional(),
  paymentDayOfMonth: z.number().int().min(1).max(28),
});

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(120),
    strategy: z.enum(["AVALANCHE", "SNOWBALL", "CUSTOM"]),
    extraMonthlyAmount: z.number().min(0),
    items: z.array(itemSchema).min(1, "Add at least one liability"),
  })
  .superRefine((data, ctx) => {
    if (data.strategy === "CUSTOM") {
      data.items.forEach((item, index) => {
        if (item.priorityOverride == null) {
          ctx.addIssue({
            code: "custom",
            message: "Priority is required for custom order",
            path: ["items", index, "priorityOverride"],
          });
        }
      });
    }

    const ids = data.items.map((item) => item.accountId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "Each liability can only appear once",
        path: ["items"],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

interface DebtPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: DebtPlanView | null;
  onSuccess?: () => void;
}

/**
 * Create or edit a debt payoff plan: strategy, extra monthly budget, and per-liability APR / minimums.
 */
export function DebtPlanDialog({
  open,
  onOpenChange,
  plan,
  onSuccess,
}: DebtPlanDialogProps) {
  const isEditing = Boolean(plan);
  const { data: accounts = [], isLoading: accountsLoading } =
    useDebtPlanEligibleAccounts(open);
  const createMutation = useCreateDebtPlan();
  const updateMutation = useUpdateDebtPlan();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "My debt payoff plan",
      strategy: "AVALANCHE",
      extraMonthlyAmount: 0,
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const strategy = form.watch("strategy");
  const watchedItems = form.watch("items");

  useEffect(() => {
    if (!open) return;

    if (plan) {
      form.reset({
        name: plan.name,
        strategy: plan.strategy,
        extraMonthlyAmount: plan.extraMonthlyAmount,
        items: plan.items.map((item) => ({
          accountId: item.accountId,
          annualInterestRate: item.annualInterestRate,
          minimumPayment: item.minimumPayment,
          priorityOverride: item.priorityOverride,
          paymentDayOfMonth: item.paymentDayOfMonth,
        })),
      });
      return;
    }

    const defaultItems =
      accounts.length > 0
        ? accounts.map((account, index) => ({
            accountId: account.id,
            annualInterestRate: 0,
            minimumPayment: Math.max(account.balance * 0.02, 1),
            priorityOverride: index + 1,
            paymentDayOfMonth: 1,
          }))
        : [];

    form.reset({
      name: "My debt payoff plan",
      strategy: "AVALANCHE",
      extraMonthlyAmount: 0,
      items: defaultItems,
    });
  }, [open, plan, accounts, form]);

  const selectedAccountIds = watchedItems.map((item) => item.accountId);

  const availableToAdd = useMemo(
    () => accounts.filter((account) => !selectedAccountIds.includes(account.id)),
    [accounts, selectedAccountIds]
  );

  const accountById = useMemo(() => {
    const map = new Map(accounts.map((account) => [account.id, account]));
    return map;
  }, [accounts]);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name,
      strategy: values.strategy,
      extraMonthlyAmount: values.extraMonthlyAmount,
      isActive: true,
      items: values.items.map((item) => ({
        accountId: item.accountId,
        annualInterestRate: item.annualInterestRate,
        minimumPayment: item.minimumPayment,
        priorityOverride:
          values.strategy === "CUSTOM" ? item.priorityOverride ?? null : null,
        paymentDayOfMonth: item.paymentDayOfMonth,
      })),
    };

    try {
      if (isEditing && plan) {
        await updateMutation.mutateAsync({ id: plan.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error ? error.message : "Failed to save debt plan",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit debt payoff plan" : "Create debt payoff plan"}
          </DialogTitle>
          <DialogDescription>
            Set interest rates and minimum payments, choose avalanche or snowball,
            and add an optional extra monthly amount to pay down debt faster.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan name</FormLabel>
                  <FormControl>
                    <Input placeholder="My debt payoff plan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="strategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strategy</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="AVALANCHE">
                          Avalanche (highest APR first)
                        </SelectItem>
                        <SelectItem value="SNOWBALL">
                          Snowball (lowest balance first)
                        </SelectItem>
                        <SelectItem value="CUSTOM">Custom priority</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Avalanche usually saves more interest; snowball clears small
                      debts first for momentum.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="extraMonthlyAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Extra monthly amount</FormLabel>
                    <FormControl>
                      <MoneyInput
                        value={field.value}
                        onValueChange={(value) => field.onChange(value ?? 0)}
                        decimalScale={2}
                      />
                    </FormControl>
                    <FormDescription>
                      Applied to the current focus debt after minimums.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Debts in this plan</p>
                  <p className="text-xs text-muted-foreground">
                    APR is annual percent (for example 18.5 for 18.5%).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={availableToAdd.length === 0}
                  onClick={() => {
                    const next = availableToAdd[0];
                    if (!next) return;
                    append({
                      accountId: next.id,
                      annualInterestRate: 0,
                      minimumPayment: Math.max(next.balance * 0.02, 1),
                      priorityOverride: fields.length + 1,
                      paymentDayOfMonth: 1,
                    });
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add debt
                </Button>
              </div>

              {accountsLoading && (
                <p className="text-sm text-muted-foreground">Loading accounts…</p>
              )}

              {!accountsLoading && accounts.length === 0 && (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No active loan or credit card accounts found. Add a liability
                  account first.
                </p>
              )}

              {fields.map((field, index) => {
                const accountId = watchedItems[index]?.accountId;
                const account = accountId
                  ? accountById.get(accountId)
                  : undefined;
                return (
                  <div
                    key={field.id}
                    className="space-y-3 rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.accountId`}
                        render={({ field: accountField }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Account</FormLabel>
                            <Select
                              value={accountField.value}
                              onValueChange={accountField.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select liability" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {accounts.map((option) => {
                                  const takenElsewhere =
                                    selectedAccountIds.includes(option.id) &&
                                    option.id !== accountField.value;
                                  return (
                                    <SelectItem
                                      key={option.id}
                                      value={option.id}
                                      disabled={takenElsewhere}
                                    >
                                      {option.name} ·{" "}
                                      {formatCurrency(
                                        option.balance,
                                        option.currency
                                      )}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {account && (
                              <FormDescription>
                                Balance{" "}
                                {formatCurrency(account.balance, account.currency)}{" "}
                                ({account.type === "LOAN" ? "Loan" : "Credit card"})
                              </FormDescription>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-7 shrink-0"
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                        aria-label="Remove debt"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.annualInterestRate`}
                        render={({ field: rateField }) => (
                          <FormItem>
                            <FormLabel>APR (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                value={rateField.value}
                                onChange={(event) =>
                                  rateField.onChange(
                                    event.target.value === ""
                                      ? 0
                                      : Number(event.target.value)
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.minimumPayment`}
                        render={({ field: minField }) => (
                          <FormItem>
                            <FormLabel>Minimum payment</FormLabel>
                            <FormControl>
                              <MoneyInput
                                value={minField.value}
                                onValueChange={(value) =>
                                  minField.onChange(value ?? 0)
                                }
                                decimalScale={2}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {strategy === "CUSTOM" && (
                      <FormField
                        control={form.control}
                        name={`items.${index}.priorityOverride`}
                        render={({ field: priorityField }) => (
                          <FormItem>
                            <FormLabel>Priority (1 = first)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                value={priorityField.value ?? ""}
                                onChange={(event) =>
                                  priorityField.onChange(
                                    event.target.value === ""
                                      ? null
                                      : Number(event.target.value)
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
            {form.formState.errors.items?.message && (
              <p className="text-sm text-destructive">
                {form.formState.errors.items.message}
              </p>
            )}
            {form.formState.errors.items?.root?.message && (
              <p className="text-sm text-destructive">
                {form.formState.errors.items.root.message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || fields.length === 0}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save plan" : "Create plan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
