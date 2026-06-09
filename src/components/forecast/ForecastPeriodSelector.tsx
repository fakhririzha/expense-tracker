"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ForecastHorizonDays } from "@/lib/forecasting/forecast-types";

interface ForecastPeriodSelectorProps {
  value: ForecastHorizonDays;
  onChange: (value: ForecastHorizonDays) => void;
}

export function ForecastPeriodSelector({
  value,
  onChange,
}: ForecastPeriodSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border p-1">
      {[30, 60, 90].map((days) => (
        <Button
          key={days}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 rounded-md px-3",
            value === days && "bg-primary text-primary-foreground hover:bg-primary"
          )}
          onClick={() => onChange(days as ForecastHorizonDays)}
        >
          {days}D
        </Button>
      ))}
    </div>
  );
}
