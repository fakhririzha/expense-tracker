"use client";

import { useMemo } from "react";
import { format, isToday, isTomorrow, isPast, differenceInDays } from "date-fns";
import { CalendarEvent } from "@/actions/calendar-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  AlertCircle,
  Clock,
} from "lucide-react";
import { TransactionType } from "@prisma/client";

interface UpcomingBillsWidgetProps {
  events: CalendarEvent[];
  title?: string;
  maxItems?: number;
  showTotal?: boolean;
  className?: string;
}

const typeConfig = {
  INCOME: {
    icon: ArrowDownCircle,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  EXPENSE: {
    icon: ArrowUpCircle,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
  TRANSFER: {
    icon: ArrowLeftRight,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  LIABILITY_PAYMENT: {
    icon: ArrowUpCircle,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
  },
};

/**
 * Renders a card widget listing upcoming financial events with urgency badges and an optional total.
 *
 * Displays up to `maxItems` events sorted by date, formats dates as "Today", "Tomorrow", or "EEE, MMM d",
 * highlights urgency (overdue, today, tomorrow) with contextual badges, and optionally shows the summed total of `EXPENSE` items.
 *
 * @param events - Array of calendar events to display.
 * @param title - Header title for the widget.
 * @param maxItems - Maximum number of events to show.
 * @param showTotal - Whether to render the total expenses row.
 * @param className - Optional additional CSS class names applied to the Card container.
 * @returns The rendered Upcoming Bills widget.
 */
export function UpcomingBillsWidget({
  events,
  title = "Upcoming Bills",
  maxItems = 7,
  showTotal = true,
  className,
}: UpcomingBillsWidgetProps) {
  // Sort events by date and limit
  const sortedEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, maxItems);
  }, [events, maxItems]);

  // Calculate total expenses
  const totalExpenses = useMemo(() => {
    return sortedEvents
      .filter((e) => e.type === "EXPENSE")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [sortedEvents]);

  // Get urgency status
  const getUrgency = (date: Date): "overdue" | "today" | "tomorrow" | "upcoming" => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);

    if (isPast(eventDate) && !isToday(eventDate)) return "overdue";
    if (isToday(eventDate)) return "today";
    if (isTomorrow(eventDate)) return "tomorrow";
    return "upcoming";
  };

  // Get urgency styling
  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case "overdue":
        return {
          badge: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
          label: "Overdue",
        };
      case "today":
        return {
          badge: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
          label: "Today",
        };
      case "tomorrow":
        return {
          badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400",
          label: "Tomorrow",
        };
      default:
        return {
          badge: "bg-muted text-muted-foreground",
          label: null,
        };
    }
  };

  // Format date label
  const formatDateLabel = (date: Date) => {
    const urgency = getUrgency(date);
    if (urgency === "today") return "Today";
    if (urgency === "tomorrow") return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  // Format amount
  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (sortedEvents.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming bills</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Events list */}
        <div className="space-y-2">
          {sortedEvents.map((event) => {
            const config = typeConfig[event.type];
            const Icon = config.icon;
            const urgency = getUrgency(event.date);
            const urgencyStyle = getUrgencyStyle(urgency);

            return (
              <div
                key={event.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg",
                  "hover:bg-muted/50 transition-colors"
                )}
              >
                {/* Icon */}
                <div className={cn("p-1.5 rounded-md", config.bgColor)}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{event.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateLabel(event.date)}
                    {event.account && ` • ${event.account.name}`}
                  </p>
                </div>

                {/* Amount and urgency */}
                <div className="text-right flex flex-col items-end gap-1">
                  <span className={cn("text-sm font-medium", config.color)}>
                    {formatAmount(event.amount, event.currency)}
                  </span>
                  {urgencyStyle.label && (
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px] px-1.5 py-0", urgencyStyle.badge)}
                    >
                      {urgencyStyle.label}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        {showTotal && totalExpenses > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total Expenses
              </span>
              <span className="text-sm font-semibold text-red-600">
                {formatAmount(
                  totalExpenses,
                  sortedEvents.find((e) => e.type === "EXPENSE")?.currency || "IDR"
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}