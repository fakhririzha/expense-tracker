"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAccounts } from "@/hooks/useAccountQueries";
import { useCloseDeposito } from "@/hooks/useDepositoQueries";
import { isLiquidAccountType } from "@/lib/account-types";
import { formatCurrency } from "@/lib/utils";
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

const closeDepositoFormSchema = z.object({
  destinationAccountId: z.string().min(1, "Destination account is required"),
  closeDate: z.string().min(1, "Close date is required"),
  description: z.string().optional(),
});

type CloseDepositoFormValues = z.infer<typeof closeDepositoFormSchema>;

interface CloseDepositoDialogProps {
  deposito: {
    id: string;
    account: {
      id: string;
      name: string;
      balance: number;
      currency: string;
    };
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface LiquidAccountOption {
  id: string;
  name: string;
  type: string;
  currency: string;
  isActive: boolean;
}

function getLocalDateInputValue(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CloseDepositoDialog({
  deposito,
  open,
  onOpenChange,
  onSuccess,
}: CloseDepositoDialogProps) {
  const { data: accountsData = [] } = useAccounts();
  const closeMutation = useCloseDeposito();

  const destinationAccounts = useMemo(
    () =>
      (accountsData as LiquidAccountOption[]).filter(
        (account) =>
          account.isActive &&
          isLiquidAccountType(account.type) &&
          account.id !== deposito?.account.id &&
          account.currency === deposito?.account.currency
      ),
    [accountsData, deposito]
  );

  const form = useForm<CloseDepositoFormValues>({
    resolver: zodResolver(closeDepositoFormSchema),
    defaultValues: {
      destinationAccountId: "",
      closeDate: getLocalDateInputValue(),
      description: "",
    },
  });

  const onSubmit = async (values: CloseDepositoFormValues) => {
    if (!deposito) {
      return;
    }

    try {
      await closeMutation.mutateAsync({
        id: deposito.id,
        data: values,
      });
      onOpenChange(false);
      form.reset({
        destinationAccountId: "",
        closeDate: getLocalDateInputValue(),
        description: "",
      });
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error ? error.message : "Failed to close deposito.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-120">
        <DialogHeader>
          <DialogTitle>Close Deposito</DialogTitle>
          <DialogDescription>
            Transfer the full deposito balance back to a liquid account.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {deposito ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{deposito.account.name}</p>
                <p className="text-muted-foreground">
                  Payout amount:{" "}
                  {formatCurrency(
                    deposito.account.balance,
                    deposito.account.currency
                  )}
                </p>
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="destinationAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination Account</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a bank or cash account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {destinationAccounts.map((account) => (
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="closeDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Close Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {form.formState.errors.root ? (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={closeMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={closeMutation.isPending}>
                {closeMutation.isPending ? "Closing..." : "Close Deposito"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
