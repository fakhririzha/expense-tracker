"use client";

import { useAccounts } from "@/hooks/useAccountQueries";
import { useUpdateTransaction } from "@/hooks/useTransactionQueries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { TransactionSplitEditor } from "@/components/transactions/TransactionSplitEditor";
import { isTransferAccountType } from "@/lib/account-types";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { AlertCircle, CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const editTransactionFormSchema = z
  .object({
    amount: z.number().positive("Amount must be positive"),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    description: z.string().optional(),
    location: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    googleMapsLink: z.string().optional(),
    date: z.date(),
    accountId: z.string().min(1, "Account is required"),
    toAccountId: z.string().optional(),
    categoryId: z.string().optional(),
    currency: z.string().optional(),
    exchangeRate: z.number().optional(),
    splits: z
      .array(
        z.object({
          categoryId: z.string().optional(),
          amount: z.number().nonnegative(),
          description: z.string().optional(),
        })
      )
      .default([]),
  })
  .refine(
    (data) => {
      // For TRANSFER type, toAccountId is required
      if (data.type === "TRANSFER") {
        return !!data.toAccountId && data.toAccountId.length > 0;
      }
      return true;
    },
    {
      message: "Destination account is required for transfers",
      path: ["toAccountId"],
    }
  )
  .refine(
    (data) => {
      // From and To accounts must be different for transfers
      if (data.type === "TRANSFER" && data.toAccountId) {
        return data.accountId !== data.toAccountId;
      }
      return true;
    },
    {
      message: "Source and destination accounts must be different",
      path: ["toAccountId"],
    }
  );

type EditTransactionFormInput = z.input<typeof editTransactionFormSchema>;
type EditTransactionFormValues = z.output<typeof editTransactionFormSchema>;

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "LIABILITY_PAYMENT";
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsLink: string | null;
  date: Date;
  currency: string;
  exchangeRate: number;
  toAccountId: string | null;
  account: {
    id: string;
    name: string;
    type: string;
  };
  category: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
  splits: Array<{
    id: string;
    amount: number;
    description: string | null;
    sortOrder: number;
    categoryId: string | null;
    category: {
      id: string;
      name: string;
      icon: string | null;
    } | null;
  }>;
}

interface EditTransactionDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Display a dialog for editing an existing transaction.
 *
 * Pre-populates the form with the transaction's current data and allows editing
 * amount, description, date, category, and account. On success, the dialog closes
 * and the optional callback is invoked.
 *
 * @param transaction - The transaction to edit, or null if no transaction is selected
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback to control the dialog's open state
 * @param onSuccess - Optional callback invoked after a transaction is successfully updated
 * @returns The Edit Transaction dialog React element
 */
