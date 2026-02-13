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

/**
 * Renders a sheet-style UI showing a day's calendar events, grouped by type with per-currency income and expense totals.
 *
 * Renders a header with the formatted date and event count, a compact summary of totals per currency for income and expenses, and separate lists for Income, Expenses, and Transfers. Each event row is clickable if an `onEventClick` handler is provided. If no events exist, shows an empty-state message.
 *
 * @param date - The date whose events are displayed.
 * @param events - Array of calendar events to render and group.
 * @param open - Controls whether the sheet is visible.
 * @param onOpenChange - Called when the sheet open state changes.
 * @param onEventClick - Optional callback invoked with an event when its row is clicked.
 * @returns The sheet UI element for the specified date's events.
 */
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

  // Calculate grouped totals by currency to avoid mixing currencies
  const incomeGroupedTotals = incomeEvents.reduce<Map<string, number>>((acc, e) => {
    acc.set(e.currency, (acc.get(e.currency) || 0) + e.amount);
    return acc;
  }, new Map());

  const expenseGroupedTotals = expenseEvents.reduce<Map<string, number>>((acc, e) => {
    acc.set(e.currency, (acc.get(e.currency) || 0) + e.amount);
    return acc;
  }, new Map());

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
            <div className="space-y-3">
              {incomeGroupedTotals.size > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Income</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(incomeGroupedTotals.entries()).map(([currency, total]) => (
                      <div
                        key={currency}
                        className="bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-1.5"
                      >
                        <p className="text-sm font-semibold text-green-600">
                          {new Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency,
                            minimumFractionDigits: 0,
                          }).format(total)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {expenseGroupedTotals.size > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Expenses</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(expenseGroupedTotals.entries()).map(([currency, total]) => (
                      <div
                        key={currency}
                        className="bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-1.5"
                      >
                        <p className="text-sm font-semibold text-red-600">
                          {new Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency,
                            minimumFractionDigits: 0,
                          }).format(total)}
                        </p>
                      </div>
                    ))}
                  </div>
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

/**
 * Render a clickable event row that shows an icon, title, category/account meta, and a compact amount badge.
 *
 * Renders a horizontally laid-out card for a CalendarEvent. Displays a recurring or receipt icon based on the event source, the event name, optional category and account names, and an EventBadge with the amount. Invokes `onClick` when the row or badge is clicked.
 *
 * @param event - The calendar event to display
 * @param onClick - Optional handler called when the card is clicked
 */
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