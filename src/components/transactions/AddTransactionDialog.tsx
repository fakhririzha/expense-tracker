"use client";

import { useAccounts } from "@/hooks/useAccountQueries";
import { useCreateTransaction } from "@/hooks/useTransactionQueries";
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
import { TransactionSplitEditor } from "@/components/transactions/TransactionSplitEditor";
import { isTransferAccountType } from "@/lib/account-types";
import { cn, formatCurrency } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, MapPin, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

function buildGoogleMapsLink(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

const transactionFormSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  description: z.string().optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  googleMapsLink: z.string().optional(),
  date: z.date(),
  accountId: z.string().min(1, "From account is required"),
  toAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  currency: z.string(),
  exchangeRate: z.number(),
  splits: z
    .array(
      z.object({
        categoryId: z.string().optional(),
        amount: z.number().nonnegative(),
        description: z.string().optional(),
      })
    )
    .default([]),
});

type TransactionFormInput = z.input<typeof transactionFormSchema>;
type TransactionFormValues = z.output<typeof transactionFormSchema>;

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: string;
}

interface AddTransactionDialogProps {
  onSuccess?: () => void;
}

/**
 * Display a dialog for creating a transaction (income, expense, or transfer).
 *
 * Attempts to create the transaction when the form is submitted; on success the dialog closes and the optional callback is invoked.
 *
 * @param onSuccess - Optional callback invoked after a transaction is successfully created
 * @returns The Add Transaction dialog React element
 */
export function AddTransactionDialog({ onSuccess }: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const { data: accountsData = [] } = useAccounts();
  const createMutation = useCreateTransaction();

  const accounts = accountsData.map(
    (a: {
      id: string;
      name: string;
      type: string;
      balance: number;
      currency: string;
    }) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.balance,
      currency: a.currency,
    })
  );
  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
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
  const selectedFromAccountId = form.watch("accountId");
  const splits = form.watch("splits") ?? [];
  const isSplitEnabled = splits.length > 0;
  const selectedFromAccount = accounts.find(
    (account) => account.id === selectedFromAccountId
  );

  const handleSplitToggle = (enabled: boolean) => {
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

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      form.setError("root", {
        message: "Geolocation is not supported by this browser.",
      });
      return;
    }

    setIsFetchingLocation(true);
    form.clearErrors("root");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        form.setValue("latitude", latitude, { shouldValidate: true });
        form.setValue("longitude", longitude, { shouldValidate: true });
        form.setValue("googleMapsLink", buildGoogleMapsLink(latitude, longitude), {
          shouldValidate: true,
        });
        setIsFetchingLocation(false);
      },
      () => {
        form.setError("root", {
          message: "Unable to retrieve your location. Permission may have been denied.",
        });
        setIsFetchingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  useEffect(() => {
    /**
     * Loads category data based on the selected transaction type.
     */
    async function loadCategories() {
      try {
        // Import prisma client
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

  const onSubmit = async (data: TransactionFormValues) => {
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
      await createMutation.mutateAsync({
        ...data,
        isRecurring: false,
        clientMutationId:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : undefined,
      });
      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to create transaction",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-160 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Record a new income, expense, or transfer transaction.
          </DialogDescription>
        </DialogHeader>
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
                    defaultValue={field.value}
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
                        // Clear toAccountId if same as from account
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
                    {selectedFromAccount ? (
                      <p className="text-xs text-muted-foreground">
                        Available balance:{" "}
                        {formatCurrency(
                          selectedFromAccount.balance,
                          selectedFromAccount.currency
                        )}
                      </p>
                    ) : null}
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
                    defaultValue={field.value}
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

            {selectedType !== "TRANSFER" && (
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
                          defaultValue={field.value}
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
                    disabled={createMutation.isPending}
                  />
                ) : null}
              </>
            )}

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
                        placeholder="Enter your latitude or use current location"
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
                        placeholder="Enter your longitude or use current location"
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

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleUseCurrentLocation}
                disabled={isFetchingLocation}
                className="w-full sm:w-auto"
              >
                {isFetchingLocation ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" />
                )}
                Use current location
              </Button>
              <p className="text-xs text-muted-foreground">
                Captures your browser-reported coordinates only when you choose to.
              </p>
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
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
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
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
