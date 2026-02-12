"use client";

import * as React from "react";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

type PresetKey = "thisMonth" | "lastMonth" | "last3Months" | "last6Months" | "thisYear" | "custom";

const presets: { label: string; value: PresetKey }[] = [
  { label: "This Month", value: "thisMonth" },
  { label: "Last Month", value: "lastMonth" },
  { label: "Last 3 Months", value: "last3Months" },
  { label: "Last 6 Months", value: "last6Months" },
  { label: "This Year", value: "thisYear" },
  { label: "Custom", value: "custom" },
];

function getPresetRange(preset: PresetKey): DateRange | undefined {
  const today = new Date();
  
  switch (preset) {
    case "thisMonth":
      return {
        from: startOfMonth(today),
        to: endOfMonth(today),
      };
    case "lastMonth":
      const lastMonth = subMonths(today, 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    case "last3Months":
      return {
        from: subDays(today, 90),
        to: today,
      };
    case "last6Months":
      return {
        from: subMonths(today, 6),
        to: today,
      };
    case "thisYear":
      return {
        from: startOfYear(today),
        to: today,
      };
    case "custom":
    default:
      return undefined;
  }
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<PresetKey>("thisMonth");
  const [isCustomOpen, setIsCustomOpen] = React.useState(false);

  // Initialize with this month's range if no value provided
  React.useEffect(() => {
    if (!value) {
      const defaultRange = getPresetRange("thisMonth");
      onChange(defaultRange);
    }
  }, [value, onChange]);

  const handlePresetChange = (preset: PresetKey) => {
    setSelectedPreset(preset);
    
    if (preset === "custom") {
      setIsCustomOpen(true);
    } else {
      const range = getPresetRange(preset);
      onChange(range);
      setIsCustomOpen(false);
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    onChange(range);
    setSelectedPreset("custom");
  };

  const formatDateRange = () => {
    if (!value?.from) return "Select date range";
    
    if (value.to) {
      return `${format(value.from, "MMM d, yyyy")} - ${format(value.to, "MMM d, yyyy")}`;
    }
    
    return format(value.from, "MMM d, yyyy");
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