export function EditTransactionDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: EditTransactionDialogProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  const { data: accountsData = [] } = useAccounts();
  const updateMutation = useUpdateTransaction();

  const accounts = accountsData.map((a: { id: string; name: string; type: string }) => ({
    id: a.id,
    name: a.name,
    type: a.type,
  }));
  const form = useForm<EditTransactionFormInput, unknown, EditTransactionFormValues>({
    resolver: zodResolver(editTransactionFormSchema),
    defaultValues: {
      amount: 0,
      type: "EXPENSE",
      description: "",
      location: "",
      latitude: undefined,
      longitude: undefined,
      googleMapsLink: "",
      date: new Date(),
      accountId: "",
      toAccountId: "",
      categoryId: "",
      currency: "IDR",
      exchangeRate: 1,
      splits: [],
    },
  });

  const selectedType = form.watch("type");
  const splits = form.watch("splits") ?? [];
  const isSplitEnabled = splits.length > 0;

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction && open) {
      form.reset({
        amount: transaction.amount,
        type: transaction.type === "LIABILITY_PAYMENT" ? "EXPENSE" : transaction.type,
        description: transaction.description || "",
        location: transaction.location || "",
        latitude: transaction.latitude ?? undefined,
        longitude: transaction.longitude ?? undefined,
        googleMapsLink: transaction.googleMapsLink || "",
        date: new Date(transaction.date),
        accountId: transaction.account.id,
        toAccountId: transaction.toAccountId || "",
        categoryId: transaction.category?.id || "",
        currency: transaction.currency,
        exchangeRate: transaction.exchangeRate,
        splits: transaction.splits.map((split) => ({
          categoryId: split.categoryId || "",
          amount: split.amount,
          description: split.description || "",
        })),
      });
    }
  }, [transaction, open, form]);

  const handleSplitToggle = (enabled: boolean) => {
    if (!transaction) return;

    if (!enabled) {
      const firstSplitCategoryId = form.getValues("splits.0.categoryId");
      if (!form.getValues("categoryId") && firstSplitCategoryId) {
        form.setValue("categoryId", firstSplitCategoryId, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      form.setValue("splits", [], { shouldDirty: true, shouldValidate: true });
      return;
    }

    const totalAmount = form.getValues("amount");
    const parentCategoryId = form.getValues("categoryId");
    form.setValue(
      "splits",
      [
        {
          categoryId: parentCategoryId || "",
          amount: totalAmount > 0 ? totalAmount : 0,
          description: "",
        },
        {
          categoryId: "",
          amount: 0,
          description: "",
        },
      ],
      { shouldDirty: true, shouldValidate: true }
    );
    form.setValue("categoryId", "", { shouldDirty: true, shouldValidate: true });
  };

  // Fetch categories from database based on transaction type
  useEffect(() => {
    /**
     * Fetches categories for the currently selected transaction type and updates component state.
     *
     * If the request fails or an error occurs, logs the failure to the console.
     */
    async function loadCategories() {
      try {
        const response = await fetch(`/api/categories?type=${selectedType}`);
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        }
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    }
    if (open && selectedType) {
      loadCategories();
    }
  }, [open, selectedType]);

  useEffect(() => {
    if (selectedType !== "EXPENSE" && isSplitEnabled) {
      form.setValue("splits", [], { shouldDirty: true, shouldValidate: true });
    }
  }, [form, isSplitEnabled, selectedType]);

  const onSubmit = async (data: EditTransactionFormValues) => {
    if (!transaction) return;

    if (
      data.type === "EXPENSE" &&
      data.splits.length > 0 &&
      Math.abs(
        data.amount - data.splits.reduce((sum, split) => sum + (split.amount || 0), 0)
      ) > 0.005
    ) {
      form.setError("root", {
        message: "Split amounts must exactly equal the parent amount.",
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: transaction.id,
        data: {
          amount: data.amount,
          type: data.type,
          description: data.description,
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude,
          googleMapsLink: data.googleMapsLink,
          date: data.date,
          currency: data.currency,
          exchangeRate: data.exchangeRate,
          accountId: data.accountId,
          toAccountId: data.toAccountId,
          categoryId: data.categoryId,
          splits: data.splits,
        },
      });
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to update transaction",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-160 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Update the transaction details below.
          </DialogDescription>
        </DialogHeader>
        
        {/* Show informative message for LIABILITY_PAYMENT transactions */}
        {transaction?.type === "LIABILITY_PAYMENT" ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Liability Payment transactions cannot be edited here.</strong>
                <br />
                These transactions involve special accounting rules and should be managed through the Liabilities page to ensure proper balance tracking.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      <SelectItem value="INCOME">Income</SelectItem>
                      <SelectItem value="EXPENSE">Expense</SelectItem>
                      <SelectItem value="TRANSFER">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            {selectedType === "TRANSFER" ? (
              <>
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Account</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          if (form.getValues("toAccountId") === value) {
                            form.setValue("toAccountId", "");
                          }
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source account" />
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts
                          .filter((account) => isTransferAccountType(account.type))
                          .map((account) => (
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

                <FormField
                  control={form.control}
                  name="toAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Account</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination account" />
                          </SelectTrigger>
                        </FormControl>
                      <SelectContent>
                        {accounts
                          .filter(
                            (account) =>
                              isTransferAccountType(account.type) &&
                              // eslint-disable-next-line react-hooks/incompatible-library
                              account.id !== form.watch("accountId")
                          )
                            .map((account) => (
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
              </>
            ) : (
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
            )}

            {selectedType !== "TRANSFER" ? (
              <>
                {!isSplitEnabled ? (
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category (Optional)</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.icon} {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {selectedType === "EXPENSE" ? (
                  <TransactionSplitEditor
                    control={form.control}
                    watch={form.watch}
                    setValue={form.setValue}
                    categories={categories}
                    onToggle={handleSplitToggle}
                    disabled={updateMutation.isPending}
                  />
                ) : null}
              </>
            ) : null}

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
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Place, address, or venue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="-6.200000"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : parseFloat(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="106.816666"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : parseFloat(e.target.value)
                          )
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
              name="googleMapsLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google Maps Link (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://www.google.com/maps/search/?api=1&query=..."
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
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

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
                {updateMutation.isPending ? "Updating..." : "Update Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
