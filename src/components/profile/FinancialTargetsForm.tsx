"use client";

import {
  updateFinancialTargets,
  type FinancialTargetsInput,
} from "@/actions/profile-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  calculateRetirementProjection,
  getRetirementDate,
} from "@/lib/retirement-projection";
import { formatCurrency, formatDate } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const financialTargetsFormSchema = z
  .object({
    retirementTarget: z
      .number()
      .positive("Retirement target must be positive")
      .nullable(),
    monthlyBudget: z
      .number()
      .positive("Overall monthly spending limit must be positive")
      .nullable(),
    dateOfBirth: z.string().date("Enter a valid date of birth").nullable(),
    retirementAge: z
      .number()
      .int("Retirement age must be a whole number")
      .min(1, "Retirement age must be at least 1")
      .max(120, "Retirement age must be 120 or less")
      .nullable(),
  })
  .superRefine((data, context) => {
    if (data.retirementAge !== null && !data.dateOfBirth) {
      context.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Add your date of birth before setting a retirement age",
      });
    }

    if (!data.dateOfBirth) {
      return;
    }

    const dateOfBirth = new Date(`${data.dateOfBirth}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateOfBirth > today) {
      context.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Date of birth cannot be in the future",
      });
    }

    if (data.retirementAge !== null) {
      const retirementDate = getRetirementDate(
        data.dateOfBirth,
        data.retirementAge
      );

      if (!retirementDate || retirementDate <= today) {
        context.addIssue({
          code: "custom",
          path: ["retirementAge"],
          message: "Retirement age must result in a future retirement date",
        });
      }
    }
  });

interface FinancialTargetsFormProps {
  defaultValues: FinancialTargetsInput;
  mainCurrency: string;
  currentNetWorth: number | null;
}

function getTodayDateInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function FinancialTargetsForm({
  defaultValues,
  mainCurrency,
  currentNetWorth,
}: FinancialTargetsFormProps) {
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const form = useForm<FinancialTargetsInput>({
    resolver: zodResolver(financialTargetsFormSchema),
    defaultValues,
  });
  const retirementTarget = useWatch({
    control: form.control,
    name: "retirementTarget",
  });
  const dateOfBirth = useWatch({
    control: form.control,
    name: "dateOfBirth",
  });
  const retirementAge = useWatch({
    control: form.control,
    name: "retirementAge",
  });
  const projection = calculateRetirementProjection({
    retirementTarget,
    currentNetWorth,
    dateOfBirth,
    retirementAge,
  });

  const onSubmit = async (data: FinancialTargetsInput) => {
    setSuccessMessage(null);
    form.clearErrors("root");

    const result = await updateFinancialTargets(data);
    if (!result.success) {
      form.setError("root", {
        message: result.error || "Failed to update financial targets",
      });
      return;
    }

    setSuccessMessage("Financial targets updated.");
    router.refresh();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="retirementTarget"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Retirement Target</FormLabel>
              <FormControl>
                <MoneyInput
                  placeholder="e.g. 5000000000"
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  disabled={form.formState.isSubmitting}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormDescription>
                Your long-term net worth goal in {mainCurrency}. Leave blank to
                remove it.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    name={field.name}
                    ref={field.ref}
                    value={field.value ?? ""}
                    max={getTodayDateInputValue()}
                    disabled={form.formState.isSubmitting}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      const value = event.target.value || null;
                      field.onChange(value);

                      if (!value) {
                        form.setValue("retirementAge", null, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Required before you can set a retirement age.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="retirementAge"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Retirement Age</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    name={field.name}
                    ref={field.ref}
                    value={field.value ?? ""}
                    min={1}
                    max={120}
                    step={1}
                    placeholder="e.g. 60"
                    disabled={!dateOfBirth || form.formState.isSubmitting}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      const value = event.target.value;
                      field.onChange(value ? Number(value) : null);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Choose the age when you want to retire. Leave blank to remove it.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="neo-border bg-secondary p-4 text-sm">
          {projection ? (
            <>
              <p className="font-black uppercase tracking-wide">
                Monthly retirement savings target
              </p>
              <p className="mt-1 text-lg font-black">
                {formatCurrency(projection.requiredMonthlySavings, mainCurrency)}
                <span className="ml-1 text-sm font-bold">per month</span>
              </p>
              <p className="mt-1 font-medium text-muted-foreground">
                Save this for {projection.monthsRemaining} months to reach your
                target by {formatDate(projection.retirementDate)}. This estimate
                uses your current net worth and does not assume investment growth.
              </p>
            </>
          ) : (
            <p className="font-medium text-muted-foreground">
              {!retirementTarget
                ? "Add a retirement target to calculate your monthly savings goal."
                : currentNetWorth === null
                  ? "Your monthly savings projection is unavailable while net worth is loading."
                  : !dateOfBirth
                    ? "Add your date of birth, then choose a retirement age to calculate your monthly savings goal."
                    : !retirementAge
                      ? "Choose a retirement age to calculate your monthly savings goal."
                      : "Your monthly savings projection is unavailable right now."}
            </p>
          )}
        </div>

        <FormField
          control={form.control}
          name="monthlyBudget"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Overall Monthly Spending Limit</FormLabel>
              <FormControl>
                <MoneyInput
                  placeholder="e.g. 10000000"
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  disabled={form.formState.isSubmitting}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormDescription>
                Your guardrail across all spending for each calendar month in{" "}
                {mainCurrency}. Category budgets are managed separately. Leave
                blank to remove it.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <Alert variant="destructive" className="neo-border rounded-none">
            <AlertDescription>
              {form.formState.errors.root.message}
            </AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="neo-border rounded-none bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-700" />
            <AlertDescription className="font-bold text-green-800">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          Save Targets
        </Button>
      </form>
    </Form>
  );
}
