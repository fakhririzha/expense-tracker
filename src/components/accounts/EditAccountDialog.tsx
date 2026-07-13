"use client";

import { useUpdateAccount } from "@/hooks/useAccountQueries";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ACCOUNT_TYPES, normalizeAccountBalanceForType } from "@/lib/account-types";
import { BANK_INTEREST_FREQUENCIES } from "@/lib/bank-interest";

const editAccountFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(ACCOUNT_TYPES),
    currency: z.string(),
    balance: z.number(),
    description: z.string().optional(),
    isActive: z.boolean(),
    bankInterest: z.object({
      enabled: z.boolean(),
      annualRate: z.number().finite().min(0).max(100),
      frequency: z.enum(BANK_INTEREST_FREQUENCIES),
    }),
  })
  .superRefine((value, context) => {
    if (value.bankInterest.enabled && value.bankInterest.annualRate <= 0) {
      context.addIssue({
        code: "custom",
        path: ["bankInterest", "annualRate"],
        message: "Annual interest rate must be greater than zero",
      });
    }
  });

type EditAccountFormValues = z.infer<typeof editAccountFormSchema>;

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  description: string | null;
  isActive: boolean;
  bankInterestSetting: {
    enabled: boolean;
    annualRate: number;
    frequency: (typeof BANK_INTEREST_FREQUENCIES)[number];
    nextPostingDate: Date | null;
  } | null;
}

interface EditAccountDialogProps {
  account: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Renders a dialog containing a form to edit an existing financial account.
 *
 * Pre-populates the form with the account's current data and allows editing
 * name, type, currency, balance, description, and active status. On success,
 * the dialog closes and the optional callback is invoked.
 *
 * @param account - The account to edit, or null if no account is selected
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback to control dialog open state
 * @param onSuccess - Optional callback invoked after an account is successfully updated
 * @returns The Edit Account dialog React element containing the account edit form
 */
export function EditAccountDialog({
  account,
  open,
  onOpenChange,
  onSuccess,
}: EditAccountDialogProps) {
  const updateMutation = useUpdateAccount();

  const form = useForm<EditAccountFormValues>({
    resolver: zodResolver(editAccountFormSchema),
    defaultValues: {
      name: "",
      type: "BANK",
      currency: "IDR",
      balance: 0,
      description: "",
      isActive: true,
      bankInterest: {
        enabled: false,
        annualRate: 0,
        frequency: "MONTHLY",
      },
    },
  });

  // Reset form with account data when account changes
  useEffect(() => {
    if (account && open) {
      // For liability accounts (LOAN, CREDIT_CARD), convert balance to positive for display
      const displayBalance =
        account.type === "LOAN" ||
        account.type === "CREDIT_CARD" ||
        account.type === "LOAN_RECEIVABLE"
          ? Math.abs(account.balance)
          : account.balance;

      form.reset({
        name: account.name,
        type: account.type as EditAccountFormValues["type"],
        currency: account.currency,
        balance: displayBalance,
        description: account.description || "",
        isActive: account.isActive,
        bankInterest: {
          enabled: account.bankInterestSetting?.enabled ?? false,
          annualRate: account.bankInterestSetting?.annualRate ?? 0,
          frequency: account.bankInterestSetting?.frequency ?? "MONTHLY",
        },
      });
    }
  }, [account, open, form]);

  const onSubmit = async (data: EditAccountFormValues) => {
    if (!account) return;

    try {
      const { bankInterest, ...accountData } = data;
      const submitData = {
        ...accountData,
        balance: normalizeAccountBalanceForType(data.type, data.balance),
        ...(data.type === "BANK" ? { bankInterest } : {}),
      };

      await updateMutation.mutateAsync({ id: account.id, data: submitData });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to update account",
      });
    }
  };

  const accountType = useWatch({ control: form.control, name: "type" });
  const bankInterestEnabled = useWatch({
    control: form.control,
    name: "bankInterest.enabled",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>
            Update the details of your financial account.
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
                    <Input placeholder="My Bank Account" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {accountType === "BANK" && (
              <div className="space-y-4 rounded-lg border p-4">
                <FormField
                  control={form.control}
                  name="bankInterest.enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4">
                      <div>
                        <FormLabel>Automatically add bank interest</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Credit interest as categorized income on schedule.
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

                {bankInterestEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bankInterest.annualRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual rate (% p.a.)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0.0001"
                              max="100"
                              step="0.0001"
                              value={field.value}
                              onChange={(event) =>
                                field.onChange(Number(event.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bankInterest.frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit frequency</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="DAILY">Daily</SelectItem>
                              <SelectItem value="MONTHLY">Monthly</SelectItem>
                              <SelectItem value="YEARLY">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            )}

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
                      <SelectItem value="BANK">Bank Account</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="INVESTMENT">Investment</SelectItem>
                      <SelectItem value="LOAN">Loan</SelectItem>
                      <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                      <SelectItem value="LOAN_RECEIVABLE">Loans Receivable</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Input placeholder="IDR" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Balance</FormLabel>
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
            </div>

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

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "true")}
                    value={field.value ? "true" : "false"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Inactive accounts are excluded from calculations
                  </p>
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
