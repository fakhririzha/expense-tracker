"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import type { SubscriptionListItem } from "@/actions/subscription-actions";
import { useAccounts } from "@/hooks/useAccountQueries";
import { useCategories } from "@/hooks/useCategoryQueries";
import {
  useCreateSubscription,
  useUpdateSubscription,
} from "@/hooks/useSubscriptionQueries";
import { cn } from "@/lib/utils";
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

const NONE_VALUE = "__none__";

const subscriptionFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    provider: z.string().trim().optional(),
    description: z.string().trim().optional(),
    amount: z.number().positive("Amount must be positive"),
    currency: z.string().trim().min(3, "Currency is required").max(3),
    billingCycle: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
    nextBillingDate: z.date(),
    startDate: z.date().nullable().optional(),
    trialEndDate: z.date().nullable().optional(),
    cancellationDate: z.date().nullable().optional(),
    status: z.enum(["ACTIVE", "TRIAL", "PAUSED", "CANCELLED"]),
    categoryId: z.string(),
    accountId: z.string(),
    cancellationUrl: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "TRIAL" && !data.trialEndDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Trial end date is required for trial subscriptions",
        path: ["trialEndDate"],
      });
    }

    if (data.startDate && data.startDate > data.nextBillingDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date cannot be after the next billing date",
        path: ["startDate"],
      });
    }

    if (data.trialEndDate && data.trialEndDate > data.nextBillingDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Trial end date cannot be after the next billing date",
        path: ["trialEndDate"],
      });
    }

    if (data.cancellationUrl) {
      try {
        new URL(data.cancellationUrl);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cancellation URL must be a valid URL",
          path: ["cancellationUrl"],
        });
      }
    }
  });

type SubscriptionFormValues = z.infer<typeof subscriptionFormSchema>;

