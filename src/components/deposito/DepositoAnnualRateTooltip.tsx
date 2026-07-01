"use client";

import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DepositoAnnualRateTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Explain deposito annual interest rate"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 space-y-1" side="top">
          <p>Enter the annual rate.</p>
          <p>
            FinHealth converts it per posting: daily = annual rate / 365,
            monthly = annual rate / 12, yearly = full annual rate.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
