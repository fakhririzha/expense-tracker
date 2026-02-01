"use client";

// import { getBankAccounts, getLiabilityAccounts } from "@/lib/liability-payment-validation";
import {
  createLiabilityPayment,
  generatePaymentReference,
} from "@/actions/liability-payment-actions";
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
import { AccountBalanceCard } from "./AccountBalanceCard";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, CreditCard, RefreshCw, Landmark } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const paymentFormSchema = z.object({
  sourceAccountId: z.string().min(1, "Source bank account is required"),
  targetAccountId: z.string().min(1, "Target liability account is required"),
  amount: z.number().positive("Payment amount must be greater than 0"),
  description: z.string().min(1, "Description is required"),
  date: z.date(),
  referenceNumber: z.string().min(1, "Reference number is required"),
  allowOverpayment: z.boolean(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface LiabilityPaymentDialogProps {
  preselectedLiabilityId?: string;
}

/**
 * Renders a modal dialog that lets the user pay a liability from a selected bank account.
 *
 * The dialog fetches bank and liability accounts when opened, auto-generates a payment reference,
 * validates payment amount against the selected accounts (insufficient funds, outstanding balance,
 * and maximum payable), and submits a liability payment. UI includes source/target account selectors,
 * balance displays, reference generator, description, and date picker.
 *
 * @param preselectedLiabilityId - Optional liability account id to preselect and lock the "Pay To" field.
 * @returns The LiabilityPaymentDialog React element.
 */
export function LiabilityPaymentDialog({
  preselectedLiabilityId,
}: LiabilityPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [liabilityAccounts, setLiabilityAccounts] = useState<Account[]>([]);
  const [selectedSourceAccount, setSelectedSourceAccount] = useState<Account | null>(null);
  const [selectedTargetAccount, setSelectedTargetAccount] = useState<Account | null>(null);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      sourceAccountId: "",
      targetAccountId: preselectedLiabilityId || "",
      amount: 0,
      description: "",
      date: new Date(),
      referenceNumber: "",
      allowOverpayment: false,
    },
  });

  const watchedAmount = form.watch("amount");
  const watchedSourceId = form.watch("sourceAccountId");
  const watchedTargetId = form.watch("targetAccountId");

  // Generate reference number
  const generateReference = useCallback(async () => {
    const result = await generatePaymentReference();
    if (result.success && result.reference) {
      form.setValue("referenceNumber", result.reference);
    }
  }, [form]);

  // Load accounts when dialog opens
  useEffect(() => {
    async function loadAccounts() {
      try {
        // Since getBankAccounts and getLiabilityAccounts are server functions,
        // we need to call them from a separate API route or use client-side fetching
        // For now, we'll fetch through a simple API endpoint
        const response = await fetch("/api/accounts/by-type");
        if (response.ok) {
          const data = await response.json();
          setBankAccounts(data.bankAccounts || []);
          setLiabilityAccounts(data.liabilityAccounts || []);
        }
      } catch (error) {
        console.error("Failed to load accounts:", error);
      }
    }

    if (open) {
      loadAccounts();
      generateReference();
    }
  }, [open, generateReference]);

  // Update selected accounts when form values change
  useEffect(() => {
    const source = bankAccounts.find((a) => a.id === watchedSourceId);
    const target = liabilityAccounts.find((a) => a.id === watchedTargetId);
    setSelectedSourceAccount(source || null);
    setSelectedTargetAccount(target || null);
  }, [watchedSourceId, watchedTargetId, bankAccounts, liabilityAccounts]);

  const onSubmit = async (data: PaymentFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await createLiabilityPayment({
        ...data,
        currency: selectedSourceAccount?.currency || "IDR",
        exchangeRate: 1,
      });

      if (result.success) {
        setOpen(false);
        form.reset();
      } else {
        form.setError("root", {
          message: result.error || "Failed to process payment",
        });
      }
    } catch (error) {
      form.setError("root", {
        message: "An unexpected error occurred. Please try again.",
      });
      console.error("Liability payment error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasInsufficientFunds =
    selectedSourceAccount &&
    watchedAmount > 0 &&
    selectedSourceAccount.balance < watchedAmount;

  const hasOutstandingBalance = selectedTargetAccount && selectedTargetAccount.balance < 0;
  const maxPayment = selectedTargetAccount ? Math.abs(selectedTargetAccount.balance) : 0;
  const exceedsBalance = watchedAmount > maxPayment && maxPayment > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CreditCard className="mr-2 h-4 w-4" />
          Pay Liability
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liability Payment</DialogTitle>
          <DialogDescription>
            Pay off a loan or credit card from your bank account.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Source Account Selection */}
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay From (Bank Account)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <Landmark className="h-4 w-4" />
                            <span>{account.name}</span>
                            <span className="text-muted-foreground">
                              ({account.balance.toLocaleString()} {account.currency})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedSourceAccount && (
              <AccountBalanceCard
                accountName={selectedSourceAccount.name}
                accountType={selectedSourceAccount.type}
                balance={selectedSourceAccount.balance}
                currency={selectedSourceAccount.currency}
                highlightInsufficient={true}
                requiredAmount={watchedAmount}
              />
            )}

            {/* Target Account Selection */}
            <FormField
              control={form.control}
              name="targetAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay To (Liability Account)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!!preselectedLiabilityId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select liability account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {liabilityAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span>{account.name}</span>
                            <span className="text-muted-foreground">
                              (Balance: {account.balance.toLocaleString()} {account.currency})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedTargetAccount && (
              <div
                className={cn(
                  "rounded-lg border p-3",
                  hasOutstandingBalance
                    ? "border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-900/20"
                    : "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Outstanding Balance
                    </p>
                    <p className="text-lg font-semibold">
                      {Math.abs(selectedTargetAccount.balance).toLocaleString()}{" "}
                      {selectedTargetAccount.currency}
                    </p>
                  </div>
                  {!hasOutstandingBalance && (
                    <p className="text-sm text-green-600">No outstanding balance</p>
                  )}
                </div>
              </div>
            )}

            {/* Payment Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount</FormLabel>
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
                  {exceedsBalance && (
                    <p className="text-sm text-destructive">
                      Payment amount exceeds outstanding balance. Maximum: {maxPayment.toLocaleString()}{" "}
                      {selectedTargetAccount?.currency}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference Number */}
            <FormField
              control={form.control}
              name="referenceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Number</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input {...field} readOnly className="bg-muted" />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={generateReference}
                      title="Generate new reference"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unique identifier for this payment transaction
                  </p>
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Monthly loan payment"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Date */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Payment Date</FormLabel>
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
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  hasInsufficientFunds ||
                  exceedsBalance ||
                  !hasOutstandingBalance
                }
              >
                {isSubmitting ? "Processing..." : "Make Payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}