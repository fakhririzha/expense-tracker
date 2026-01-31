"use client";

import { useQueryClient } from "@tanstack/react-query";

import { createInvestmentAsset, searchSymbolsAction } from "@/actions/investment-actions";
import { tradeHistoryKeys } from "@/hooks/useTradeHistory";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
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
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Loader2, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface SearchResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  typeDisp?: string;
}

const investmentFormSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").toUpperCase(),
  name: z.string().optional(),
  quantity: z.number().positive("Quantity must be positive"),
  avgBuyPrice: z.number().positive("Average buy price must be positive"),
  currency: z.string(),
});

type InvestmentFormValues = z.infer<typeof investmentFormSchema>;

interface AddInvestmentDialogProps {
  onSuccess?: () => void;
}

/**
 * Renders a modal dialog containing a form to add or update an investment asset.
 *
 * The form validates input according to the investment schema, includes symbol search
 * with Yahoo Finance autocomplete, shows field and form-level errors, and handles
 * creation or update via the `createInvestmentAsset` action. If the asset already
 * exists, it updates the quantity and recalculates the weighted average buy price.
 *
 * @param onSuccess - Optional callback invoked after a successful asset creation or update
 * @returns The dialog React element that hosts the Add/Update Investment form
 */
export function AddInvestmentDialog({ onSuccess }: AddInvestmentDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<SearchResult | null>(null);

  const form = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentFormSchema),
    defaultValues: {
      symbol: "",
      name: "",
      quantity: 0,
      avgBuyPrice: 0,
      currency: "IDR",
    },
  });

  // Debounced search function
  const debouncedSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const result = await searchSymbolsAction(query);
        if (result.success && result.data) {
          setSearchResults(result.data as SearchResult[]);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      debouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  const handleSelectSymbol = (result: SearchResult) => {
    setSelectedSymbol(result);
    form.setValue("symbol", result.symbol);
    form.setValue("name", result.longname || result.shortname || "");
    setSearchOpen(false);
  };

  const onSubmit = async (data: InvestmentFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await createInvestmentAsset(data);

      if (result.success) {
        // Invalidate trade history cache for real-time updates
        queryClient.invalidateQueries({ queryKey: tradeHistoryKeys.all });
        
        setOpen(false);
        form.reset();
        setSelectedSymbol(null);
        setSearchQuery("");
        onSuccess?.();
      } else {
        form.setError("root", {
          message: result.error || "Failed to create investment",
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
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Investment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add/Update Investment</DialogTitle>
          <DialogDescription>
            Search and add a new investment asset to your portfolio, or update an existing one.
            If the asset already exists, quantities will be combined and the average buy price will be recalculated.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Symbol</FormLabel>
                  <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={searchOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 shrink-0 opacity-50" />
                            {field.value || "Search symbol (e.g., AAPL)..."}
                          </div>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[450px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Type to search symbols..."
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                        />
                        <CommandList>
                          {isSearching ? (
                            <div className="py-6 text-center">
                              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                              <p className="text-sm text-muted-foreground mt-2">
                                Searching...
                              </p>
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>
                                {searchQuery.length < 2
                                  ? "Type at least 2 characters to search"
                                  : "No symbols found"}
                              </CommandEmpty>
                              <CommandGroup>
                                {searchResults.map((result) => (
                                  <CommandItem
                                    key={result.symbol}
                                    value={result.symbol}
                                    onSelect={() => handleSelectSymbol(result)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedSymbol?.symbol === result.symbol
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {result.symbol}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {result.longname || result.shortname}
                                        {result.exchDisp && ` • ${result.exchDisp}`}
                                        {result.typeDisp && ` • ${result.typeDisp}`}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Asset name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.00000001"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="avgBuyPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Average Buy Price</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                    <Input placeholder="IDR" {...field} />
                  </FormControl>
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
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Investment"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
