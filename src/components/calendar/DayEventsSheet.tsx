"use client";

import { format } from "date-fns";
import { CalendarEvent } from "@/actions/calendar-actions";
import { EventBadge } from "./EventBadge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Calendar, RefreshCw, Receipt } from "lucide-react";

interface DayEventsSheetProps {
  date: Date;
  events: CalendarEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export function DayEventsSheet({
  date,
  events,
  open,
  onOpenChange,
  onEventClick,
}: DayEventsSheetProps) {
  // Group events by type
  const incomeEvents = events.filter((e) => e.type === "INCOME");
  const expenseEvents = events.filter((e) => e.type === "EXPENSE");
  const transferEvents = events.filter((e) => e.type === "TRANSFER");

  // Calculate totals
  const totalIncome = incomeEvents.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenseEvents.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {format(date, "EEEE, MMMM d, yyyy")}
          </SheetTitle>
          <SheetDescription>
            {events.length} event{events.length !== 1 ? "s" : ""} scheduled
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Summary */}
          {events.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {totalIncome > 0 && (
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Income</p>
                  <p className="text-lg font-semibold text-green-600">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: events.find((e) => e.type === "INCOME")?.currency || "IDR",
                      minimumFractionDigits: 0,
                    }).format(totalIncome)}
                  </p>
                </div>
              )}
              {totalExpenses > 0 && (
                <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Expenses</p>
                  <p className="text-lg font-semibold text-red-600">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: events.find((e) => e.type === "EXPENSE")?.currency || "IDR",
                      minimumFractionDigits: 0,
                    }).format(totalExpenses)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Income Events */}
          {incomeEvents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Income
                <Badge variant="secondary" className="text-xs">
                  {incomeEvents.length}
                </Badge>
              </h3>
              <div className="space-y-2">
                {incomeEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={() => onEventClick?.(event)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Expense Events */}
          {expenseEvents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Expenses
                <Badge variant="secondary" className="text-xs">
                  {expenseEvents.length}
                </Badge>
              </h3>
              <div className="space-y-2">
                {expenseEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={() => onEventClick?.(event)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Transfer Events */}
          {transferEvents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Transfers
                <Badge variant="secondary" className="text-xs">
                  {transferEvents.length}
                </Badge>
              </h3>
              <div className="space-y-2">
                {transferEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={() => onEventClick?.(event)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No events */}
          {events.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No events scheduled for this day</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EventCard({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {event.source === "recurring" ? (
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="font-medium text-sm truncate">{event.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {event.category && (
            <span className="truncate">{event.category.name}</span>
          )}
          {event.account && (
            <>
              <span>•</span>
              <span className="truncate">{event.account.name}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right">
        <EventBadge
          type={event.type}
          name=""
          amount={event.amount}
          currency={event.currency}
          compact
          onClick={onClick}
        />
      </div>
    </div>
  );
}
