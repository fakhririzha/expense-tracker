"use client";

import { format } from "date-fns";
import { CalendarIcon, Filter, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface FilterOptions {
  type?: "INCOME" | "EXPENSE" | "TRANSFER";
  categoryId?: string;
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface Account {
  id: string;
  name: string;
}

interface TransactionFiltersProps {
  categories: Category[];
  accounts: Account[];
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
}

export function TransactionFilters({
  categories,
  accounts,
  filters,
  onFiltersChange,
}: TransactionFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({});
  };

  const updateFilter = <K extends keyof FilterOptions>(
    key: K,
    value: FilterOptions[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter Transactions</SheetTitle>
          <SheetDescription>
            Narrow down your transactions by applying filters.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-4">
          {/* Transaction Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Transaction Type</label>
            <Select
              value={filters.type || "all"}
              onValueChange={(value) =>
                updateFilter(
                  "type",
                  value === "all"
                    ? undefined
                    : (value as "INCOME" | "EXPENSE" | "TRANSFER")
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select
              value={filters.categoryId || "all"}
              onValueChange={(value) =>
                updateFilter("categoryId", value === "all" ? undefined : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Account</label>
            <Select
              value={filters.accountId || "all"}
              onValueChange={(value) =>
                updateFilter("accountId", value === "all" ? undefined : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate
                      ? format(filters.startDate, "PPP")
                      : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => updateFilter("startDate", date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate
                      ? format(filters.endDate, "PPP")
                      : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => updateFilter("endDate", date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={clearFilters}
            >
              <X className="mr-2 h-4 w-4" />
              Clear all filters
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
