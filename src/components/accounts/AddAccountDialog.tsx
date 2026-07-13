"use client";

import { useCreateAccount } from "@/hooks/useAccountQueries";
import { Button } from "@/components/ui/button";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ACCOUNT_TYPES, normalizeAccountBalanceForType } from "@/lib/account-types";
import { BANK_INTEREST_FREQUENCIES } from "@/lib/bank-interest";

const accountFormSchema = z
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

type AccountFormValues = z.infer<typeof accountFormSchema>;

interface AddAccountDialogProps {
  onSuccess?: () => void;
}

/**
 * Renders a dialog containing a form to create a new financial account.
 *
 * The dialog includes fields for name, type, currency, initial balance, description,
 * and an active flag. On successful submission the dialog closes and the form resets.
 *
 * @param onSuccess - Optional callback invoked after an account is successfully created
 * @returns The Add Account dialog React element containing the account creation form
 */
export function AddAccountDialog({ onSuccess }: AddAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateAccount();

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
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

  const onSubmit = async (data: AccountFormValues) => {
    try {
      const { bankInterest, ...accountData } = data;
      const tempData = {
        ...accountData,
        balance: normalizeAccountBalanceForType(data.type, data.balance),
        ...(data.type === "BANK" ? { bankInterest } : {}),
      };
      await createMutation.mutateAsync(tempData);
      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to create account",
      });
    }
  };

  const accountType = useWatch({ control: form.control, name: "type" });
  const bankInterestEnabled = useWatch({
    control: form.control,
    name: "bankInterest.enabled",
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>
            Create a new financial account to track your money.
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
                    <FormLabel>Initial Balance</FormLabel>
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
                {createMutation.isPending ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
