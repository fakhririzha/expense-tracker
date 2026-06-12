"use client";

import { AccountBalanceCard } from "@/components/liability/AccountBalanceCard";
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
import { useAccounts } from "@/hooks/useAccountQueries";
import {
  useRecordLoanDisbursement,
  useRecordReceivableRepayment,
} from "@/hooks/useReceivableQueries";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, HandCoins, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const receivableTransferFormSchema = z.object({
  sourceAccountId: z.string().min(1, "Source account is required"),
  targetAccountId: z.string().min(1, "Target account is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().optional(),
  date: z.date(),
});

type ReceivableTransferFormValues = z.infer<typeof receivableTransferFormSchema>;

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  isActive: boolean;
}

interface ReceivableTransferDialogProps {
  mode: "disbursement" | "repayment";
}

export function ReceivableTransferDialog({ mode }: ReceivableTransferDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: accounts = [] } = useAccounts();
  const disbursementMutation = useRecordLoanDisbursement();
  const repaymentMutation = useRecordReceivableRepayment();
  const isDisbursement = mode === "disbursement";
  const mutation = isDisbursement ? disbursementMutation : repaymentMutation;

  const activeAccounts = useMemo(
    () => (accounts as Account[]).filter((account) => account.isActive),
    [accounts]
  );
  const liquidAccounts = activeAccounts.filter(
    (account) => account.type === "BANK" || account.type === "CASH"
  );
  const receivableAccounts = activeAccounts.filter(
    (account) => account.type === "LOAN_RECEIVABLE"
  );

  const form = useForm<ReceivableTransferFormValues>({
    resolver: zodResolver(receivableTransferFormSchema),
    defaultValues: {
      sourceAccountId: "",
      targetAccountId: "",
      amount: 0,
      description: "",
      date: new Date(),
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedAmount = form.watch("amount");
  const watchedSourceId = form.watch("sourceAccountId");
  const watchedTargetId = form.watch("targetAccountId");

  const sourceOptions = isDisbursement ? liquidAccounts : receivableAccounts;
  const targetOptions = isDisbursement ? receivableAccounts : liquidAccounts;
  const selectedSource = activeAccounts.find((account) => account.id === watchedSourceId);
  const selectedTarget = activeAccounts.find((account) => account.id === watchedTargetId);
  const sameCurrency =
    selectedSource && selectedTarget
      ? selectedSource.currency === selectedTarget.currency
      : true;
  const hasInsufficientFunds =
    selectedSource && watchedAmount > 0 && selectedSource.balance < watchedAmount;

  const onSubmit = async (data: ReceivableTransferFormValues) => {
    try {
      await mutation.mutateAsync(data);
      setOpen(false);
      form.reset();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "Failed to record Loans Receivable transfer",
      });
    }
  };

  const title = isDisbursement ? "Record Loan Disbursement" : "Record Repayment";
  const buttonLabel = isDisbursement ? "Lend Funds" : "Record Repayment";
  const Icon = isDisbursement ? HandCoins : RotateCcw;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isDisbursement ? "default" : "outline"}>
          <Icon className="mr-2 h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-137.5 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isDisbursement
              ? "Move principal from cash into a receivable balance."
              : "Move repaid principal back into cash."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isDisbursement ? "From Account" : "Receivable Account"}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.clearErrors("root");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sourceOptions.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.balance.toLocaleString()} {account.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedSource && (
              <AccountBalanceCard
                accountName={selectedSource.name}
                accountType={selectedSource.type}
                balance={selectedSource.balance}
                currency={selectedSource.currency}
                highlightInsufficient={true}
                requiredAmount={watchedAmount}
              />
            )}

            <FormField
              control={form.control}
              name="targetAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isDisbursement ? "Receivable Account" : "To Account"}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.clearErrors("root");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {targetOptions.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.balance.toLocaleString()} {account.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedTarget && (
              <AccountBalanceCard
                accountName={selectedTarget.name}
                accountType={selectedTarget.type}
                balance={selectedTarget.balance}
                currency={selectedTarget.currency}
              />
            )}

            {!sameCurrency && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">
                  Source and target accounts must use the same currency.
                </p>
              </div>
            )}

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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        isDisbursement
                          ? "e.g., Loan principal disbursed"
                          : "e.g., Principal repayment"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.root.message}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  mutation.isPending ||
                  !sameCurrency ||
                  !!hasInsufficientFunds
                }
              >
                {mutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
