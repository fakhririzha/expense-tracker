"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Loader2, MinusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { getSellableInvestments, recordTrade } from "@/actions/investment-actions";
import { InvestmentAccountSelector } from "./InvestmentAccountSelector";
import { tradeHistoryKeys } from "@/hooks/useTradeHistory";
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
import { cn } from "@/lib/utils";

interface SellableInvestment {
  id: string;
  symbol: string;
  name: string | null;
  quantity: number;
  avgBuyPrice: number;
  currency: string;
}

const sellTradeFormSchema = z.object({
  assetId: z.string().min(1, "Asset is required"),
  quantity: z.number().positive("Quantity must be positive"),
  pricePerUnit: z.number().positive("Price per unit must be positive"),
  fees: z.number().min(0, "Fees cannot be negative"),
  date: z.date(),
  notes: z.string().optional(),
  accountId: z.string().min(1, "Investment account is required"),
});

type SellTradeFormValues = z.infer<typeof sellTradeFormSchema>;

interface RecordSellTradeDialogProps {
  onSuccess?: () => void;
}

/**
 * Display a modal dialog with a form to record a sell trade for an existing investment asset.
 *
 * The form validates inputs against the sell trade schema, provides an asset selector
 * showing only investments with available quantity, validates that sell quantity does
 * not exceed available quantity, and records the sell trade on submit. On successful
 * save, trade history cache entries are invalidated and the dialog resets.
 *
 * @param onSuccess - Optional callback invoked after a successful trade recording
 * @returns The dialog React element that contains the Record Sell Trade form
 */
export function RecordSellTradeDialog({ onSuccess }: RecordSellTradeDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [investments, setInvestments] = useState<SellableInvestment[]>([]);
  const [isLoadingInvestments, setIsLoadingInvestments] = useState(false);

  const form = useForm<SellTradeFormValues>({
    resolver: zodResolver(sellTradeFormSchema),
    defaultValues: {
      assetId: "",
      quantity: 0,
      pricePerUnit: 0,
      fees: 0,
      date: new Date(),
      notes: "",
      accountId: "",
    },
  });

  const selectedAssetId = form.watch("assetId");
  const selectedQuantity = form.watch("quantity");

  // Get the selected asset details for validation
  const selectedAsset = investments.find((inv) => inv.id === selectedAssetId);
  const maxAvailableQuantity = selectedAsset?.quantity ?? 0;

  // Custom validation for quantity
  const validateQuantity = (value: number) => {
    if (!selectedAssetId) {
      return "Please select an asset first";
    }
    if (value > maxAvailableQuantity) {
      return `Quantity cannot exceed available ${maxAvailableQuantity.toLocaleString()} units`;
    }
    return true;
  };

  useEffect(() => {
    async function loadInvestments() {
      setIsLoadingInvestments(true);
      try {
        const result = await getSellableInvestments();
        if (result.success && result.data) {
          setInvestments(result.data as SellableInvestment[]);
        } else {
          setInvestments([]);
        }
      } catch (error) {
        console.error("Failed to load sellable investments:", error);
        setInvestments([]);
      } finally {
        setIsLoadingInvestments(false);
      }
    }

    if (open) {
      loadInvestments();
    }
  }, [open]);

  const onSubmit = async (data: SellTradeFormValues) => {
    // Additional validation before submission
    const quantityValidation = validateQuantity(data.quantity);
    if (quantityValidation !== true) {
      form.setError("quantity", { message: quantityValidation });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recordTrade({
        ...data,
        type: "SELL",
      });

      if (result.success) {
        // Invalidate trade history cache for real-time updates
        queryClient.invalidateQueries({ queryKey: tradeHistoryKeys.all });

        setOpen(false);
        form.reset();
        onSuccess?.();
      } else {
        form.setError("root", {
          message: result.error || "Failed to record sell trade",
        });
      }
    } catch {
      form.setError("root", {
        message: "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MinusCircle className="mr-2 h-4 w-4" />
          Record Sell Trade
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Record Sell Trade</DialogTitle>
          <DialogDescription>
            Record a sell transaction for an existing investment. Select an asset
            with available quantity and enter the trade details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="assetId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investment Asset</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Reset quantity when asset changes
                      form.setValue("quantity", 0);
                    }}
                    value={field.value}
                    disabled={isLoadingInvestments}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isLoadingInvestments
                              ? "Loading investments..."
                              : investments.length === 0
                                ? "No available investments"
                                : "Select an asset"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {investments.map((investment) => (
                        <SelectItem key={investment.id} value={investment.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {investment.symbol}
                              {investment.name && (
                                <span className="ml-2 text-muted-foreground">
                                  ({investment.name})
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Available: {investment.quantity.toLocaleString()} units
                              {" "}• Avg Buy: {investment.avgBuyPrice.toLocaleString()}{" "}
                              {investment.currency}
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

            {selectedAsset && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available Quantity:</span>
                  <span className="font-medium">
                    {selectedAsset.quantity.toLocaleString()} units
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Average Buy Price:</span>
                  <span className="font-medium">
                    {selectedAsset.avgBuyPrice.toLocaleString()}{" "}
                    {selectedAsset.currency}
                  </span>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Sell</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.00000001"
                      placeholder="0"
                      {...field}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        field.onChange(value);
                        // Clear quantity error when user changes value
                        if (form.formState.errors.quantity) {
                          form.clearErrors("quantity");
                        }
                      }}
                    />
                  </FormControl>
                  {selectedAsset && selectedQuantity > maxAvailableQuantity && (
                    <p className="text-sm font-medium text-destructive mt-1">
                      Quantity exceeds available {maxAvailableQuantity.toLocaleString()} units
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pricePerUnit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sell Price per Unit</FormLabel>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fees (Optional)</FormLabel>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Trade Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
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

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Add notes about this trade..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit To Account</FormLabel>
                  <FormControl>
                    <InvestmentAccountSelector
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isSubmitting}
                      showBalance={true}
                      label="Investment Account"
                      placeholder="Select account to credit proceeds"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trade Summary */}
            {selectedAsset && selectedQuantity > 0 && (
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium mb-2">Trade Summary</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Proceeds:</span>
                    <span>
                      {(selectedQuantity * (form.watch("pricePerUnit") || 0)).toLocaleString()}{" "}
                      {selectedAsset.currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fees:</span>
                    <span>
                      {(form.watch("fees") || 0).toLocaleString()}{" "}
                      {selectedAsset.currency}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>Net Proceeds:</span>
                    <span>
                      {(
                        selectedQuantity * (form.watch("pricePerUnit") || 0) -
                        (form.watch("fees") || 0)
                      ).toLocaleString()}{" "}
                      {selectedAsset.currency}
                    </span>
                  </div>
                </div>
              </div>
            )}

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
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !selectedAssetId ||
                  selectedQuantity <= 0 ||
                  selectedQuantity > maxAvailableQuantity
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  "Record Sell Trade"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
