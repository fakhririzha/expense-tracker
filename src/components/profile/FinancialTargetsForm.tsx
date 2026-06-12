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
import { MoneyInput } from "@/components/ui/money-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const financialTargetsFormSchema = z.object({
  retirementTarget: z
    .number()
    .positive("Retirement target must be positive")
    .nullable(),
  monthlyBudget: z
    .number()
    .positive("Monthly budget target must be positive")
    .nullable(),
});

interface FinancialTargetsFormProps {
  defaultValues: FinancialTargetsInput;
  mainCurrency: string;
}

export function FinancialTargetsForm({
  defaultValues,
  mainCurrency,
}: FinancialTargetsFormProps) {
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const form = useForm<FinancialTargetsInput>({
    resolver: zodResolver(financialTargetsFormSchema),
    defaultValues,
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

        <FormField
          control={form.control}
          name="monthlyBudget"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monthly Budget Target</FormLabel>
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
                Your total spending limit for each calendar month in{" "}
                {mainCurrency}. Leave blank to remove it.
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
