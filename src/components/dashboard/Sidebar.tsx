"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  TrendingUp,
  Wallet,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
  { href: "/dashboard/accounts", label: "Accounts", icon: Wallet },
  { href: "/dashboard/assets", label: "Assets", icon: Boxes },
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
        <div className="bg-primary text-primary-foreground p-4 neo-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black text-xs uppercase tracking-widest opacity-90">Net Worth Goal</p>
          <p className="font-black text-lg mt-1">Keep Grinding</p>
        </div>
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
          <div className="bg-primary text-primary-foreground p-4 neo-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="font-black text-xs uppercase tracking-widest opacity-90">
              Net Worth Goal
            </p>
            <p className="font-black text-lg mt-1">Keep Grinding</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