interface SubscriptionFormDialogProps {
  mode: "create" | "edit";
  subscription?: SubscriptionListItem | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

function DatePickerField({
  value,
  onChange,
  placeholder,
}: {
  value?: Date | null;
  onChange: (value: Date | undefined) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "MMM d, yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value ?? undefined} onSelect={onChange} />
      </PopoverContent>
    </Popover>
  );
}

function getDefaultValues(subscription?: SubscriptionListItem | null): SubscriptionFormValues {
  return {
    name: subscription?.name ?? "",
    provider: subscription?.provider ?? "",
    description: subscription?.description ?? "",
    amount: subscription?.amount ?? 0,
    currency: subscription?.currency ?? "IDR",
    billingCycle: subscription?.billingCycle ?? "MONTHLY",
    nextBillingDate: subscription ? new Date(subscription.nextBillingDate) : new Date(),
    startDate: subscription?.startDate ? new Date(subscription.startDate) : null,
    trialEndDate: subscription?.trialEndDate ? new Date(subscription.trialEndDate) : null,
    cancellationDate: subscription?.cancellationDate
      ? new Date(subscription.cancellationDate)
      : null,
    status:
      subscription?.effectiveStatus === "EXPIRED" || subscription?.status === "EXPIRED"
        ? "CANCELLED"
        : subscription?.status ?? "ACTIVE",
    categoryId: subscription?.categoryId ?? NONE_VALUE,
    accountId: subscription?.accountId ?? NONE_VALUE,
    cancellationUrl: subscription?.cancellationUrl ?? "",
    notes: subscription?.notes ?? "",
  };
}

export function SubscriptionFormDialog({
  mode,
  subscription,
  open,
  onOpenChange,
  onSuccess,
  trigger,
}: SubscriptionFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const createMutation = useCreateSubscription();
  const updateMutation = useUpdateSubscription();
  const { data: accountsData = [] } = useAccounts();
  const { data: categoriesData = [] } = useCategories("EXPENSE");
  const accounts = accountsData as Array<{ id: string; name: string }>;
  const categories = categoriesData as Array<{
    id: string;
    name: string;
    icon: string | null;
  }>;

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: getDefaultValues(subscription),
  });

  const status = useWatch({
    control: form.control,
    name: "status",
    defaultValue: "ACTIVE",
  });

  useEffect(() => {
    if (!resolvedOpen) {
      return;
    }

    form.reset(getDefaultValues(subscription));
  }, [form, resolvedOpen, subscription]);

  const onSubmit = async (values: SubscriptionFormValues) => {
    try {
      const payload = {
        name: values.name,
        provider: values.provider || null,
        description: values.description || null,
        amount: values.amount,
        currency: values.currency,
        billingCycle: values.billingCycle,
        nextBillingDate: values.nextBillingDate,
        startDate: values.startDate,
        trialEndDate: values.status === "TRIAL" ? values.trialEndDate : null,
        cancellationDate:
          values.status === "CANCELLED" ? values.cancellationDate ?? new Date() : null,
        status: values.status,
        categoryId: values.categoryId === NONE_VALUE ? null : values.categoryId,
        accountId: values.accountId === NONE_VALUE ? null : values.accountId,
        cancellationUrl: values.cancellationUrl || null,
        notes: values.notes || null,
      };

      if (mode === "create") {
        await createMutation.mutateAsync(payload);
      } else if (subscription) {
        await updateMutation.mutateAsync({
          id: subscription.id,
          data: payload,
        });
      }

      setOpen(false);
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to save subscription",
      });
    }
  };

  const dialogContent = (
    <DialogContent className="sm:max-w-175 max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Add Subscription" : "Edit Subscription"}
        </DialogTitle>
        <DialogDescription>
          Track billing details and optionally link the subscription to a recurring rule later.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Basics</h3>
              <p className="text-sm text-muted-foreground">
                Core subscription details and provider context.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Netflix Premium" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <FormControl>
                      <Input placeholder="Netflix" {...field} value={field.value ?? ""} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Streaming subscription for the family"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Billing</h3>
              <p className="text-sm text-muted-foreground">
                Amount, currency, cycle, and next renewal date.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Input placeholder="USD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="billingCycle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Cycle</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select cycle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nextBillingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Billing Date</FormLabel>
                    <FormControl>
                      <DatePickerField
                        value={field.value}
                        onChange={(value) => value && field.onChange(value)}
                        placeholder="Pick the next billing date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Lifecycle</h3>
              <p className="text-sm text-muted-foreground">
                Track trials, pauses, and cancellations.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) =>
                        field.onChange(
                          value as SubscriptionFormValues["status"]
                        )
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="TRIAL">Trial</SelectItem>
                        <SelectItem value="PAUSED">Paused</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <DatePickerField
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? null)}
                        placeholder="Pick the start date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {status === "TRIAL" && (
              <FormField
                control={form.control}
                name="trialEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trial End Date</FormLabel>
                    <FormControl>
                      <DatePickerField
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? null)}
                        placeholder="Pick the trial end date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {status === "CANCELLED" && (
              <FormField
                control={form.control}
                name="cancellationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cancellation Date</FormLabel>
                    <FormControl>
                      <DatePickerField
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? null)}
                        placeholder="Pick the cancellation date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Classification</h3>
              <p className="text-sm text-muted-foreground">
                Categorize the subscription and store management details.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>No category</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.icon ? `${category.icon} ` : ""}
                            {category.name}
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
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Account</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>No account</SelectItem>
                        {accounts.map((account) => (
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
            </div>

            <FormField
              control={form.control}
              name="cancellationUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cancellation URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://..."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Login reminder, family plan details, or other notes"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {form.formState.errors.root?.message && (
            <p className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? mode === "create"
                  ? "Creating..."
                  : "Saving..."
                : mode === "create"
                  ? "Create Subscription"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );

  return (
    <Dialog open={resolvedOpen} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Subscription
            </Button>
          )}
        </DialogTrigger>
      )}
      {dialogContent}
    </Dialog>
  );
}
