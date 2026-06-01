"use client";

import { isPreciousMetal } from "@/lib/unit-conversion";
import {
  useCreateInvestmentAsset,
  useSearchSymbols,
  useAssetPrice,
  useInvestmentAccounts,
} from "@/hooks/useInvestmentQueries";
import { InvestmentAccountSelector } from "./InvestmentAccountSelector";
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
    FormDescription,
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
import { cn, formatCurrency } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Loader2, Plus, Search } from "lucide-react";
import { useState } from "react";
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
  accountId: z.string().min(1, "Investment account is required"),
  unitType: z.enum(["UNIT", "TROY_OUNCE", "GRAM"]).optional(),
});

type InvestmentFormValues = z.infer<typeof investmentFormSchema>;

interface AddInvestmentDialogProps {
  onSuccess?: () => void;
}

/**
 * Display a modal dialog with a form to add or update an investment asset.
 *
 * The form validates inputs against the investment schema, provides a symbol
 * autocomplete/search UI, displays field and form-level errors, and creates or
 * updates the asset on submit (combining quantity and recalculating weighted
 * average buy price for existing assets). On successful save, trade history
 * cache entries are invalidated and the dialog resets.
 *
 * @param onSuccess - Optional callback invoked after a successful asset creation or update
 * @returns The dialog React element that contains the Add/Update Investment form
 */
export function AddInvestmentDialog({ onSuccess }: AddInvestmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<SearchResult | null>(null);
  const createMutation = useCreateInvestmentAsset();
  const { data: searchResults = [], isLoading: isSearching } = useSearchSymbols(searchQuery);
  const { data: investmentAccounts = [] } = useInvestmentAccounts();

  const form = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentFormSchema),
    defaultValues: {
      symbol: "",
      name: "",
      quantity: 0,
      avgBuyPrice: 0,
      accountId: "",
      unitType: undefined,
    },
  });
  
  // Watch symbol and unitType to detect precious metals and fetch current price
  const watchedSymbol = form.watch("symbol");
  const watchedUnitType = form.watch("unitType");
  const watchedAccountId = form.watch("accountId");
  const selectedAccount = investmentAccounts.find(
    (account) => account.id === watchedAccountId
  );
  const isSymbolPreciousMetal = isPreciousMetal(watchedSymbol);

  // Fetch current price with currency conversion
  const { data: priceData, isLoading: isLoadingPrice } = useAssetPrice(
    watchedSymbol || undefined,
    selectedAccount?.currency,
    watchedUnitType as "UNIT" | "TROY_OUNCE" | "GRAM" | undefined
  );

  // Format current price for display
  const currentPriceDisplay = priceData?.data
    ? formatCurrency(priceData.data, priceData.currency)
    : isLoadingPrice && watchedSymbol
    ? "Loading..."
    : "N/A";


  const handleSelectSymbol = (result: SearchResult) => {
    setSelectedSymbol(result);
    form.setValue("symbol", result.symbol);
    form.setValue("name", result.longname || result.shortname || "");
    // Auto-set unit type for precious metals (default to GRAM for user convenience)
    if (isPreciousMetal(result.symbol)) {
      form.setValue("unitType", "GRAM");
    } else {
      form.setValue("unitType", "UNIT");
    }
    setSearchOpen(false);
  };

  const onSubmit = async (data: InvestmentFormValues) => {
    try {
      await createMutation.mutateAsync(data);
      setOpen(false);
      form.reset();
      setSelectedSymbol(null);
      setSearchQuery("");
      onSuccess?.();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to create investment",
      });
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

            {isSymbolPreciousMetal && (
              <FormField
                control={form.control}
                name="unitType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="GRAM">Per Gram</SelectItem>
                        <SelectItem value="TROY_OUNCE">Per Troy Ounce</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Gold/Silver prices are fetched in troy ounces. Select &quot;Per Gram&quot; to see prices per gram.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="avgBuyPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Average Buy Price (current price: {currentPriceDisplay})</FormLabel>
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
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investment Account</FormLabel>
                  <FormControl>
                    <InvestmentAccountSelector
                      value={field.value}
                      onChange={field.onChange}
                      disabled={createMutation.isPending}
                      showBalance={true}
                    />
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
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
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
