"use client";

import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBudgetCategorySummary } from "@/lib/budget-utils";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";

interface BudgetCategoryOption {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface BudgetCategoryMultiSelectProps {
  disabled?: boolean;
  emptyMessage?: string;
  legacyGlobal?: boolean;
  onChange: (value: string[]) => void;
  options: BudgetCategoryOption[];
  placeholder?: string;
  value: string[];
}

export function BudgetCategoryMultiSelect({
  disabled,
  emptyMessage = "No categories found.",
  legacyGlobal = false,
  onChange,
  options,
  placeholder = "Select categories",
  value,
}: BudgetCategoryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selectedCategories = useMemo(
    () => options.filter((option) => value.includes(option.id)),
    [options, value]
  );

  const triggerLabel = legacyGlobal
    ? "Legacy global budget"
    : selectedCategories.length > 0
      ? formatBudgetCategorySummary(selectedCategories, "CATEGORIES")
      : placeholder;

  const stopListScrollPropagation = () => {
    const listElement = listRef.current;

    if (!listElement || listElement.scrollHeight <= listElement.clientHeight) {
      return;
    }

    return true;
  };

  const toggleCategory = (categoryId: string) => {
    if (value.includes(categoryId)) {
      onChange(value.filter((currentId) => currentId !== categoryId));
      return;
    }

    onChange([...value, categoryId]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between gap-2 px-3",
            selectedCategories.length === 0 && !legacyGlobal && "text-muted-foreground"
          )}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-60 w-(--radix-popover-trigger-width) min-w-0 overflow-hidden p-0"
      >
        <Command>
          <CommandInput placeholder="Search category..." />
          <CommandList
            ref={listRef}
            className="max-h-[min(18rem,var(--radix-popover-content-available-height))] touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]"
            onTouchMoveCapture={(event) => {
              if (stopListScrollPropagation()) {
                event.stopPropagation();
              }
            }}
            onWheelCapture={(event) => {
              if (stopListScrollPropagation()) {
                event.stopPropagation();
              }
            }}
          >
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((category) => {
                const checked = value.includes(category.id);
                return (
                  <CommandItem
                    key={category.id}
                    value={`${category.name} ${category.id}`}
                    onSelect={() => toggleCategory(category.id)}
                  >
                    <Checkbox
                      checked={checked}
                      className="pointer-events-none mr-2"
                      tabIndex={-1}
                    />
                    <span
                      className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-xs"
                      style={{
                        backgroundColor: category.color
                          ? `${category.color}1a`
                          : "hsl(var(--muted))",
                        color: category.color || "hsl(var(--foreground))",
                      }}
                    >
                      {category.icon || "•"}
                    </span>
                    <span className="truncate">{category.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
