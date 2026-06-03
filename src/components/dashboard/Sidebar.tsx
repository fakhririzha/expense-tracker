"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSidebarMetrics } from "@/hooks/useSidebarMetrics";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Boxes,
  Calendar,
  CreditCard,
  Database,
  Goal,
  LayoutDashboard,
  Menu,
  PieChart,
  Receipt,
  RefreshCw,
  Tags,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
  { href: "/dashboard/accounts", label: "Accounts", icon: Wallet },
  { href: "/dashboard/assets", label: "Assets", icon: Boxes },
  { href: "/dashboard/categories", label: "Categories", icon: Tags },
  { href: "/dashboard/budgets", label: "Budgets", icon: PieChart },
  { href: "/dashboard/goals", label: "Goals", icon: Goal },
  { href: "/dashboard/liabilities", label: "Liabilities", icon: CreditCard },
  { href: "/dashboard/investments", label: "Investments", icon: TrendingUp },
  { href: "/dashboard/recurring", label: "Recurring", icon: RefreshCw },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/data", label: "Data", icon: Database },
];

function NavItems({
  pathname,
  closeOnSelect = false,
}: {
  pathname: string;
  closeOnSelect?: boolean;
}) {
  return (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const link = (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all neo-border",
              isActive
                ? "bg-secondary text-secondary-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-x-0.5 translate-y-0.5"
                : "bg-transparent border-transparent hover:bg-accent hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5"
            )}
          >
            <item.icon className="h-5 w-5" strokeWidth={2.5} />
            {item.label}
          </Link>
        );

        if (closeOnSelect) {
          return (
            <SheetClose key={item.href} asChild>
              {link}
            </SheetClose>
          );
        }

        return link;
      })}
    </>
  );
}

function SidebarGoalSnapshot() {
  const { data, isLoading } = useSidebarMetrics();

  if (isLoading) {
    return (
      <div className="bg-primary text-primary-foreground p-4 neo-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
        <div>
          <p className="font-black text-xs uppercase tracking-widest opacity-90">
            Goal Snapshot
          </p>
          <div className="mt-2 h-4 w-28 animate-pulse bg-primary-foreground/20" />
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="h-3 w-24 animate-pulse bg-primary-foreground/20" />
              <div className="h-3 w-16 animate-pulse bg-primary-foreground/20" />
            </div>
            <div className="h-2 w-full animate-pulse bg-primary-foreground/20" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="h-3 w-24 animate-pulse bg-primary-foreground/20" />
              <div className="h-3 w-16 animate-pulse bg-primary-foreground/20" />
            </div>
            <div className="h-2 w-full animate-pulse bg-primary-foreground/20" />
          </div>
        </div>
      </div>
    );
  }

  const retirementSet = !!data?.retirementTarget && data.retirementTarget > 0;
  const budgetSet = !!data?.monthlyBudget && data.monthlyBudget > 0;

  const retirementLeftPercent =
    retirementSet && data?.retirementLeftPercent !== null
      ? data.retirementLeftPercent
      : null;
  const budgetLeftPercent =
    budgetSet && data?.monthlyBudgetLeftPercent !== null
      ? data.monthlyBudgetLeftPercent
      : null;

  const retirementLabel = retirementSet
    ? retirementLeftPercent === null
      ? "Unavailable"
      : `${retirementLeftPercent.toFixed(1)}% left`
    : "Not set";

  const budgetLabel = budgetSet
    ? budgetLeftPercent === null
      ? "Unavailable"
      : `${budgetLeftPercent.toFixed(1)}% left`
    : "Not set";

  const retirementDetail = retirementSet
    ? retirementLeftPercent === null
      ? "Retirement progress is unavailable right now."
      : `${retirementLeftPercent.toFixed(1)}% remaining to target`
    : "Set a retirement target in your profile.";

  const budgetDetail = budgetSet
    ? budgetLeftPercent === null
      ? "Current-month spending is unavailable right now."
      : `${budgetLeftPercent.toFixed(1)}% of your monthly budget remains`
    : "Set a monthly budget target in your profile.";

  return (
    <div className="bg-primary text-primary-foreground p-4 neo-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-black text-xs uppercase tracking-widest opacity-90">
            Goal Snapshot
          </p>
          <p className="font-black text-lg mt-1">Stay on target</p>
        </div>
        <Target className="h-6 w-6 shrink-0" strokeWidth={2.5} />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest opacity-90">
                Retirement Left
              </p>
              <p className="text-xs font-bold opacity-80">{retirementDetail}</p>
            </div>
            <span className="shrink-0 text-sm font-black">{retirementLabel}</span>
          </div>
          <Progress
            value={retirementLeftPercent !== null ? 100 - retirementLeftPercent : 0}
            className="h-2 bg-primary-foreground/20"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest opacity-90">
                Budget Left
              </p>
              <p className="text-xs font-bold opacity-80">{budgetDetail}</p>
            </div>
            <span className="shrink-0 text-sm font-black">{budgetLabel}</span>
          </div>
          <Progress
            value={budgetLeftPercent !== null ? 100 - budgetLeftPercent : 0}
            className="h-2 bg-primary-foreground/20"
          />
        </div>
      </div>

      {(!retirementSet || !budgetSet) && (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="w-full rounded-none border-black bg-primary-foreground text-primary hover:bg-primary-foreground/90 hover:text-primary"
        >
          <Link href="/dashboard/profile">Update profile targets</Link>
        </Button>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r-4 border-black bg-white h-screen sticky top-0 z-40">
      <div className="h-16 flex items-center px-6 border-b-4 border-black bg-primary text-primary-foreground">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <TrendingUp className="h-6 w-6" strokeWidth={3} />
          <span className="font-black text-xl tracking-tight uppercase font-heading">FinHealth</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        <NavItems pathname={pathname} />
      </nav>

      <div className="p-4 border-t-4 border-black">
        <SidebarGoalSnapshot />
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="md:hidden h-10 rounded-none bg-primary px-3 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
        >
          <Menu className="h-5 w-5" strokeWidth={3} />
          <span className="font-black text-base uppercase tracking-tight font-heading">
            FinHealth
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[min(22rem,calc(100vw-1rem))] gap-0 border-r-4 border-black bg-white p-0 shadow-[8px_0_0px_0px_rgba(0,0,0,1)] sm:max-w-sm"
      >
        <SheetHeader className="h-16 border-b-4 border-black bg-primary px-5 py-0 text-primary-foreground">
          <SheetTitle asChild>
            <Link
              href="/dashboard"
              className="flex h-full items-center gap-2 text-primary-foreground"
            >
              <TrendingUp className="h-6 w-6" strokeWidth={3} />
              <span className="font-black text-xl tracking-tight uppercase font-heading">
                FinHealth
              </span>
            </Link>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          <NavItems pathname={pathname} closeOnSelect />
        </nav>

        <div className="border-t-4 border-black p-4">
          <SidebarGoalSnapshot />
        </div>
      </SheetContent>
    </Sheet>
  );
}
