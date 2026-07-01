"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark, Plus } from "lucide-react";

import { useAccounts } from "@/hooks/useAccountQueries";
import { useOpenDeposito } from "@/hooks/useDepositoQueries";
import { DepositoAnnualRateTooltip } from "@/components/deposito/DepositoAnnualRateTooltip";
import {
  DEPOSITO_INTEREST_FREQUENCIES,
  DEPOSITO_INTEREST_FREQUENCY_LABELS,
  DEPOSITO_TERM_MODES,
  DEPOSITO_TERM_MODE_LABELS,
} from "@/lib/deposito";
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
  DialogTrigger,
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

const openDepositoFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sourceAccountId: z.string().min(1, "Funding account is required"),
  amount: z.number().positive("Opening amount must be positive"),
  startDate: z.string().min(1, "Start date is required"),
  interestFrequency: z.enum(DEPOSITO_INTEREST_FREQUENCIES),
  interestRate: z.number().positive("Interest rate must be greater than zero"),
  taxRate: z
    .union([z.number().min(0).max(100), z.nan()])
    .optional(),
  termMode: z.enum(DEPOSITO_TERM_MODES),
  maturityDate: z.string().optional(),
  description: z.string().optional(),
});

type OpenDepositoFormValues = z.infer<typeof openDepositoFormSchema>;

interface OpenDepositoDialogProps {
  onSuccess?: () => void;
}

interface LiquidAccountOption {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  isActive: boolean;
}

function getLocalDateInputValue(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function OpenDepositoDialog({ onSuccess }: OpenDepositoDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: accountsData = [] } = useAccounts();
  const openMutation = useOpenDeposito();

  const fundingAccounts = useMemo(
    () =>
      (accountsData as LiquidAccountOption[]).filter(
        (account) => account.isActive && isLiquidAccountType(account.type)
      ),
    [accountsData]
  );

  const form = useForm<OpenDepositoFormValues>({
    resolver: zodResolver(openDepositoFormSchema),
    defaultValues: {
      name: "",
      sourceAccountId: "",
      amount: 0,
      startDate: getLocalDateInputValue(),
      interestFrequency: "MONTHLY",
      interestRate: 0,
      taxRate: Number.NaN,
      termMode: "OPEN_ENDED",
      maturityDate: "",
      description: "",
    },
  });

  const selectedSourceAccountId = useWatch({
    control: form.control,
    name: "sourceAccountId",
  });
  const termMode = useWatch({
    control: form.control,
    name: "termMode",
  });

  const selectedSourceAccount = fundingAccounts.find(
    (account) => account.id === selectedSourceAccountId
  );

  const onSubmit = async (values: OpenDepositoFormValues) => {
    try {
      await openMutation.mutateAsync({
        ...values,
        taxRate: Number.isNaN(values.taxRate) ? null : values.taxRate,
        maturityDate:
          values.termMode === "FIXED_TERM"
            ? values.maturityDate || null
            : null,
      });
      setOpen(false);
      form.reset({
        name: "",
        sourceAccountId: "",
        amount: 0,
        startDate: getLocalDateInputValue(),
        interestFrequency: "MONTHLY",
        interestRate: 0,
        taxRate: Number.NaN,
        termMode: "OPEN_ENDED",
        maturityDate: "",
        description: "",
      });
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error ? error.message : "Failed to open deposito.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Open Deposito
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Open Deposito</DialogTitle>
          <DialogDescription>
            Move funds from a bank or cash account into a locked deposito.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deposito Name</FormLabel>
                  <FormControl>
                    <Input placeholder="1 Month IDR Deposito" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Funding Account</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a bank or cash account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fundingAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedSourceAccount ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  {selectedSourceAccount.name}
                </div>
                <p className="mt-1 text-muted-foreground">
                  Available:{" "}
                  {formatCurrency(
                    selectedSourceAccount.balance,
                    selectedSourceAccount.currency
                  )}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Amount</FormLabel>
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
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="interestFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest Posting Schedule</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DEPOSITO_INTEREST_FREQUENCIES.map((frequency) => (
                          <SelectItem key={frequency} value={frequency}>
                            {DEPOSITO_INTEREST_FREQUENCY_LABELS[frequency]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This only controls how often interest is credited.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1">
                      <FormLabel>Interest Rate (% p.a.)</FormLabel>
                      <DepositoAnnualRateTooltip />
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={Number.isFinite(field.value) ? field.value : ""}
                        onChange={(event) =>
                          field.onChange(Number(event.target.value || 0))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the annual rate. FinHealth prorates it by the posting
                      schedule.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="termMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Term</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DEPOSITO_TERM_MODES.map((termModeOption) => (
                          <SelectItem key={termModeOption} value={termModeOption}>
                            {DEPOSITO_TERM_MODE_LABELS[termModeOption]}
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
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? Number.NaN
                              : Number(event.target.value)
                          )
                        }
                        placeholder="Optional"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {termMode === "FIXED_TERM" ? (
              <FormField
                control={form.control}
                name="maturityDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maturity Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Bank promo or branch note" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root ? (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={openMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={openMutation.isPending}>
                {openMutation.isPending ? "Opening..." : "Open Deposito"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
