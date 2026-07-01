"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { DepositoAnnualRateTooltip } from "@/components/deposito/DepositoAnnualRateTooltip";
import { useUpdateDeposito } from "@/hooks/useDepositoQueries";
import {
  DEPOSITO_INTEREST_FREQUENCIES,
  DEPOSITO_INTEREST_FREQUENCY_LABELS,
  DEPOSITO_TERM_MODES,
  DEPOSITO_TERM_MODE_LABELS,
} from "@/lib/deposito";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const editDepositoFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  interestFrequency: z.enum(DEPOSITO_INTEREST_FREQUENCIES),
  interestRate: z.number().positive("Interest rate must be greater than zero"),
  taxRate: z
    .union([z.number().min(0).max(100), z.nan()])
    .optional(),
  termMode: z.enum(DEPOSITO_TERM_MODES),
  maturityDate: z.string().optional(),
  description: z.string().optional(),
});

type EditDepositoFormValues = z.infer<typeof editDepositoFormSchema>;

interface DepositoForEdit {
  id: string;
  interestFrequency: (typeof DEPOSITO_INTEREST_FREQUENCIES)[number];
  interestRate: number;
  taxRate: number | null;
  termMode: (typeof DEPOSITO_TERM_MODES)[number];
  maturityDate: Date | null;
  account: {
    name: string;
    description: string | null;
  };
}

interface EditDepositoDialogProps {
  deposito: DepositoForEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function toDateInputValue(date: Date | null) {
  if (!date) return "";

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EditDepositoDialog({
  deposito,
  open,
  onOpenChange,
  onSuccess,
}: EditDepositoDialogProps) {
  const updateMutation = useUpdateDeposito();

  const form = useForm<EditDepositoFormValues>({
    resolver: zodResolver(editDepositoFormSchema),
    defaultValues: {
      name: "",
      interestFrequency: "MONTHLY",
      interestRate: 0,
      taxRate: Number.NaN,
      termMode: "OPEN_ENDED",
      maturityDate: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!deposito || !open) {
      return;
    }

    form.reset({
      name: deposito.account.name,
      interestFrequency: deposito.interestFrequency,
      interestRate: deposito.interestRate,
      taxRate: deposito.taxRate ?? Number.NaN,
      termMode: deposito.termMode,
      maturityDate: toDateInputValue(deposito.maturityDate),
      description: deposito.account.description ?? "",
    });
  }, [deposito, form, open]);

  const termMode = useWatch({
    control: form.control,
    name: "termMode",
  });

  const onSubmit = async (values: EditDepositoFormValues) => {
    if (!deposito) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: deposito.id,
        data: {
          ...values,
          taxRate: Number.isNaN(values.taxRate) ? null : values.taxRate,
          maturityDate:
            values.termMode === "FIXED_TERM"
              ? values.maturityDate || null
              : null,
        },
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error ? error.message : "Failed to update deposito.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Edit Deposito</DialogTitle>
          <DialogDescription>
            Update future deposito settings without rewriting past interest history.
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <Input {...field} value={field.value ?? ""} />
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
