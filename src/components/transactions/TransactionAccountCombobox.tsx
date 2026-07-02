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

export interface TransactionAccountComboboxOption {
  id: string;
  name: string;
  currency: string;
}

interface TransactionAccountComboboxProps {
  emptyMessage: string;
  onChange: (value: string) => void;
  options: TransactionAccountComboboxOption[];
  placeholder: string;
  selectedAccount?: TransactionAccountComboboxOption;
  showCurrencyInList?: boolean;
  showCurrencyInTrigger?: boolean;
  value: string;
}

function formatAccountLabel(
  account: TransactionAccountComboboxOption,
  showCurrency: boolean
) {
  return showCurrency ? `${account.name} (${account.currency})` : account.name;
}

export const TransactionAccountCombobox = forwardRef<
  HTMLButtonElement,
  TransactionAccountComboboxProps &
    Omit<ComponentPropsWithoutRef<typeof Button>, "children" | "onChange" | "value">
>(
  (
    {
      className,
      emptyMessage,
      onChange,
      options,
      placeholder,
      selectedAccount,
      showCurrencyInList = true,
      showCurrencyInTrigger = false,
      value,
      ...buttonProps
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const listRef = useRef<HTMLDivElement | null>(null);

    const resolvedSelectedAccount = useMemo(
      () => selectedAccount ?? options.find((account) => account.id === value),
      [options, selectedAccount, value]
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
              !resolvedSelectedAccount && "text-muted-foreground",
              className
            )}
            {...buttonProps}
          >
            <span className="truncate text-left">
              {resolvedSelectedAccount
                ? formatAccountLabel(resolvedSelectedAccount, showCurrencyInTrigger)
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
            <CommandInput placeholder="Search account..." />
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
                {options.map((account) => {
                  const label = formatAccountLabel(account, showCurrencyInList);

                  return (
                    <CommandItem
                      key={account.id}
                      value={`${account.name} ${account.currency} ${account.id}`}
                      onSelect={() => {
                        onChange(account.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          account.id === value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{label}</span>
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
);

TransactionAccountCombobox.displayName = "TransactionAccountCombobox";
