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
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";

export interface GoalAccountOption {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface GoalAccountMultiSelectProps {
  disabled?: boolean;
  emptyMessage?: string;
  onChange: (value: string[]) => void;
  options: GoalAccountOption[];
  placeholder?: string;
  value: string[];
}

function formatAccountSummary(accounts: GoalAccountOption[]): string {
  if (accounts.length === 0) return "";
  if (accounts.length === 1) return accounts[0].name;
  if (accounts.length === 2) return `${accounts[0].name}, ${accounts[1].name}`;
  return `${accounts[0].name} +${accounts.length - 1} more`;
}

/**
 * Multi-select combobox for linking one or more funding accounts to a savings goal.
 */
export function GoalAccountMultiSelect({
  disabled,
  emptyMessage = "No accounts found.",
  onChange,
  options,
  placeholder = "Select accounts",
  value,
}: GoalAccountMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selectedAccounts = useMemo(
    () => options.filter((option) => value.includes(option.id)),
    [options, value]
  );

  const triggerLabel =
    selectedAccounts.length > 0
      ? formatAccountSummary(selectedAccounts)
      : placeholder;

  const stopListScrollPropagation = () => {
    const listElement = listRef.current;

    if (!listElement || listElement.scrollHeight <= listElement.clientHeight) {
      return;
    }

    return true;
  };

  const toggleAccount = (accountId: string) => {
    if (value.includes(accountId)) {
      onChange(value.filter((currentId) => currentId !== accountId));
      return;
    }

    onChange([...value, accountId]);
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
            selectedAccounts.length === 0 && "text-muted-foreground"
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
                const checked = value.includes(account.id);
                return (
                  <CommandItem
                    key={account.id}
                    value={`${account.name} ${account.currency} ${account.id}`}
                    onSelect={() => toggleAccount(account.id)}
                  >
                    <Checkbox
                      checked={checked}
                      className="pointer-events-none mr-2"
                      tabIndex={-1}
                    />
                    <span className="truncate">{account.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {account.currency}
                    </span>
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
