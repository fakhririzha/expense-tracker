"use client";

import { updateAccount } from "@/actions/account-actions";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const editAccountFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["BANK", "CASH", "INVESTMENT", "LOAN", "CREDIT_CARD"]),
  currency: z.string(),
  balance: z.number(),
  description: z.string().optional(),
  isActive: z.boolean(),
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditAccountFormValues>({
    resolver: zodResolver(editAccountFormSchema),
    defaultValues: {
      name: "",
      type: "BANK",
      currency: "IDR",
      balance: 0,
      description: "",
      isActive: true,
    },
  });

  // Reset form with account data when account changes
  useEffect(() => {
    if (account && open) {
      // For liability accounts (LOAN, CREDIT_CARD), convert balance to positive for display
      const displayBalance =
        account.type === "LOAN" || account.type === "CREDIT_CARD"
          ? Math.abs(account.balance)
          : account.balance;

      form.reset({
        name: account.name,
        type: account.type as EditAccountFormValues["type"],
        currency: account.currency,
        balance: displayBalance,
        description: account.description || "",
        isActive: account.isActive,
      });
    }
  }, [account, open, form]);

  const onSubmit = async (data: EditAccountFormValues) => {
    if (!account) return;

    setIsSubmitting(true);
    try {
      let submitData = data;

      // For liability accounts, convert balance to negative
      if (data.type === "LOAN" || data.type === "CREDIT_CARD") {
        submitData = { ...data, balance: Math.abs(data.balance) * -1 };
      }

      const result = await updateAccount(account.id, submitData);

      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        form.setError("root", {
          message: result.error || "Failed to update account",
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
      <DialogContent className="sm:max-w-[500px]">
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
                disabled={isSubmitting}
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
