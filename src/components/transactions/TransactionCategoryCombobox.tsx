"use client";

import { forwardRef, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

export interface TransactionCategoryComboboxOption {
  id: string;
  name: string;
  icon: string | null;
}

interface TransactionCategoryComboboxProps {
  emptyMessage: string;
  onChange: (value: string) => void;
  options: TransactionCategoryComboboxOption[];
  placeholder: string;
  value: string;
}

export const TransactionCategoryCombobox = forwardRef<
  HTMLButtonElement,
  TransactionCategoryComboboxProps &
    Omit<ComponentPropsWithoutRef<typeof Button>, "children" | "onChange" | "value">
>(
  (
    {
      className,
      emptyMessage,
      onChange,
      options,
      placeholder,
      value,
      ...buttonProps
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const listRef = useRef<HTMLDivElement | null>(null);
    const selectedCategory = useMemo(
      () => options.find((category) => category.id === value),
      [options, value]
    );

    const stopListScrollPropagation = () => {
      const listElement = listRef.current;

      if (!listElement || listElement.scrollHeight <= listElement.clientHeight) {
        return;
      }

      return true;
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between gap-2 px-3",
              !selectedCategory && "text-muted-foreground",
              className
            )}
            {...buttonProps}
          >
            <span className="truncate text-left">
              {selectedCategory
                ? `${selectedCategory.icon ? `${selectedCategory.icon} ` : ""}${selectedCategory.name}`
                : placeholder}
            </span>
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
                {options.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={`${category.name} ${category.id}`}
                    onSelect={() => {
                      onChange(category.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        category.id === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {category.icon ? (
                      <span className="mr-2 shrink-0">{category.icon}</span>
                    ) : null}
                    <span className="truncate">{category.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);

TransactionCategoryCombobox.displayName = "TransactionCategoryCombobox";
