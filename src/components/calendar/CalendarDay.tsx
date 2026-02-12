"use client";

import { isSameDay, isToday } from "date-fns";
import { CalendarEvent } from "@/actions/calendar-actions";
import { EventDot, getTypeColor } from "./EventBadge";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CalendarDayProps {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  onClick?: () => void;
  maxVisibleDots?: number;
}

export function CalendarDay({
  date,
  events,
  isCurrentMonth,
  isSelected,
  onClick,
  maxVisibleDots = 3,
}: CalendarDayProps) {
  const isTodayDate = isToday(date);
  const hasEvents = events.length > 0;
  const visibleEvents = events.slice(0, maxVisibleDots);
  const hiddenCount = events.length - maxVisibleDots;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full aspect-square p-1 flex flex-col items-center justify-start",
        "border border-border/50 rounded-lg transition-all",
        "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        !isCurrentMonth && "opacity-40",
        isSelected && "ring-2 ring-primary ring-offset-1 bg-primary/5",
        isTodayDate && !isSelected && "bg-accent/30 border-primary/30"
      )}
    >
      {/* Day number */}
      <span
        className={cn(
          "text-sm font-medium mt-1",
          isTodayDate && "text-primary font-bold",
          isSelected && "text-primary"
        )}
      >
        {date.getDate()}
      </span>

      {/* Event indicators */}
      {hasEvents && (
        <div className="flex-1 w-full flex flex-col items-center justify-center gap-0.5 mt-1">
          {/* Dots for events */}
          <div className="flex flex-wrap gap-0.5 justify-center px-1">
            {visibleEvents.map((event, index) => (
              <EventDot key={`${event.id}-${index}`} type={event.type} />
            ))}
          </div>

          {/* Count badge for hidden events */}
          {hiddenCount > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1 py-0 h-4 min-w-4"
            >
              +{hiddenCount}
            </Badge>
          )}
        </div>
      )}

      {/* Today indicator */}
      {isTodayDate && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
      )}
    </button>
  );
}

// Compact version for smaller displays
export function CalendarDayCompact({
  date,
  events,
  isCurrentMonth,
  isSelected,
  onClick,
}: CalendarDayProps) {
  const isTodayDate = isToday(date);
  const hasEvents = events.length > 0;

  // Get the dominant event type for coloring
  const getDominantType = () => {
    if (events.length === 0) return null;
    const counts = { INCOME: 0, EXPENSE: 0, TRANSFER: 0, LIABILITY_PAYMENT: 0 };
    events.forEach((e) => {
      counts[e.type]++;
    });
    const dominant = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
    return dominant[0] as CalendarEvent["type"];
  };

  const dominantType = getDominantType();

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full aspect-square flex items-center justify-center",
        "rounded-lg transition-all text-sm",
        "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring",
        !isCurrentMonth && "opacity-40",
        isSelected && "ring-2 ring-primary bg-primary/10",
        isTodayDate && !isSelected && "bg-accent font-bold"
      )}
    >
      <span
        className={cn(
          isTodayDate && "text-primary",
          isSelected && "text-primary font-medium"
        )}
      >
        {date.getDate()}
      </span>

      {/* Event indicator dot */}
      {hasEvents && dominantType && (
        <span
          className={cn(
            "absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full",
            getTypeColor(dominantType)
          )}
        />
      )}
    </button>
  );
}
