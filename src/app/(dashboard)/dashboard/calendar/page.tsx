"use client";

import { useState } from "react";
import { CalendarEvent, MonthSummary } from "@/actions/calendar-actions";
import { CalendarView, CalendarLegend } from "@/components/calendar/CalendarView";
import { UpcomingBillsWidget } from "@/components/calendar/UpcomingBillsWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  Wallet,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { TransactionType } from "@/generated/prisma/client/client";
import { useCalendarEvents, useUpcomingBills, useMonthSummary } from "@/hooks/useCalendarQueries";
import { useQueryClient } from "@tanstack/react-query";
import { calendarKeys } from "@/hooks/useCalendarQueries";

/**
 * Renders the Bills Calendar page with calendar view, filters, summary cards, and sidebar widgets.
 *
 * @returns The page's JSX element containing the calendar UI.
 */
export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterType, setFilterType] = useState<TransactionType | "ALL">("ALL");
  const qc = useQueryClient();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;

  const { data: events = [], isLoading: eventsLoading } = useCalendarEvents(year, month);
  console.log(events);
  const { data: upcomingBills = [], isLoading: upcomingLoading } = useUpcomingBills(7);
  const { data: summary } = useMonthSummary(year, month);

  const isLoading = eventsLoading || upcomingLoading;

  const handleMonthChange = (date: Date) => {
    setCurrentMonth(date);
  };

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: calendarKeys.all });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bills Calendar</h1>
          <p className="text-muted-foreground">
            View and manage your upcoming bills and recurring transactions
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            {/* Total Income */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <ArrowDownCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {summary
                    ? formatCurrency((summary as MonthSummary).totalIncome, (summary as MonthSummary).currency)
                    : formatCurrency(0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(currentMonth, "MMMM yyyy")}
                </p>
              </CardContent>
            </Card>

            {/* Total Expenses */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <ArrowUpCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {summary
                    ? formatCurrency((summary as MonthSummary).totalExpenses, (summary as MonthSummary).currency)
                    : formatCurrency(0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(currentMonth, "MMMM yyyy")}
                </p>
              </CardContent>
            </Card>

            {/* Net */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    summary && (summary as MonthSummary).net >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {summary ? formatCurrency((summary as MonthSummary).net, (summary as MonthSummary).currency) : formatCurrency(0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(currentMonth, "MMMM yyyy")}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
        {/* Calendar */}
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center justify-between">
            <CalendarLegend />
            <Select
              value={filterType}
              onValueChange={(value) => setFilterType(value as TransactionType | "ALL")}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Events</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Calendar View */}
          <Card>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-40" />
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 35 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square" />
                    ))}
                  </div>
                </div>
              ) : (
                <CalendarView
                  events={events as CalendarEvent[]}
                  initialMonth={currentMonth}
                  onMonthChange={handleMonthChange}
                  filterType={filterType}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Bills Widget */}
          {isLoading ? (
            <Skeleton className="h-[400px]" />
          ) : (
            <UpcomingBillsWidget
              events={upcomingBills as CalendarEvent[]}
              title="Next 7 Days"
              showTotal
            />
          )}

          {/* Legend Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Event Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium">Income</p>
                  <p className="text-xs text-muted-foreground">
                    Money coming in
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div>
                  <p className="text-sm font-medium">Expense</p>
                  <p className="text-xs text-muted-foreground">
                    Money going out
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <div>
                  <p className="text-sm font-medium">Transfer</p>
                  <p className="text-xs text-muted-foreground">
                    Between accounts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Total Events
                </span>
                <span className="text-sm font-medium">{(events as CalendarEvent[]).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Upcoming (7 days)
                </span>
                <span className="text-sm font-medium">
                  {(upcomingBills as CalendarEvent[]).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Recurring Rules
                </span>
                <span className="text-sm font-medium">
                  {(events as CalendarEvent[]).filter((e) => e.source === "recurring").length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}