"use client";

import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  format,
} from "date-fns";
import { CalendarEvent } from "@/actions/calendar-actions";
import { CalendarDay, CalendarDayCompact } from "./CalendarDay";
import { DayEventsSheet } from "./DayEventsSheet";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionType } from "@/generated/prisma/client/client";

interface CalendarViewProps {
  events: CalendarEvent[];
  initialMonth?: Date;
  onMonthChange?: (date: Date) => void;
  filterType?: TransactionType | "ALL";
  compact?: boolean;
  className?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Render an interactive monthly calendar with event display, month navigation, day selection, and an optional compact layout.
 *
 * Renders weekday headers, a 7-column day grid (including adjacent-month days), highlights the selected day, groups events by date, and opens a day events sheet when a day is selected.
 *
 * @param events - Array of calendar events to display in the month view.
 * @param initialMonth - Optional date used to initialize the displayed month; defaults to the current date.
 * @param onMonthChange - Optional callback invoked with the new month Date when the displayed month changes.
 * @param filterType - Event type filter; use `"ALL"` to show all events or a specific TransactionType to limit displayed events.
 * @param compact - When true, render a compact day cell layout and shorter weekday labels.
 * @param className - Optional additional CSS classes applied to the calendar container.
 * @returns The calendar rendered as a React element.
 */
export function CalendarView({
  events,
  initialMonth,
  onMonthChange,
  filterType = "ALL",
  compact = false,
  className,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth || new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filter events by type
  const filteredEvents = useMemo(() => {
    if (filterType === "ALL") return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  // Get all days to display (including days from prev/next months)
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
      const dateKey = format(event.date, "yyyy-MM-dd");
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, event]);
    });
    return map;
  }, [filteredEvents]);

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  const handlePreviousMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onMonthChange?.(today);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setSheetOpen(true);
  };

  const DayComponent = compact ? CalendarDayCompact : CalendarDay;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs"
          >
            Today
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreviousMonth}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="space-y-2">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1">
          {(compact ? WEEKDAYS_SHORT : WEEKDAYS).map((day, i) => (
            <div
              key={i}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

            return (
              <DayComponent
                key={dateKey}
                date={day}
                events={dayEvents}
                isCurrentMonth={isCurrentMonth}
                isSelected={isSelected}
                onClick={() => handleDayClick(day)}
              />
            );
          })}
        </div>
      </div>

      {/* Events Sheet */}
      {selectedDate && (
        <DayEventsSheet
          date={selectedDate}
          events={selectedDateEvents}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      )}
    </div>
  );
}

/**
 * Renders a compact legend mapping Income, Expense, and Transfer to colored dots.
 *
 * @returns The legend JSX element associating each event type with a colored indicator and label.
 */
export function CalendarLegend() {
  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-muted-foreground">Income</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-muted-foreground">Expense</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-muted-foreground">Transfer</span>
      </div>
    </div>
  );
}